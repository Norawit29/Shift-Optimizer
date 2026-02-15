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
  useCustomRange?: boolean;
  customStartDate?: string;
  customEndDate?: string;
  separateHolidayConfig?: boolean;
  holidayStaffPerShift?: number[];
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

export interface UnfilledSlot {
  date: number;
  shiftIdx: number;
  shiftName: string;
  required: number;
  assigned: number;
}

export interface OptimizerResult {
  schedule: DaySchedule[];
  metrics: {
    range: number;
    perStaff: StaffMetrics[];
  };
  isPartial?: boolean;
  unfilledSlots?: UnfilledSlot[];
  feasibilityWarning?: string;
}

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  picture: text("picture"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userPresets = pgTable("user_presets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull().default("Default"),
  config: jsonb("config").$type<SchedulerConfig>().notNull(),
  staff: jsonb("staff").$type<StaffMember[]>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

  isPartial: boolean("is_partial").default(false),
  unfilledSlots: jsonb("unfilled_slots").$type<UnfilledSlot[]>().default([]),
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const feedbacks = pgTable("feedbacks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === SCHEMAS ===

export const insertScheduleSchema = createInsertSchema(schedules).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;

export type User = typeof users.$inferSelect;
export type UserPreset = typeof userPresets.$inferSelect;
