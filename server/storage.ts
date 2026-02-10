import { db } from "./db";
import {
  schedules,
  type Schedule,
  type InsertSchedule,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getSchedules(userId: string): Promise<Schedule[]>;
  getSchedule(id: number): Promise<Schedule | undefined>;
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  updateSchedule(id: number, schedule: Partial<InsertSchedule>): Promise<Schedule>;
  deleteSchedule(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getSchedules(userId: string): Promise<Schedule[]> {
    return await db.select().from(schedules).where(eq(schedules.userId, userId)).orderBy(desc(schedules.createdAt));
  }

  async getSchedule(id: number): Promise<Schedule | undefined> {
    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, id));
    return schedule;
  }

  async createSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    const [schedule] = await db
      .insert(schedules)
      .values(insertSchedule)
      .returning();
    return schedule;
  }

  async updateSchedule(
    id: number,
    updateData: Partial<InsertSchedule>
  ): Promise<Schedule> {
    const [schedule] = await db
      .update(schedules)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(schedules.id, id))
      .returning();
    return schedule;
  }

  async deleteSchedule(id: number): Promise<void> {
    await db.delete(schedules).where(eq(schedules.id, id));
  }
}

export const storage = new DatabaseStorage();
