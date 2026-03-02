import type { Express } from "express";
import type { Server } from "http";
import { OAuth2Client } from "google-auth-library";
import { db } from "./db";
import { users, userPresets, feedbacks, usageLogs, generatedSchedules, schedules, insertScheduleSchema } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { sanityClient, urlFor } from "./sanity";

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

  app.get("/sitemap.xml", async (_req, res) => {
    const baseUrl = "https://shift-optimizer.com";
    const now = new Date().toISOString().split("T")[0];

    const staticPages = [
      { loc: "/", priority: "1.0", changefreq: "weekly" },
      { loc: "/create", priority: "0.8", changefreq: "monthly" },
      { loc: "/articles", priority: "0.8", changefreq: "weekly" },
    ];

    let articleUrls: { loc: string; lastmod: string }[] = [];
    try {
      const articles = await sanityClient.fetch<{ slug: string; publishedAt: string | null }[]>(
        `*[_type == "article" && !(_id in path("drafts.**"))] | order(publishedAt desc) { "slug": slug.current, publishedAt }`
      );
      articleUrls = (articles || []).map((a) => ({
        loc: `/articles/${a.slug}`,
        lastmod: a.publishedAt ? a.publishedAt.split("T")[0] : now,
      }));
    } catch {}

    const urls = staticPages
      .map(
        (p) =>
          `<url><loc>${baseUrl}${p.loc}</loc><lastmod>${now}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
      )
      .concat(
        articleUrls.map(
          (a) =>
            `<url><loc>${baseUrl}${a.loc}</loc><lastmod>${a.lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`
        )
      );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
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

  return httpServer;
}
