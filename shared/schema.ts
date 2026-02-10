import { pgTable, text, serial, integer, jsonb, timestamp, boolean, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

// === TABLE DEFINITIONS ===

// We use a document-store approach for flexibility with the complex nested config
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  name: text("name").notNull().default("Untitled Schedule"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  
  // Stores: { shiftsPerDay: number, shiftNames: string[], staffPerShift: number[], consecutiveRules: {from:number, to:number}[] }
  config: jsonb("config").$type<{
    shiftsPerDay: number;
    shiftNames: string[];
    staffPerShift: number[];
    consecutiveRules: { from: number; to: number }[];
  }>().notNull(),

  // Stores array of: { id: string, name: string, maxShifts: number, blocked: {date:number, shift:number}[] }
  staff: jsonb("staff").$type<{
    id: string;
    name: string;
    maxShifts: number;
    blocked: { date: number; shift: number }[];
  }[]>().notNull(),

  // Stores the generated result matrix
  result: jsonb("result").$type<{
    date: number;
    shifts: number[][]; // Array of staff indices/IDs per shift
  }[]>().default([]),

  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === SCHEMAS ===

export const insertScheduleSchema = createInsertSchema(schedules).omit({ 
  id: true, 
  userId: true,
  createdAt: true, 
  updatedAt: true 
});

// === TYPES ===

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;

// Helper types for the JSON columns
export interface SchedulerConfig {
  shiftsPerDay: number;
  shiftNames: string[];
  staffPerShift: number[];
  consecutiveRules: { from: number; to: number }[];
}

export interface StaffMember {
  id: string;
  name: string;
  maxShifts: number;
  blocked: { date: number; shift: number }[];
}

export interface DaySchedule {
  date: number;
  shifts: string[][]; // Changed to string[] to store staff IDs/Names for flexibility
}

export interface OptimizerResult {
  schedule: DaySchedule[];
  metrics: {
    range: number;
    perStaff: { name: string; total: number; byShift: number[] }[];
  };
}
