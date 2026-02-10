import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // === Schedules API (all protected) ===

  app.get(api.schedules.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const list = await storage.getSchedules(userId);
    res.json(list);
  });

  app.get(api.schedules.get.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const schedule = await storage.getSchedule(Number(req.params.id));
    if (!schedule || schedule.userId !== userId) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    res.json(schedule);
  });

  app.post(api.schedules.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = api.schedules.create.input.parse(req.body);
      const schedule = await storage.createSchedule({ ...input, userId } as any);
      res.status(201).json(schedule);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      } else {
        throw err;
      }
    }
  });

  app.put(api.schedules.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const existing = await storage.getSchedule(id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      const input = api.schedules.update.input.parse(req.body);
      const updated = await storage.updateSchedule(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      } else {
        throw err;
      }
    }
  });

  app.delete(api.schedules.delete.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    const existing = await storage.getSchedule(id);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    await storage.deleteSchedule(id);
    res.status(204).send();
  });

  return httpServer;
}
