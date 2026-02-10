import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // === Schedules API ===

  app.get(api.schedules.list.path, async (req, res) => {
    const list = await storage.getSchedules();
    res.json(list);
  });

  app.get(api.schedules.get.path, async (req, res) => {
    const schedule = await storage.getSchedule(Number(req.params.id));
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    res.json(schedule);
  });

  app.post(api.schedules.create.path, async (req, res) => {
    try {
      const input = api.schedules.create.input.parse(req.body);
      const schedule = await storage.createSchedule(input);
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

  app.put(api.schedules.update.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getSchedule(id);
      if (!existing) {
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

  app.delete(api.schedules.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getSchedule(id);
    if (!existing) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    await storage.deleteSchedule(id);
    res.status(204).send();
  });

  // Helper to seed data if empty
  const schedules = await storage.getSchedules();
  if (schedules.length === 0) {
    console.log("Seeding database with sample schedule...");
    const sampleConfig = {
      shiftsPerDay: 3,
      shiftNames: ["Morning", "Evening", "Night"],
      staffPerShift: [2, 2, 1],
      consecutiveRules: [{ from: 2, to: 0 }], // No Night -> Morning
    };
    
    const sampleStaff = [
      { id: "s1", name: "Dr. Somchai", maxShifts: 20, blocked: [] },
      { id: "s2", name: "Nurse Somsri", maxShifts: 20, blocked: [] },
      { id: "s3", name: "Nurse Mana", maxShifts: 20, blocked: [] },
      { id: "s4", name: "Dr. Jane", maxShifts: 15, blocked: [] },
      { id: "s5", name: "Nurse Ploy", maxShifts: 20, blocked: [] },
    ];

    await storage.createSchedule({
      name: "Sample Feb 2025",
      month: 2,
      year: 2025,
      config: sampleConfig,
      staff: sampleStaff,
      result: [], // Empty initially
      isPublished: false,
    });
  }

  return httpServer;
}
