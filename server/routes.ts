import type { Express } from "express";
import type { Server } from "http";
import { OAuth2Client } from "google-auth-library";
import { db } from "./db";
import { users, userPresets, feedbacks, usageLogs, generatedSchedules } from "@shared/schema";
import { eq } from "drizzle-orm";
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

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
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

  app.get("/api/articles", async (_req, res) => {
    try {
      const articles = await sanityClient.fetch(
        `*[_type == "article"] | order(publishedAt desc) {
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
        `*[_type == "article" && slug.current == $slug][0] {
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
