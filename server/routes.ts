import type { Express } from "express";
import type { Server } from "http";
import { OAuth2Client } from "google-auth-library";
import { db } from "./db";
import { users, userPresets, feedbacks, usageLogs, generatedSchedules, schedules, insertScheduleSchema } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { sanityClient, urlFor } from "./sanity";
import { stripeStorage } from "./stripeStorage";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/robots.txt", (req, res) => {
    const host = req.get("host") || "shift-optimizer.com";
    const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    res.type("text/plain; charset=utf-8").send(
      `User-agent: *\nAllow: /\n\nSitemap: ${protocol}://${host}/sitemap.xml\n`
    );
  });

  // ── Sitemap helpers ───────────────────────────────────────────────────────
  function sanitizeSlug(raw: string | null | undefined): string {
    if (!raw) return "";
    return raw.trim().replace(/\s+/g, "-").replace(/-{2,}/g, "-");
  }

  function cleanUrl(baseUrl: string, path: string): string {
    const cleanPath = path
      .trim()
      .replace(/\s+/g, "")
      .replace(/\/+/g, "/")
      .replace(/^(?!\/)/, "/");
    const full = `${baseUrl.replace(/\/$/, "")}${cleanPath}`;
    return full;
  }

  function urlEntry(loc: string, lastmod: string, changefreq: string, priority: string): string {
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  }

  function wrapUrlset(entries: string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;
  }

  const BASE_URL = "https://shift-optimizer.com";

  // ── sitemap-pages.xml ────────────────────────────────────────────────────
  app.get("/sitemap-pages.xml", (_req, res) => {
    const now = new Date().toISOString().split("T")[0];
    const pages = [
      { path: "/", priority: "1.0", changefreq: "weekly" },
      { path: "/create", priority: "0.8", changefreq: "monthly" },
      { path: "/articles", priority: "0.8", changefreq: "weekly" },
      { path: "/case-studies", priority: "0.8", changefreq: "weekly" },
    ];
    const entries = pages.map((p) =>
      urlEntry(cleanUrl(BASE_URL, p.path), now, p.changefreq, p.priority)
    );
    res.type("application/xml; charset=utf-8").send(wrapUrlset(entries));
  });

  // ── sitemap-articles.xml ─────────────────────────────────────────────────
  app.get("/sitemap-articles.xml", async (_req, res) => {
    const now = new Date().toISOString().split("T")[0];
    let entries: string[] = [];
    try {
      const articles = await sanityClient.fetch<{ slug: string; publishedAt: string | null }[]>(
        `*[_type == "article" && !(_id in path("drafts.**"))] | order(publishedAt desc) { "slug": slug.current, publishedAt }`
      );
      entries = (articles || [])
        .map((a) => {
          const slug = sanitizeSlug(a.slug);
          if (!slug) return null;
          const loc = cleanUrl(BASE_URL, `/articles/${slug}`);
          const lastmod = a.publishedAt ? a.publishedAt.split("T")[0] : now;
          return urlEntry(loc, lastmod, "monthly", "0.7");
        })
        .filter((e): e is string => e !== null);
    } catch {}
    res.type("application/xml; charset=utf-8").send(wrapUrlset(entries));
  });

  // ── sitemap-case-studies.xml ─────────────────────────────────────────────
  app.get("/sitemap-case-studies.xml", async (_req, res) => {
    const now = new Date().toISOString().split("T")[0];
    let entries: string[] = [];
    try {
      const caseStudies = await sanityClient.fetch<{ slug: string; publishedAt: string | null }[]>(
        `*[_type == "caseStudy" && !(_id in path("drafts.**"))] | order(publishedAt desc) { "slug": slug.current, publishedAt }`
      );
      entries = (caseStudies || [])
        .map((c) => {
          const slug = sanitizeSlug(c.slug);
          if (!slug) return null;
          const loc = cleanUrl(BASE_URL, `/case-studies/${slug}`);
          const lastmod = c.publishedAt ? c.publishedAt.split("T")[0] : now;
          return urlEntry(loc, lastmod, "monthly", "0.6");
        })
        .filter((e): e is string => e !== null);
    } catch {}
    res.type("application/xml; charset=utf-8").send(wrapUrlset(entries));
  });

  // ── sitemap.xml (index) ──────────────────────────────────────────────────
  app.get("/sitemap.xml", (_req, res) => {
    const now = new Date().toISOString().split("T")[0];
    const sitemaps = [
      `${BASE_URL}/sitemap-pages.xml`,
      `${BASE_URL}/sitemap-articles.xml`,
      `${BASE_URL}/sitemap-case-studies.xml`,
    ];
    const entries = sitemaps.map(
      (loc) => `  <sitemap>\n    <loc>${loc}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`
    );
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>`;
    res.type("application/xml; charset=utf-8").send(xml);
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/avatar/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) return res.status(400).end();

      const [user] = await db.select({ picture: users.picture }).from(users).where(eq(users.id, userId)).limit(1);
      if (!user?.picture) return res.status(404).end();

      const picUrl = new URL(user.picture);
      if (!picUrl.hostname.endsWith("googleusercontent.com")) return res.status(403).end();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const imgRes = await fetch(user.picture, {
        headers: { "User-Agent": "ShiftScheduler/1.0" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!imgRes.ok) return res.status(502).end();

      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) return res.status(502).end();

      const contentLength = parseInt(imgRes.headers.get("content-length") || "0", 10);
      if (contentLength > 512 * 1024) return res.status(502).end();

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      res.send(buffer);
    } catch {
      res.status(500).end();
    }
  });

  app.get("/api/auth/google-client-id", (_req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID || "" });
  });

  app.post("/api/auth/google", async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ message: "Missing credential" });
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        return res.status(400).json({ message: "Invalid token" });
      }

      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.googleId, payload.sub))
        .limit(1);

      if (!user) {
        const [newUser] = await db
          .insert(users)
          .values({
            googleId: payload.sub,
            email: payload.email,
            name: payload.name || payload.email,
            picture: payload.picture || null,
          })
          .returning();
        user = newUser;
      }

      req.session.userId = user.id;
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        picture: user.picture,
      });
    } catch (error) {
      console.error("Google auth error:", error);
      res.status(401).json({ message: "Authentication failed" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.json(null);
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);
    if (!user) {
      req.session.destroy(() => {});
      return res.json(null);
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      picture: user.picture,
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/presets", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const presets = await db
      .select()
      .from(userPresets)
      .where(eq(userPresets.userId, req.session.userId));
    res.json(presets);
  });

  app.post("/api/presets", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { name, config, staff } = req.body;
    if (!config || !staff) {
      return res.status(400).json({ message: "Missing config or staff" });
    }

    const existing = await db
      .select()
      .from(userPresets)
      .where(eq(userPresets.userId, req.session.userId));

    if (existing.length > 0) {
      const [updated] = await db
        .update(userPresets)
        .set({ name: name || "Default", config, staff, updatedAt: new Date() })
        .where(eq(userPresets.id, existing[0].id))
        .returning();
      return res.json(updated);
    }

    const [preset] = await db
      .insert(userPresets)
      .values({
        userId: req.session.userId,
        name: name || "Default",
        config,
        staff,
      })
      .returning();
    res.json(preset);
  });

  app.delete("/api/presets/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const id = parseInt(req.params.id);
    await db.delete(userPresets).where(eq(userPresets.id, id));
    res.json({ ok: true });
  });

  app.post("/api/feedback", async (req, res) => {
    try {
      const { rating, comment } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be 1-5" });
      }
      const [fb] = await db
        .insert(feedbacks)
        .values({
          userId: req.session.userId || null,
          rating,
          comment: comment || null,
        })
        .returning();
      res.json(fb);
    } catch (error) {
      console.error("Feedback error:", error);
      res.status(500).json({ message: "Failed to save feedback" });
    }
  });

  app.post("/api/usage-log", async (req, res) => {
    try {
      const { eventType, staffCount, dayCount, shiftCount, coveragePercent, isPartial, durationMs, metadata } = req.body;
      if (!eventType) {
        return res.status(400).json({ message: "Missing eventType" });
      }
      const [log] = await db
        .insert(usageLogs)
        .values({
          userId: req.session.userId || null,
          eventType,
          staffCount: staffCount ?? null,
          dayCount: dayCount ?? null,
          shiftCount: shiftCount ?? null,
          coveragePercent: coveragePercent ?? null,
          isPartial: isPartial ?? null,
          durationMs: durationMs ?? null,
          metadata: metadata ?? null,
        })
        .returning();
      res.json({ ok: true, id: log.id });
    } catch (error) {
      console.error("Usage log error:", error);
      res.status(500).json({ message: "Failed to save usage log" });
    }
  });

  app.post("/api/generated-schedules", async (req, res) => {
    try {
      const { month, year, config, staff, result } = req.body;
      if (!config || !staff || !result) {
        return res.status(400).json({ message: "Missing config, staff, or result" });
      }
      const [schedule] = await db
        .insert(generatedSchedules)
        .values({
          userId: req.session.userId || null,
          month: month ?? 0,
          year: year ?? 0,
          config,
          staff,
          result,
        })
        .returning();
      res.json({ ok: true, id: schedule.id });
    } catch (error) {
      console.error("Generated schedule error:", error);
      res.status(500).json({ message: "Failed to save generated schedule" });
    }
  });

  app.get("/api/schedules", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const result = await db
        .select()
        .from(schedules)
        .where(eq(schedules.userId, userId))
        .orderBy(desc(schedules.createdAt));
      res.json(result);
    } catch (error) {
      console.error("List schedules error:", error);
      res.status(500).json({ message: "Failed to fetch schedules" });
    }
  });

  app.get("/api/schedules/:id", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid schedule ID" });
      }
      const [schedule] = await db
        .select()
        .from(schedules)
        .where(and(eq(schedules.id, id), eq(schedules.userId, userId)))
        .limit(1);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      console.error("Get schedule error:", error);
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  app.post("/api/schedules", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const parsed = insertScheduleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid schedule data", field: parsed.error.issues[0]?.path?.join(".") });
      }
      const [schedule] = await db
        .insert(schedules)
        .values({ ...parsed.data, userId } as any)
        .returning();
      res.status(201).json(schedule);
    } catch (error) {
      console.error("Create schedule error:", error);
      res.status(500).json({ message: "Failed to create schedule" });
    }
  });

  app.put("/api/schedules/:id", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid schedule ID" });
      }
      const [existing] = await db
        .select()
        .from(schedules)
        .where(and(eq(schedules.id, id), eq(schedules.userId, userId)))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      const allowedFields = ["name", "config", "staff", "result", "isPublished"] as const;
      const updateData: Record<string, any> = { updatedAt: new Date() };
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      const [updated] = await db
        .update(schedules)
        .set(updateData)
        .where(eq(schedules.id, id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Update schedule error:", error);
      res.status(500).json({ message: "Failed to update schedule" });
    }
  });

  app.delete("/api/schedules/:id", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid schedule ID" });
      }
      const [existing] = await db
        .select()
        .from(schedules)
        .where(and(eq(schedules.id, id), eq(schedules.userId, userId)))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      await db.delete(schedules).where(eq(schedules.id, id));
      res.status(204).send();
    } catch (error) {
      console.error("Delete schedule error:", error);
      res.status(500).json({ message: "Failed to delete schedule" });
    }
  });

  app.get("/api/case-studies", async (_req, res) => {
    try {
      const caseStudies = await sanityClient.fetch(
        `*[_type == "caseStudy" && !(_id in path("drafts.**"))] | order(publishedAt desc) {
          _id,
          title,
          slug,
          excerpt,
          "coverImage": coverImage.asset->url,
          publishedAt,
          language
        }`
      );
      res.json(caseStudies);
    } catch (error) {
      console.error("Sanity case studies fetch error:", error);
      res.status(500).json({ message: "Failed to fetch case studies" });
    }
  });

  app.get("/api/case-studies/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const caseStudy = await sanityClient.fetch(
        `*[_type == "caseStudy" && !(_id in path("drafts.**")) && slug.current == $slug][0] {
          _id,
          hospitalName,
          title,
          slug,
          department,
          problem,
          solution,
          results,
          kpis {
            "url": asset->url,
            caption
          },
          testimonial {
            quote,
            name,
            position
          },
          "coverImage": coverImage.asset->url,
          publishedAt,
          isFeatured
        }`,
        { slug }
      );
      if (!caseStudy) {
        return res.status(404).json({ message: "Case study not found" });
      }
      res.json(caseStudy);
    } catch (error) {
      console.error("Sanity case study fetch error:", error);
      res.status(500).json({ message: "Failed to fetch case study" });
    }
  });

  app.get("/api/articles", async (_req, res) => {
    try {
      const articles = await sanityClient.fetch(
        `*[_type == "article" && !(_id in path("drafts.**"))] | order(publishedAt desc) {
          _id,
          title,
          slug,
          excerpt,
          "coverImage": coverImage.asset->url,
          publishedAt,
          language
        }`
      );
      res.json(articles);
    } catch (error) {
      console.error("Sanity articles fetch error:", error);
      res.status(500).json({ message: "Failed to fetch articles" });
    }
  });

  app.get("/api/articles/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const article = await sanityClient.fetch(
        `*[_type == "article" && !(_id in path("drafts.**")) && slug.current == $slug][0] {
          _id,
          title,
          slug,
          excerpt,
          "coverImage": coverImage.asset->url,
          body,
          publishedAt,
          language
        }`,
        { slug }
      );
      if (!article) {
        return res.status(404).json({ message: "Article not found" });
      }
      res.json(article);
    } catch (error) {
      console.error("Sanity article fetch error:", error);
      res.status(500).json({ message: "Failed to fetch article" });
    }
  });

  // === STRIPE ROUTES ===

  const ENFORCEMENT_DATE = new Date("2026-07-01T00:00:00+07:00");

  app.get("/api/stripe/subscription", async (req, res) => {
    const now = new Date();
    const enforcementDate = ENFORCEMENT_DATE.toISOString();
    const isEnforced = now >= ENFORCEMENT_DATE;

    if (!req.session.userId) {
      return res.json({ subscription: null, isPro: false, proSlots: null, isTrialing: false, trialDaysLeft: null, trialUsed: false, enforcementDate, isEnforced });
    }
    try {
      const subscription = await stripeStorage.getUserActiveSubscription(req.session.userId);
      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));

      const TRIAL_DAYS = 14;
      let isTrialing = false;
      let trialDaysLeft: number | null = null;
      if (!subscription && user?.trialUsed && user?.trialStartedAt) {
        const msSince = Date.now() - new Date(user.trialStartedAt).getTime();
        const daysSince = msSince / (1000 * 60 * 60 * 24);
        if (daysSince < TRIAL_DAYS) {
          isTrialing = true;
          trialDaysLeft = Math.ceil(TRIAL_DAYS - daysSince);
        }
      }

      res.json({
        subscription,
        isPro: !!subscription || isTrialing,
        proSlots: (subscription || isTrialing) ? (user?.proSlots ?? null) : null,
        isTrialing,
        trialDaysLeft,
        trialUsed: user?.trialUsed ?? false,
        enforcementDate,
        isEnforced,
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.json({ subscription: null, isPro: false, proSlots: null, isTrialing: false, trialDaysLeft: null, trialUsed: false, enforcementDate, isEnforced: false });
    }
  });

  app.post("/api/trial/start", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.trialUsed) {
        return res.status(400).json({ message: "Trial already used" });
      }
      if (user.stripeSubscriptionId) {
        return res.status(400).json({ message: "Already subscribed" });
      }
      await db.update(users).set({
        trialStartedAt: new Date(),
        trialUsed: true,
      }).where(eq(users.id, req.session.userId));
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Error starting trial:", error);
      return res.status(500).json({ message: error.message || "Failed to start trial" });
    }
  });

  app.get("/api/stripe/products", async (_req, res) => {
    try {
      const rows = await stripeStorage.listProductsWithPrices();
      const productsMap = new Map<string, any>();
      for (const row of rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            prices: [],
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
          });
        }
      }
      res.json({ data: Array.from(productsMap.values()) });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.json({ data: [] });
    }
  });

  app.post("/api/stripe/checkout", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const SLOT_TIERS: Record<number, { monthly: number; yearly: number }> = {
      15: { monthly: 25900, yearly: 263900 },
      20: { monthly: 33500, yearly: 341500 },
      25: { monthly: 40900, yearly: 416900 },
      30: { monthly: 48500, yearly: 494500 },
      35: { monthly: 55900, yearly: 569900 },
      40: { monthly: 63500, yearly: 647500 },
      45: { monthly: 70900, yearly: 722900 },
      50: { monthly: 78500, yearly: 800500 },
    };

    const { slotCount, billingCycle } = req.body;
    const slotNum = parseInt(slotCount);
    const tier = SLOT_TIERS[slotNum];
    if (!tier) {
      return res.status(400).json({ message: "Invalid slot count" });
    }
    const interval: "month" | "year" = billingCycle === "yearly" ? "year" : "month";
    const unitAmount = interval === "year" ? tier.yearly : tier.monthly;

    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
      if (!user) return res.status(404).json({ message: "User not found" });

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { userId: String(user.id) },
        });
        await stripeStorage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
      const host = req.get("host") || "";
      const baseUrl = `${protocol}://${host}`;

      const tierLabel = String(slotNum);
      const productName = `Shift Optimizer Pro (${tierLabel} บุคลากร)`;
      const productDesc = `บุคลากรสูงสุด ${slotNum} คน · เวรสูงสุด 5 ประเภท · ระดับบุคลากรสูงสุด 5 ระดับ · เกลี่ยวันหยุด · ตารางรายบุคคล · ส่งออก Excel`;

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "thb",
            product_data: {
              name: productName,
              description: productDesc,
            },
            unit_amount: unitAmount,
            recurring: { interval },
          },
          quantity: 1,
        }],
        mode: "subscription",
        subscription_data: {
          metadata: { slotCount: String(slotNum) },
        },
        success_url: `${baseUrl}/create?subscribed=true`,
        cancel_url: `${baseUrl}/pricing?canceled=true`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/portal", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "No Stripe customer found" });
      }

      const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
      const host = req.get("host") || "";

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${protocol}://${host}/pricing`,
      });

      res.json({ url: portalSession.url });
    } catch (error: any) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ message: error.message || "Failed to create portal session" });
    }
  });

  app.post("/api/enterprise-leads", async (req, res) => {
    try {
      const { enterpriseLeads, insertEnterpriseLeadSchema } = await import("../shared/schema");
      const parsed = insertEnterpriseLeadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const [lead] = await db.insert(enterpriseLeads).values(parsed.data).returning();
      res.json({ success: true, id: lead.id });
    } catch (error: any) {
      console.error("Error saving enterprise lead:", error);
      res.status(500).json({ message: "Failed to save inquiry" });
    }
  });

  return httpServer;
}
