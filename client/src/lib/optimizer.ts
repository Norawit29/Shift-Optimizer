import type { StaffMember, SchedulerConfig, DaySchedule, OptimizerResult } from "@shared/schema";
import { getDaysInMonth } from "date-fns";

type Slot = { dayIdx: number; shiftIdx: number; position: number };

export class ShiftOptimizer {
  private config: SchedulerConfig;
  private staff: StaffMember[];
  private month: number;
  private year: number;
  private daysInMonth: number;
  private schedule: DaySchedule[] = [];

  private staffWorkLoad: Map<string, number>;
  private staffShiftCounts: Map<string, number[]>;

  private holidayDays: Set<number>;
  private staffHolidayLoad: Map<string, number>;
  private staffHolidayShiftCounts: Map<string, number[]>;
  private staffWeekdayLoad: Map<string, number>;
  private staffWeekdayShiftCounts: Map<string, number[]>;

  private staffLookup: Map<string, StaffMember>;

  constructor(config: SchedulerConfig, staff: StaffMember[], month: number, year: number) {
    this.config = config;
    this.staff = staff;
    this.month = month;
    this.year = year;
    this.daysInMonth = getDaysInMonth(new Date(year, month - 1));

    this.staffLookup = new Map();
    staff.forEach(s => this.staffLookup.set(s.id, s));

    this.holidayDays = new Set<number>();
    if (config.balanceHolidays) {
      for (let d = 1; d <= this.daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          this.holidayDays.add(d);
        }
      }
      if (config.holidays) {
        for (const h of config.holidays) {
          this.holidayDays.add(h);
        }
      }
    }

    this.staffWorkLoad = new Map();
    this.staffShiftCounts = new Map();
    this.staffHolidayLoad = new Map();
    this.staffHolidayShiftCounts = new Map();
    this.staffWeekdayLoad = new Map();
    this.staffWeekdayShiftCounts = new Map();

    staff.forEach(s => {
      this.staffWorkLoad.set(s.id, 0);
      this.staffShiftCounts.set(s.id, new Array(config.shiftNames.length).fill(0));
      this.staffHolidayLoad.set(s.id, 0);
      this.staffHolidayShiftCounts.set(s.id, new Array(config.shiftNames.length).fill(0));
      this.staffWeekdayLoad.set(s.id, 0);
      this.staffWeekdayShiftCounts.set(s.id, new Array(config.shiftNames.length).fill(0));
    });
  }

  private isHoliday(date: number): boolean {
    return this.holidayDays.has(date);
  }

  public optimize(): OptimizerResult {
    this.optimizeStartTime = Date.now();

    const infeasible = this.checkFeasibility();
    if (infeasible) {
      throw new Error(infeasible);
    }

    let bestResult: OptimizerResult | null = null;
    let bestScore = Infinity;

    const maxAttempts = 200;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (this.isTimedOut()) break;

      try {
        this.resetState();
        this.initializeSchedule();

        const useRandom = attempt > 0;
        this.cspSolve(useRandom);

        this.localRepair(5000);
        this.circadianRepair(3000);

        const metrics = this.calculateMetrics();
        const score = this.evaluateSolutionQuality(metrics);

        if (score < bestScore) {
          bestScore = score;
          bestResult = {
            schedule: JSON.parse(JSON.stringify(this.schedule)),
            metrics
          };
        }

        if (score <= 1) break;
      } catch (_e) {
      }
    }

    if (bestResult) {
      return bestResult;
    }

    if (this.isTimedOut()) {
      throw new Error(
        "Timed out after 5 minutes without finding a valid schedule. " +
        "Try adding more staff, increasing max shifts per person, or reducing blocked dates."
      );
    }

    const relaxedResult = this.tryWithRelaxedConstraints();
    if (relaxedResult) {
      return relaxedResult;
    }

    throw new Error(
      "Could not find a valid schedule. The constraints may be too tight. " +
      "Try adding more staff, increasing max shifts per person, or reducing blocked dates."
    );
  }

  private checkFeasibility(): string | null {
    for (let day = 1; day <= this.daysInMonth; day++) {
      for (let shiftIdx = 0; shiftIdx < this.config.shiftNames.length; shiftIdx++) {
        const required = this.config.staffPerShift[shiftIdx];
        let available = 0;

        for (const member of this.staff) {
          const isBlocked = member.blocked.some(b => b.date === day && (b.shift === -1 || b.shift === shiftIdx));
          if (!isBlocked) available++;
        }

        if (available < required) {
          return `Day ${day}, Shift "${this.config.shiftNames[shiftIdx]}": ` +
            `needs ${required} staff but only ${available} are available. ` +
            `This is impossible to solve. Please add more staff or remove some blocked dates for this day.`;
        }
      }
    }

    const totalSlotsPerDay = this.config.staffPerShift.reduce((a, b) => a + b, 0);
    if (totalSlotsPerDay > this.staff.length) {
      return `Each day requires ${totalSlotsPerDay} staff slots but only ${this.staff.length} staff members exist. ` +
        `Please add more staff or reduce staff per shift.`;
    }

    return null;
  }

  private tryWithRelaxedConstraints(): OptimizerResult | null {
    for (let relaxLevel = 1; relaxLevel <= 3; relaxLevel++) {
      if (this.isTimedOut()) return null;

      const originalMaxShifts = this.staff.map(s => s.maxShifts);

      this.staff.forEach(s => {
        s.maxShifts = s.maxShifts + relaxLevel;
      });

      for (let attempt = 0; attempt < 100; attempt++) {
        if (this.isTimedOut()) {
          this.staff.forEach((s, i) => {
            s.maxShifts = originalMaxShifts[i];
          });
          return null;
        }

        try {
          this.resetState();
          this.initializeSchedule();

          this.cspSolve(attempt > 0);

          this.localRepair(5000);
          this.circadianRepair(3000);

          const metrics = this.calculateMetrics();

          this.staff.forEach((s, i) => {
            s.maxShifts = originalMaxShifts[i];
          });

          return {
            schedule: JSON.parse(JSON.stringify(this.schedule)),
            metrics
          };
        } catch (_e) {
        }
      }

      this.staff.forEach((s, i) => {
        s.maxShifts = originalMaxShifts[i];
      });
    }

    return null;
  }

  private cspNodeCount = 0;
  private readonly CSP_NODE_LIMIT = 100000;
  private optimizeStartTime = 0;
  private readonly TIMEOUT_MS = 5 * 60 * 1000;

  private isTimedOut(): boolean {
    return Date.now() - this.optimizeStartTime > this.TIMEOUT_MS;
  }

  private cspSolve(randomize: boolean) {
    if (this.isTimedOut()) {
      throw new Error("Timeout reached.");
    }

    const slots = this.buildSlots();
    const domains = this.buildDomains(slots);

    const slotsByDay = new Map<number, Slot[]>();
    for (const slot of slots) {
      const arr = slotsByDay.get(slot.dayIdx) || [];
      arr.push(slot);
      slotsByDay.set(slot.dayIdx, arr);
    }

    this.propagateForced(slots, domains);

    const unassigned = slots.filter(s => this.getSlotValue(s) === null);
    this.cspNodeCount = 0;

    const success = this.backtrackSolve(unassigned, domains, randomize, slotsByDay);
    if (!success) {
      throw new Error("CSP solver could not find a valid assignment.");
    }
  }

  private buildSlots(): Slot[] {
    const slots: Slot[] = [];
    for (let dayIdx = 0; dayIdx < this.daysInMonth; dayIdx++) {
      for (let shiftIdx = 0; shiftIdx < this.config.shiftNames.length; shiftIdx++) {
        const required = this.config.staffPerShift[shiftIdx];
        for (let pos = 0; pos < required; pos++) {
          slots.push({ dayIdx, shiftIdx, position: pos });
        }
      }
    }
    return slots;
  }

  private slotKey(slot: Slot): string {
    return `${slot.dayIdx}-${slot.shiftIdx}-${slot.position}`;
  }

  private getSlotValue(slot: Slot): string | null {
    const assigned = this.schedule[slot.dayIdx].shifts[slot.shiftIdx];
    if (slot.position < assigned.length && assigned[slot.position]) {
      return assigned[slot.position];
    }
    return null;
  }

  private buildDomains(slots: Slot[]): Map<string, string[]> {
    const domains = new Map<string, string[]>();

    for (const slot of slots) {
      const date = slot.dayIdx + 1;
      const eligible: string[] = [];

      for (const member of this.staff) {
        const isBlocked = member.blocked.some(b => b.date === date && (b.shift === -1 || b.shift === slot.shiftIdx));
        if (!isBlocked) {
          eligible.push(member.id);
        }
      }

      domains.set(this.slotKey(slot), eligible);
    }

    return domains;
  }

  private propagateForced(slots: Slot[], domains: Map<string, string[]>) {
    let changed = true;
    while (changed) {
      changed = false;

      for (const slot of slots) {
        if (this.getSlotValue(slot) !== null) continue;

        const key = this.slotKey(slot);
        const domain = domains.get(key)!;

        const validCandidates = domain.filter(staffId => {
          const member = this.staffLookup.get(staffId)!;
          return this.canAssignCSP(member, slot.dayIdx, slot.shiftIdx);
        });

        domains.set(key, validCandidates);

        if (validCandidates.length === 1) {
          const staffId = validCandidates[0];
          this.assignSlot(slot, staffId);
          changed = true;
        }

        if (validCandidates.length === 0 && this.getSlotValue(slot) === null) {
          throw new Error(`No valid candidate for Day ${slot.dayIdx + 1}, Shift ${this.config.shiftNames[slot.shiftIdx]}, position ${slot.position + 1}.`);
        }
      }
    }
  }

  private assignSlot(slot: Slot, staffId: string) {
    const shifts = this.schedule[slot.dayIdx].shifts[slot.shiftIdx];
    while (shifts.length <= slot.position) {
      shifts.push("");
    }
    shifts[slot.position] = staffId;
    this.updateStats(staffId, slot.shiftIdx, slot.dayIdx + 1);
  }

  private unassignSlot(slot: Slot) {
    const shifts = this.schedule[slot.dayIdx].shifts[slot.shiftIdx];
    if (slot.position < shifts.length && shifts[slot.position]) {
      const staffId = shifts[slot.position];
      shifts[slot.position] = "";
      this.removeStats(staffId, slot.shiftIdx, slot.dayIdx + 1);
    }
  }

  private backtrackSolve(unassigned: Slot[], domains: Map<string, string[]>, randomize: boolean, slotsByDay: Map<number, Slot[]>): boolean {
    this.cspNodeCount++;
    if (this.cspNodeCount > this.CSP_NODE_LIMIT) return false;
    if ((this.cspNodeCount & 0xFFF) === 0 && this.isTimedOut()) return false;

    let bestSlot: Slot | null = null;
    let bestDomainSize = Infinity;

    for (let i = 0; i < unassigned.length; i++) {
      const slot = unassigned[i];
      if (this.getSlotValue(slot) !== null) continue;

      const key = this.slotKey(slot);
      const domain = domains.get(key)!;
      let validCount = 0;
      for (const staffId of domain) {
        const member = this.staffLookup.get(staffId)!;
        if (this.canAssignCSP(member, slot.dayIdx, slot.shiftIdx)) {
          validCount++;
        }
      }

      if (validCount === 0) return false;

      if (validCount < bestDomainSize) {
        bestDomainSize = validCount;
        bestSlot = slot;
      }
    }

    if (!bestSlot) return true;

    const key = this.slotKey(bestSlot);
    let candidates = domains.get(key)!.filter(staffId => {
      const member = this.staffLookup.get(staffId)!;
      return this.canAssignCSP(member, bestSlot!.dayIdx, bestSlot!.shiftIdx);
    });

    if (randomize && candidates.length > 1) {
      candidates = this.shuffleArray(candidates);
    } else {
      candidates.sort((a, b) => {
        const loadA = this.staffWorkLoad.get(a) || 0;
        const loadB = this.staffWorkLoad.get(b) || 0;
        return loadA - loadB;
      });
    }

    for (const staffId of candidates) {
      this.assignSlot(bestSlot, staffId);

      if (this.forwardCheckScoped(bestSlot.dayIdx, domains, slotsByDay)) {
        if (this.backtrackSolve(unassigned, domains, randomize, slotsByDay)) {
          return true;
        }
      }

      this.unassignSlot(bestSlot);
    }

    return false;
  }

  private forwardCheckScoped(assignedDayIdx: number, domains: Map<string, string[]>, slotsByDay: Map<number, Slot[]>): boolean {
    for (let d = assignedDayIdx - 1; d <= assignedDayIdx + 1; d++) {
      const daySlots = slotsByDay.get(d);
      if (!daySlots) continue;

      for (const slot of daySlots) {
        if (this.getSlotValue(slot) !== null) continue;

        const key = this.slotKey(slot);
        const domain = domains.get(key)!;

        let hasValid = false;
        for (const staffId of domain) {
          const member = this.staffLookup.get(staffId)!;
          if (this.canAssignCSP(member, slot.dayIdx, slot.shiftIdx)) {
            hasValid = true;
            break;
          }
        }

        if (!hasValid) return false;
      }
    }
    return true;
  }

  private canAssignCSP(member: StaffMember, dayIdx: number, shiftIdx: number): boolean {
    const currentLoad = this.staffWorkLoad.get(member.id) || 0;
    if (currentLoad >= member.maxShifts) return false;

    const daySchedule = this.schedule[dayIdx];
    for (let s = 0; s < daySchedule.shifts.length; s++) {
      if (daySchedule.shifts[s].includes(member.id)) return false;
    }

    const date = dayIdx + 1;
    if (member.blocked.some(b => b.date === date && (b.shift === -1 || b.shift === shiftIdx))) {
      return false;
    }

    if (dayIdx > 0) {
      const prevDaySchedule = this.schedule[dayIdx - 1];
      for (const rule of this.config.consecutiveRules) {
        if (rule.to === shiftIdx) {
          if (prevDaySchedule.shifts[rule.from].includes(member.id)) {
            return false;
          }
        }
      }
    }

    if (dayIdx < this.daysInMonth - 1) {
      const nextDaySchedule = this.schedule[dayIdx + 1];
      for (const rule of this.config.consecutiveRules) {
        if (rule.from === shiftIdx) {
          if (nextDaySchedule.shifts[rule.to].includes(member.id)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private evaluateSolutionQuality(metrics: any): number {
    let score = metrics.range;
    for (const ps of metrics.perStaff) {
      const counts = ps.byShift as number[];
      const variance = this.shiftTypeVariance(counts);
      score += variance;
    }
    return score;
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private resetState() {
    this.staffWorkLoad = new Map();
    this.staffShiftCounts = new Map();
    this.staffHolidayLoad = new Map();
    this.staffHolidayShiftCounts = new Map();
    this.staffWeekdayLoad = new Map();
    this.staffWeekdayShiftCounts = new Map();
    this.staff.forEach(s => {
      this.staffWorkLoad.set(s.id, 0);
      this.staffShiftCounts.set(s.id, new Array(this.config.shiftNames.length).fill(0));
      this.staffHolidayLoad.set(s.id, 0);
      this.staffHolidayShiftCounts.set(s.id, new Array(this.config.shiftNames.length).fill(0));
      this.staffWeekdayLoad.set(s.id, 0);
      this.staffWeekdayShiftCounts.set(s.id, new Array(this.config.shiftNames.length).fill(0));
    });
  }

  private initializeSchedule() {
    this.schedule = [];
    for (let day = 1; day <= this.daysInMonth; day++) {
      const shifts: string[][] = Array(this.config.shiftNames.length).fill([]).map(() => []);
      this.schedule.push({ date: day, shifts });
    }
  }

  private getStaffShiftOnDay(staffId: string, dayIdx: number): number {
    if (dayIdx < 0 || dayIdx >= this.daysInMonth) return -1;
    const daySchedule = this.schedule[dayIdx];
    for (let s = 0; s < daySchedule.shifts.length; s++) {
      if (daySchedule.shifts[s].includes(staffId)) return s;
    }
    return -1;
  }

  private shiftTypeVariance(counts: number[]): number {
    if (counts.length <= 1) return 0;
    const sum = counts.reduce((a, b) => a + b, 0);
    if (sum === 0) return 0;
    const mean = sum / counts.length;
    return counts.reduce((acc, c) => acc + Math.pow(c - mean, 2), 0);
  }

  private updateStats(memberId: string, shiftIdx: number, date: number) {
    const currentLoad = this.staffWorkLoad.get(memberId) || 0;
    this.staffWorkLoad.set(memberId, currentLoad + 1);

    const shiftCounts = this.staffShiftCounts.get(memberId) || [];
    shiftCounts[shiftIdx] = (shiftCounts[shiftIdx] || 0) + 1;
    this.staffShiftCounts.set(memberId, shiftCounts);

    if (this.config.balanceHolidays) {
      if (this.isHoliday(date)) {
        const holLoad = this.staffHolidayLoad.get(memberId) || 0;
        this.staffHolidayLoad.set(memberId, holLoad + 1);
        const holCounts = this.staffHolidayShiftCounts.get(memberId) || [];
        holCounts[shiftIdx] = (holCounts[shiftIdx] || 0) + 1;
        this.staffHolidayShiftCounts.set(memberId, holCounts);
      } else {
        const wdLoad = this.staffWeekdayLoad.get(memberId) || 0;
        this.staffWeekdayLoad.set(memberId, wdLoad + 1);
        const wdCounts = this.staffWeekdayShiftCounts.get(memberId) || [];
        wdCounts[shiftIdx] = (wdCounts[shiftIdx] || 0) + 1;
        this.staffWeekdayShiftCounts.set(memberId, wdCounts);
      }
    }
  }

  private removeStats(memberId: string, shiftIdx: number, date: number) {
    const currentLoad = this.staffWorkLoad.get(memberId) || 0;
    this.staffWorkLoad.set(memberId, currentLoad - 1);

    const shiftCounts = this.staffShiftCounts.get(memberId) || [];
    shiftCounts[shiftIdx] = (shiftCounts[shiftIdx] || 0) - 1;
    this.staffShiftCounts.set(memberId, shiftCounts);

    if (this.config.balanceHolidays) {
      if (this.isHoliday(date)) {
        const holLoad = this.staffHolidayLoad.get(memberId) || 0;
        this.staffHolidayLoad.set(memberId, holLoad - 1);
        const holCounts = this.staffHolidayShiftCounts.get(memberId) || [];
        holCounts[shiftIdx] = (holCounts[shiftIdx] || 0) - 1;
        this.staffHolidayShiftCounts.set(memberId, holCounts);
      } else {
        const wdLoad = this.staffWeekdayLoad.get(memberId) || 0;
        this.staffWeekdayLoad.set(memberId, wdLoad - 1);
        const wdCounts = this.staffWeekdayShiftCounts.get(memberId) || [];
        wdCounts[shiftIdx] = (wdCounts[shiftIdx] || 0) - 1;
        this.staffWeekdayShiftCounts.set(memberId, wdCounts);
      }
    }
  }

  private canAssign(member: StaffMember, date: number, shiftIdx: number, currentAssigned: string[]): boolean {
    const currentLoad = this.staffWorkLoad.get(member.id) || 0;
    if (currentLoad >= member.maxShifts) return false;

    if (currentAssigned.includes(member.id)) return false;

    const daySchedule = this.schedule[date - 1];
    for (let s = 0; s < daySchedule.shifts.length; s++) {
      if (daySchedule.shifts[s].includes(member.id)) return false;
    }

    if (member.blocked.some(b => b.date === date && (b.shift === -1 || b.shift === shiftIdx))) {
      return false;
    }

    if (date > 1) {
      const prevDaySchedule = this.schedule[date - 2];
      for (const rule of this.config.consecutiveRules) {
        if (rule.to === shiftIdx) {
          if (prevDaySchedule.shifts[rule.from].includes(member.id)) {
            return false;
          }
        }
      }
    }

    if (date < this.daysInMonth) {
      const nextDaySchedule = this.schedule[date];
      for (const rule of this.config.consecutiveRules) {
        if (rule.from === shiftIdx) {
          if (nextDaySchedule.shifts[rule.to].includes(member.id)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private circadianRepair(maxIter: number) {
    const numShifts = this.config.shiftNames.length;
    if (numShifts <= 1) return;

    for (let iter = 0; iter < maxIter; iter++) {
      let bestImprovement = 0;
      let bestSwapInfo: { dayIdx: number; shiftIdx: number; posA: number; staffA: string; dayIdx2: number; shiftIdx2: number; posB: number; staffB: string } | null = null;

      for (let attempt = 0; attempt < 80; attempt++) {
        const dayIdx = Math.floor(Math.random() * this.daysInMonth);
        const shiftIdx = Math.floor(Math.random() * numShifts);
        const assigned = this.schedule[dayIdx].shifts[shiftIdx];
        if (assigned.length === 0) continue;

        const posA = Math.floor(Math.random() * assigned.length);
        const staffA = assigned[posA];

        const prevShiftA = this.getStaffShiftOnDay(staffA, dayIdx - 1);
        const nextShiftA = this.getStaffShiftOnDay(staffA, dayIdx + 1);

        const currentContinuityA = this.continuityScore(prevShiftA, shiftIdx, nextShiftA, numShifts);

        for (let dayIdx2 = Math.max(0, dayIdx - 7); dayIdx2 <= Math.min(this.daysInMonth - 1, dayIdx + 7); dayIdx2++) {
          for (let shiftIdx2 = 0; shiftIdx2 < numShifts; shiftIdx2++) {
            if (dayIdx === dayIdx2 && shiftIdx === shiftIdx2) continue;
            const assigned2 = this.schedule[dayIdx2].shifts[shiftIdx2];
            if (assigned2.length === 0) continue;

            const posB = Math.floor(Math.random() * assigned2.length);
            const staffB = assigned2[posB];
            if (staffA === staffB) continue;

            const alreadyOnDayA = this.getStaffShiftOnDay(staffB, dayIdx);
            if (alreadyOnDayA !== -1 && !(dayIdx === dayIdx2)) continue;
            const alreadyOnDayB = this.getStaffShiftOnDay(staffA, dayIdx2);
            if (alreadyOnDayB !== -1 && !(dayIdx === dayIdx2)) continue;

            const memberA = this.staffLookup.get(staffA)!;
            const memberB = this.staffLookup.get(staffB)!;

            if (memberA.blocked.some(b => b.date === dayIdx2 + 1 && (b.shift === -1 || b.shift === shiftIdx2))) continue;
            if (memberB.blocked.some(b => b.date === dayIdx + 1 && (b.shift === -1 || b.shift === shiftIdx))) continue;

            if (!this.checkConsecutiveRulesForSwap(memberB, dayIdx, shiftIdx)) continue;
            if (!this.checkConsecutiveRulesForSwap(memberA, dayIdx2, shiftIdx2)) continue;

            const prevShiftB = this.getStaffShiftOnDay(staffB, dayIdx2 - 1);
            const nextShiftB = this.getStaffShiftOnDay(staffB, dayIdx2 + 1);
            const currentContinuityB = this.continuityScore(prevShiftB, shiftIdx2, nextShiftB, numShifts);

            const newPrevA_atDay2 = this.getStaffShiftOnDay(staffA, dayIdx2 - 1);
            const newNextA_atDay2 = this.getStaffShiftOnDay(staffA, dayIdx2 + 1);
            const newPrevB_atDay1 = this.getStaffShiftOnDay(staffB, dayIdx - 1);
            const newNextB_atDay1 = this.getStaffShiftOnDay(staffB, dayIdx + 1);

            const newContinuityA = this.continuityScore(newPrevA_atDay2, shiftIdx2, newNextA_atDay2, numShifts);
            const newContinuityB = this.continuityScore(newPrevB_atDay1, shiftIdx, newNextB_atDay1, numShifts);

            const oldFairness = Math.pow(this.staffShiftCounts.get(staffA)![shiftIdx], 2)
              + Math.pow(this.staffShiftCounts.get(staffA)![shiftIdx2] || 0, 2)
              + Math.pow(this.staffShiftCounts.get(staffB)![shiftIdx2], 2)
              + Math.pow(this.staffShiftCounts.get(staffB)![shiftIdx] || 0, 2);

            const countsA = this.staffShiftCounts.get(staffA)!;
            const countsB = this.staffShiftCounts.get(staffB)!;
            const newFairness = Math.pow(countsA[shiftIdx] - 1, 2)
              + Math.pow((countsA[shiftIdx2] || 0) + 1, 2)
              + Math.pow(countsB[shiftIdx2] - 1, 2)
              + Math.pow((countsB[shiftIdx] || 0) + 1, 2);

            let categoryFairnessDelta = 0;
            if (this.config.balanceHolidays && this.holidayDays.size > 0) {
              const day1IsHol = this.isHoliday(dayIdx + 1);
              const day2IsHol = this.isHoliday(dayIdx2 + 1);
              const catMapA1 = day1IsHol ? this.staffHolidayShiftCounts : this.staffWeekdayShiftCounts;
              const catMapA2 = day2IsHol ? this.staffHolidayShiftCounts : this.staffWeekdayShiftCounts;
              const catMapB1 = day1IsHol ? this.staffHolidayShiftCounts : this.staffWeekdayShiftCounts;
              const catMapB2 = day2IsHol ? this.staffHolidayShiftCounts : this.staffWeekdayShiftCounts;

              const oldCatVar =
                this.shiftTypeVariance(catMapA1.get(staffA)!) +
                this.shiftTypeVariance(catMapA2.get(staffA)!) +
                this.shiftTypeVariance(catMapB1.get(staffB)!) +
                this.shiftTypeVariance(catMapB2.get(staffB)!);

              const simA1 = [...catMapA1.get(staffA)!];
              simA1[shiftIdx] = (simA1[shiftIdx] || 0) - 1;
              const simA2 = day1IsHol === day2IsHol ? [...simA1] : [...catMapA2.get(staffA)!];
              simA2[shiftIdx2] = (simA2[shiftIdx2] || 0) + 1;

              const simB2 = [...catMapB2.get(staffB)!];
              simB2[shiftIdx2] = (simB2[shiftIdx2] || 0) - 1;
              const simB1 = day1IsHol === day2IsHol ? [...simB2] : [...catMapB1.get(staffB)!];
              simB1[shiftIdx] = (simB1[shiftIdx] || 0) + 1;

              const newCatVar =
                this.shiftTypeVariance(simA1) +
                this.shiftTypeVariance(simA2) +
                this.shiftTypeVariance(simB1) +
                this.shiftTypeVariance(simB2);

              categoryFairnessDelta = (newCatVar - oldCatVar) * 8;
            }

            const fairnessDelta = (newFairness - oldFairness) * 5 + categoryFairnessDelta;

            const continuityBefore = currentContinuityA + currentContinuityB;
            const continuityAfter = newContinuityA + newContinuityB;
            const improvement = (continuityAfter - continuityBefore) - fairnessDelta;

            if (improvement > bestImprovement) {
              bestImprovement = improvement;
              bestSwapInfo = { dayIdx, shiftIdx, posA, staffA, dayIdx2, shiftIdx2, posB, staffB };
            }
          }
        }
      }

      if (bestSwapInfo && bestImprovement > 0) {
        const { dayIdx, shiftIdx, posA, staffA, dayIdx2, shiftIdx2, posB, staffB } = bestSwapInfo;
        this.schedule[dayIdx].shifts[shiftIdx][posA] = staffB;
        this.schedule[dayIdx2].shifts[shiftIdx2][posB] = staffA;

        this.removeStats(staffA, shiftIdx, dayIdx + 1);
        this.updateStats(staffA, shiftIdx2, dayIdx2 + 1);
        this.removeStats(staffB, shiftIdx2, dayIdx2 + 1);
        this.updateStats(staffB, shiftIdx, dayIdx + 1);
      } else {
        break;
      }
    }
  }

  private continuityScore(prevShift: number, currentShift: number, nextShift: number, numShifts: number): number {
    let score = 0;

    if (prevShift !== -1) {
      if (prevShift === currentShift) {
        score += 10;
      } else {
        const forwardDist = (currentShift - prevShift + numShifts) % numShifts;
        if (forwardDist === 1) {
          score += 3;
        } else {
          score -= 5;
        }
      }
    }

    if (nextShift !== -1) {
      if (nextShift === currentShift) {
        score += 10;
      } else {
        const forwardDist = (nextShift - currentShift + numShifts) % numShifts;
        if (forwardDist === 1) {
          score += 3;
        } else {
          score -= 5;
        }
      }
    }

    return score;
  }

  private checkConsecutiveRulesForSwap(member: StaffMember, dayIdx: number, shiftIdx: number): boolean {
    const date = dayIdx + 1;

    if (date > 1) {
      const prevDaySchedule = this.schedule[date - 2];
      for (const rule of this.config.consecutiveRules) {
        if (rule.to === shiftIdx) {
          if (prevDaySchedule.shifts[rule.from].includes(member.id)) {
            return false;
          }
        }
      }
    }

    if (date < this.daysInMonth) {
      const nextDaySchedule = this.schedule[date];
      for (const rule of this.config.consecutiveRules) {
        if (rule.from === shiftIdx) {
          if (nextDaySchedule.shifts[rule.to].includes(member.id)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private localRepair(maxIter: number) {
    for (let i = 0; i < maxIter; i++) {
      const staffIds = Array.from(this.staffWorkLoad.keys());
      if (staffIds.length < 2) break;

      staffIds.sort((a, b) => (this.staffWorkLoad.get(a) || 0) - (this.staffWorkLoad.get(b) || 0));
      const underLoadedId = staffIds[0];
      const overLoadedId = staffIds[staffIds.length - 1];
      const loadDiff = (this.staffWorkLoad.get(overLoadedId) || 0) - (this.staffWorkLoad.get(underLoadedId) || 0);

      if (loadDiff > 1) {
        if (this.trySwap(overLoadedId, underLoadedId)) continue;
      }

      let foundSwap = false;
      for (let sIdx = 0; sIdx < this.config.shiftNames.length; sIdx++) {
        const sortedByShift = [...staffIds].sort((a, b) =>
          (this.staffShiftCounts.get(a)![sIdx] || 0) - (this.staffShiftCounts.get(b)![sIdx] || 0)
        );

        const minShiftId = sortedByShift[0];
        const maxShiftId = sortedByShift[sortedByShift.length - 1];
        const maxVal = this.staffShiftCounts.get(maxShiftId)![sIdx] || 0;
        const minVal = this.staffShiftCounts.get(minShiftId)![sIdx] || 0;
        const shiftDiff = maxVal - minVal;

        if (shiftDiff > 1) {
          if (this.trySpecificShiftSwap(maxShiftId, minShiftId, sIdx)) {
            foundSwap = true;
            break;
          }
        }
      }

      if (this.config.balanceHolidays && this.holidayDays.size > 0) {
        const holSorted = [...staffIds].sort((a, b) => (this.staffHolidayLoad.get(a) || 0) - (this.staffHolidayLoad.get(b) || 0));
        const holMin = holSorted[0];
        const holMax = holSorted[holSorted.length - 1];
        const holDiff = (this.staffHolidayLoad.get(holMax) || 0) - (this.staffHolidayLoad.get(holMin) || 0);
        if (holDiff > 1) {
          if (this.tryHolidaySwap(holMax, holMin)) {
            foundSwap = true;
          }
        }

        for (let sIdx = 0; sIdx < this.config.shiftNames.length; sIdx++) {
          const sortedHol = [...staffIds].sort((a, b) =>
            (this.staffHolidayShiftCounts.get(a)![sIdx] || 0) - (this.staffHolidayShiftCounts.get(b)![sIdx] || 0)
          );
          const holShiftMin = sortedHol[0];
          const holShiftMax = sortedHol[sortedHol.length - 1];
          const holShiftDiff = (this.staffHolidayShiftCounts.get(holShiftMax)![sIdx] || 0) -
                               (this.staffHolidayShiftCounts.get(holShiftMin)![sIdx] || 0);
          if (holShiftDiff > 1) {
            if (this.tryCategoryShiftSwap(holShiftMax, holShiftMin, sIdx, true)) {
              foundSwap = true;
              break;
            }
          }
        }

        for (let sIdx = 0; sIdx < this.config.shiftNames.length; sIdx++) {
          const sortedWd = [...staffIds].sort((a, b) =>
            (this.staffWeekdayShiftCounts.get(a)![sIdx] || 0) - (this.staffWeekdayShiftCounts.get(b)![sIdx] || 0)
          );
          const wdShiftMin = sortedWd[0];
          const wdShiftMax = sortedWd[sortedWd.length - 1];
          const wdShiftDiff = (this.staffWeekdayShiftCounts.get(wdShiftMax)![sIdx] || 0) -
                              (this.staffWeekdayShiftCounts.get(wdShiftMin)![sIdx] || 0);
          if (wdShiftDiff > 1) {
            if (this.tryCategoryShiftSwap(wdShiftMax, wdShiftMin, sIdx, false)) {
              foundSwap = true;
              break;
            }
          }
        }
      }

      if (!foundSwap && loadDiff <= 1) break;
    }
  }

  private tryCategoryShiftSwap(fromId: string, toId: string, targetShiftIdx: number, isHolidayCategory: boolean): boolean {
    const fromMember = this.staffLookup.get(fromId);
    const toMember = this.staffLookup.get(toId);
    if (!fromMember || !toMember) return false;

    for (let dayIdx = 0; dayIdx < this.daysInMonth; dayIdx++) {
      const date = dayIdx + 1;
      const dayIsHoliday = this.isHoliday(date);
      if (dayIsHoliday !== isHolidayCategory) continue;

      const daySchedule = this.schedule[dayIdx];
      const assignedStaff = daySchedule.shifts[targetShiftIdx];
      const assignedIndex = assignedStaff.indexOf(fromId);
      if (assignedIndex === -1) continue;

      for (let dayIdx2 = 0; dayIdx2 < this.daysInMonth; dayIdx2++) {
        const date2 = dayIdx2 + 1;
        const day2IsHoliday = this.isHoliday(date2);
        if (day2IsHoliday !== isHolidayCategory) continue;

        const daySchedule2 = this.schedule[dayIdx2];
        for (let sIdx2 = 0; sIdx2 < this.config.shiftNames.length; sIdx2++) {
          if (dayIdx === dayIdx2 && sIdx2 === targetShiftIdx) continue;
          const assignedStaff2 = daySchedule2.shifts[sIdx2];
          const idx2 = assignedStaff2.indexOf(toId);
          if (idx2 === -1) continue;

          const tempAssigned1 = assignedStaff.filter(id => id !== fromId);
          const tempAssigned2 = assignedStaff2.filter(id => id !== toId);

          if (this.canAssign(toMember, date, targetShiftIdx, tempAssigned1) &&
              this.canAssign(fromMember, date2, sIdx2, tempAssigned2)) {

            daySchedule.shifts[targetShiftIdx][assignedIndex] = toId;
            daySchedule2.shifts[sIdx2][idx2] = fromId;

            this.removeStats(fromId, targetShiftIdx, date);
            this.updateStats(toId, targetShiftIdx, date);
            this.removeStats(toId, sIdx2, date2);
            this.updateStats(fromId, sIdx2, date2);

            return true;
          }
        }
      }
    }
    return false;
  }

  private tryHolidaySwap(fromId: string, toId: string): boolean {
    const fromMember = this.staffLookup.get(fromId);
    const toMember = this.staffLookup.get(toId);
    if (!fromMember || !toMember) return false;

    for (let dayIdx = 0; dayIdx < this.daysInMonth; dayIdx++) {
      const date = dayIdx + 1;
      if (!this.isHoliday(date)) continue;

      const daySchedule = this.schedule[dayIdx];
      for (let shiftIdx = 0; shiftIdx < this.config.shiftNames.length; shiftIdx++) {
        const assignedStaff = daySchedule.shifts[shiftIdx];
        const assignedIndex = assignedStaff.indexOf(fromId);
        if (assignedIndex === -1) continue;

        for (let dayIdx2 = 0; dayIdx2 < this.daysInMonth; dayIdx2++) {
          const date2 = dayIdx2 + 1;
          if (this.isHoliday(date2)) continue;

          const daySchedule2 = this.schedule[dayIdx2];
          for (let sIdx2 = 0; sIdx2 < this.config.shiftNames.length; sIdx2++) {
            const assignedStaff2 = daySchedule2.shifts[sIdx2];
            const idx2 = assignedStaff2.indexOf(toId);
            if (idx2 === -1) continue;

            const tempAssigned1 = assignedStaff.filter(id => id !== fromId);
            const tempAssigned2 = assignedStaff2.filter(id => id !== toId);

            if (this.canAssign(toMember, date, shiftIdx, tempAssigned1) &&
                this.canAssign(fromMember, date2, sIdx2, tempAssigned2)) {

              daySchedule.shifts[shiftIdx][assignedIndex] = toId;
              daySchedule2.shifts[sIdx2][idx2] = fromId;

              this.removeStats(fromId, shiftIdx, date);
              this.updateStats(toId, shiftIdx, date);
              this.removeStats(toId, sIdx2, date2);
              this.updateStats(fromId, sIdx2, date2);

              return true;
            }
          }
        }
      }
    }
    return false;
  }

  private trySpecificShiftSwap(fromId: string, toId: string, targetShiftIdx: number): boolean {
    const fromMember = this.staffLookup.get(fromId);
    const toMember = this.staffLookup.get(toId);
    if (!fromMember || !toMember) return false;

    for (let dayIdx = 0; dayIdx < this.daysInMonth; dayIdx++) {
      const daySchedule = this.schedule[dayIdx];
      const assignedStaff = daySchedule.shifts[targetShiftIdx];
      const assignedIndex = assignedStaff.indexOf(fromId);

      if (assignedIndex !== -1) {
        let alreadyWorking = false;
        for (let s = 0; s < daySchedule.shifts.length; s++) {
          if (daySchedule.shifts[s].includes(toId)) {
            alreadyWorking = true;
            break;
          }
        }
        if (alreadyWorking) continue;

        const fromLoad = this.staffWorkLoad.get(fromId) || 0;
        const toLoad = this.staffWorkLoad.get(toId) || 0;

        if (toLoad < fromLoad && this.canAssign(toMember, dayIdx + 1, targetShiftIdx, assignedStaff.filter(id => id !== fromId))) {
          daySchedule.shifts[targetShiftIdx][assignedIndex] = toId;
          this.removeStats(fromId, targetShiftIdx, dayIdx + 1);
          this.updateStats(toId, targetShiftIdx, dayIdx + 1);
          return true;
        }

        for (let dayIdx2 = 0; dayIdx2 < this.daysInMonth; dayIdx2++) {
          const daySchedule2 = this.schedule[dayIdx2];
          for (let sIdx2 = 0; sIdx2 < this.config.shiftNames.length; sIdx2++) {
            if (sIdx2 === targetShiftIdx) continue;
            const assignedStaff2 = daySchedule2.shifts[sIdx2];
            const idx2 = assignedStaff2.indexOf(toId);
            if (idx2 !== -1) {
              const tempAssigned1 = assignedStaff.filter(id => id !== fromId);
              const tempAssigned2 = assignedStaff2.filter(id => id !== toId);
              if (this.canAssign(toMember, dayIdx + 1, targetShiftIdx, tempAssigned1) &&
                  this.canAssign(fromMember, dayIdx2 + 1, sIdx2, tempAssigned2)) {

                daySchedule.shifts[targetShiftIdx][assignedIndex] = toId;
                daySchedule2.shifts[sIdx2][idx2] = fromId;

                this.removeStats(fromId, targetShiftIdx, dayIdx + 1);
                this.updateStats(toId, targetShiftIdx, dayIdx + 1);
                this.removeStats(toId, sIdx2, dayIdx2 + 1);
                this.updateStats(fromId, sIdx2, dayIdx2 + 1);

                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }

  private trySwap(fromId: string, toId: string): boolean {
    const fromMember = this.staffLookup.get(fromId);
    const toMember = this.staffLookup.get(toId);
    if (!fromMember || !toMember) return false;

    for (let dayIdx = 0; dayIdx < this.daysInMonth; dayIdx++) {
      const daySchedule = this.schedule[dayIdx];
      for (let shiftIdx = 0; shiftIdx < this.config.shiftNames.length; shiftIdx++) {
        const assignedStaff = daySchedule.shifts[shiftIdx];
        const assignedIndex = assignedStaff.indexOf(fromId);

        if (assignedIndex !== -1) {
          const tempAssigned = [...assignedStaff];
          tempAssigned.splice(assignedIndex, 1);

          if (this.canAssign(toMember, dayIdx + 1, shiftIdx, tempAssigned)) {
            daySchedule.shifts[shiftIdx][assignedIndex] = toId;

            this.removeStats(fromId, shiftIdx, dayIdx + 1);
            this.updateStats(toId, shiftIdx, dayIdx + 1);

            return true;
          }
        }
      }
    }
    return false;
  }

  private calculateMetrics() {
    let minLoad = Infinity;
    let maxLoad = -Infinity;

    const perStaff = this.staff.map(s => {
      const total = this.staffWorkLoad.get(s.id) || 0;
      minLoad = Math.min(minLoad, total);
      maxLoad = Math.max(maxLoad, total);

      const result: any = {
        name: s.name,
        total,
        byShift: this.staffShiftCounts.get(s.id) || []
      };

      if (this.config.balanceHolidays && this.holidayDays.size > 0) {
        result.holidayTotal = this.staffHolidayLoad.get(s.id) || 0;
        result.holidayByShift = this.staffHolidayShiftCounts.get(s.id) || [];
        result.weekdayTotal = this.staffWeekdayLoad.get(s.id) || 0;
        result.weekdayByShift = this.staffWeekdayShiftCounts.get(s.id) || [];
      }

      return result;
    });

    return {
      range: maxLoad - minLoad,
      perStaff
    };
  }
}
