import { pgTable, text, serial, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TYPES (defined first so table can reference them) ===

export interface SchedulerConfig {
  shiftsPerDay: number;
  shiftNames: string[];
  staffPerShift: number[];
  consecutiveRules: { from: number; to: number }[];
  balanceHolidays?: boolean;
  holidays?: number[];
}

export interface StaffMember {
  id: string;
  name: string;
  maxShifts: number;
  blocked: { date: number; shift: number }[];
}

export interface DaySchedule {
  date: number;
  shifts: string[][];
}

export interface StaffMetrics {
  name: string;
  total: number;
  byShift: number[];
  weekdayTotal?: number;
  weekdayByShift?: number[];
  holidayTotal?: number;
  holidayByShift?: number[];
}

export interface OptimizerResult {
  schedule: DaySchedule[];
  metrics: {
    range: number;
    perStaff: StaffMetrics[];
  };
}

// === TABLE DEFINITIONS ===

export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Untitled Schedule"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  
  config: jsonb("config").$type<SchedulerConfig>().notNull(),

  staff: jsonb("staff").$type<StaffMember[]>().notNull(),

  result: jsonb("result").$type<{
    date: number;
    shifts: number[][];
  }[]>().default([]),

  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === SCHEMAS ===

export const insertScheduleSchema = createInsertSchema(schedules).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
