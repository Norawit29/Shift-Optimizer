import type { StaffMember, SchedulerConfig, DaySchedule, OptimizerResult, UnfilledSlot } from "@shared/schema";
import { getDaysInMonth, differenceInCalendarDays, addDays, parseISO } from "date-fns";

export class ShiftOptimizer {
  private config: SchedulerConfig;
  private staff: StaffMember[];
  private month: number;
  private year: number;
  private daysInMonth: number;
  private schedule: DaySchedule[] = [];
  private rangeStartDate: Date | null = null;

  private staffWorkLoad: Map<string, number>;
  private staffShiftCounts: Map<string, number[]>;

  private holidayDays: Set<number>;
  private staffHolidayLoad: Map<string, number>;
  private staffHolidayShiftCounts: Map<string, number[]>;
  private staffWeekdayLoad: Map<string, number>;
  private staffWeekdayShiftCounts: Map<string, number[]>;

  private staffLookup: Map<string, StaffMember>;

  private getActualDate(dayIndex: number): Date {
    if (this.rangeStartDate) {
      return addDays(this.rangeStartDate, dayIndex - 1);
    }
    return new Date(this.year, this.month - 1, dayIndex);
  }

  constructor(config: SchedulerConfig, staff: StaffMember[], month: number, year: number) {
    this.config = config;
    this.staff = staff;
    this.month = month;
    this.year = year;

    if (config.useCustomRange && config.customStartDate && config.customEndDate) {
      const start = parseISO(config.customStartDate);
      const end = parseISO(config.customEndDate);
      this.rangeStartDate = start;
      this.daysInMonth = differenceInCalendarDays(end, start) + 1;
    } else {
      this.daysInMonth = getDaysInMonth(new Date(year, month - 1));
    }

    this.staffLookup = new Map();
    staff.forEach(s => this.staffLookup.set(s.id, s));

    this.holidayDays = new Set<number>();
    if (config.balanceHolidays || config.separateHolidayConfig) {
      for (let d = 1; d <= this.daysInMonth; d++) {
        const date = this.getActualDate(d);
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

  private getStaffPerShiftForDay(date: number): number[] {
    if (this.config.separateHolidayConfig && this.config.holidayStaffPerShift && this.isHoliday(date)) {
      return this.config.holidayStaffPerShift;
    }
    return this.config.staffPerShift;
  }

  private feasibilityMsg: string | null = null;
  private optimizeStartTime = 0;
  private readonly TIMEOUT_MS = 5 * 60 * 1000;

  private isTimedOut(): boolean {
    return Date.now() - this.optimizeStartTime > this.TIMEOUT_MS;
  }

  public optimize(): OptimizerResult {
    this.optimizeStartTime = Date.now();
    this.feasibilityMsg = this.checkFeasibility();

    let bestResult: OptimizerResult | null = null;
    let bestScore = Infinity;

    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (this.isTimedOut()) break;

      this.resetState();
      this.initializeSchedule();

      this.dayByDayFill(attempt > 0);

      this.gapFillRepair(3000);
      this.localRepair(5000);
      this.circadianRepair(3000);

      const unfilledCount = this.countUnfilled();
      const metrics = this.calculateMetrics();
      const score = this.evaluateSolutionQuality(metrics, unfilledCount);

      if (score < bestScore) {
        bestScore = score;
        bestResult = {
          schedule: JSON.parse(JSON.stringify(this.schedule)),
          metrics
        };
      }

      if (unfilledCount === 0 && score <= 1) break;
    }

    if (bestResult) {
      const unfilledSlots = this.findUnfilledSlots(bestResult.schedule);

      if (unfilledSlots.length > 0) {
        bestResult.isPartial = true;
        bestResult.unfilledSlots = unfilledSlots;
        bestResult.feasibilityWarning = this.feasibilityMsg || undefined;
      }
      return bestResult;
    }

    return this.buildPartialResult();
  }

  private countUnfilled(): number {
    let count = 0;
    for (let dayIdx = 0; dayIdx < this.daysInMonth; dayIdx++) {
      for (let shiftIdx = 0; shiftIdx < this.config.shiftNames.length; shiftIdx++) {
        const required = this.getStaffPerShiftForDay(dayIdx + 1)[shiftIdx];
        const arr = this.schedule[dayIdx].shifts[shiftIdx];
        const filled = arr.filter(id => id !== "").length;
        count += Math.max(0, required - filled);
      }
    }
    return count;
  }

  private checkFeasibility(): string | null {
    for (let day = 1; day <= this.daysInMonth; day++) {
      const dayStaffPerShift = this.getStaffPerShiftForDay(day);
      for (let shiftIdx = 0; shiftIdx < this.config.shiftNames.length; shiftIdx++) {
        const required = dayStaffPerShift[shiftIdx];
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

    const weekdaySlots = this.config.staffPerShift.reduce((a, b) => a + b, 0);
    const holidaySlots = this.config.separateHolidayConfig && this.config.holidayStaffPerShift
      ? this.config.holidayStaffPerShift.reduce((a, b) => a + b, 0)
      : weekdaySlots;
    const totalSlotsPerDay = Math.max(weekdaySlots, holidaySlots);
    if (totalSlotsPerDay > this.staff.length) {
      return `Each day requires ${totalSlotsPerDay} staff slots but only ${this.staff.length} staff members exist. ` +
        `Please add more staff or reduce staff per shift.`;
    }

    return null;
  }

  private dayByDayFill(randomize: boolean): void {
    const numShifts = this.config.shiftNames.length;
    const dayOrder = this.computeDayOrder(randomize);

    for (const dayIdx of dayOrder) {
      const date = dayIdx + 1;
      const staffPerShift = this.getStaffPerShiftForDay(date);

      for (let s = 0; s < numShifts; s++) {
        const required = staffPerShift[s];
        while (this.schedule[dayIdx].shifts[s].length < required) {
          this.schedule[dayIdx].shifts[s].push("");
        }
      }

      const activeShifts: number[] = [];
      for (let s = 0; s < numShifts; s++) {
        if (staffPerShift[s] > 0) activeShifts.push(s);
      }
      if (activeShifts.length === 0) continue;

      const isEligibleForShift = (member: StaffMember, s: number): boolean => {
        const load = this.staffWorkLoad.get(member.id) || 0;
        if (load >= member.maxShifts) return false;
        for (let si = 0; si < numShifts; si++) {
          if (this.schedule[dayIdx].shifts[si].includes(member.id)) return false;
        }
        if (member.blocked.some(b => b.date === date && (b.shift === -1 || b.shift === s))) return false;
        if (dayIdx > 0) {
          for (const rule of this.config.consecutiveRules) {
            if (rule.to === s && this.schedule[dayIdx - 1].shifts[rule.from].includes(member.id)) return false;
          }
        }
        if (dayIdx < this.daysInMonth - 1) {
          for (const rule of this.config.consecutiveRules) {
            if (rule.from === s && this.schedule[dayIdx + 1].shifts[rule.to].includes(member.id)) return false;
          }
        }
        return true;
      };

      const assignedToday = new Set<string>();
      let anyAssigned = true;

      while (anyAssigned) {
        anyAssigned = false;

        const shiftsNeedingFill = activeShifts.filter(s => {
          const filled = this.schedule[dayIdx].shifts[s].filter(id => id !== "").length;
          return filled < staffPerShift[s];
        });

        if (shiftsNeedingFill.length === 0) break;

        shiftsNeedingFill.sort((a, b) => {
          const eligA = this.staff.filter(m => !assignedToday.has(m.id) && isEligibleForShift(m, a)).length;
          const eligB = this.staff.filter(m => !assignedToday.has(m.id) && isEligibleForShift(m, b)).length;
          const needA = staffPerShift[a] - this.schedule[dayIdx].shifts[a].filter(id => id !== "").length;
          const needB = staffPerShift[b] - this.schedule[dayIdx].shifts[b].filter(id => id !== "").length;
          const ratioA = needA > 0 ? eligA / needA : Infinity;
          const ratioB = needB > 0 ? eligB / needB : Infinity;
          if (ratioA !== ratioB) return ratioA - ratioB;
          return needB - needA;
        });

        for (const shiftIdx of shiftsNeedingFill) {
          const filled = this.schedule[dayIdx].shifts[shiftIdx].filter(id => id !== "").length;
          if (filled >= staffPerShift[shiftIdx]) continue;

          const candidates = this.staff.filter(m =>
            !assignedToday.has(m.id) && isEligibleForShift(m, shiftIdx)
          );
          if (candidates.length === 0) continue;

          candidates.sort((a, b) => {
            const loadA = this.staffWorkLoad.get(a.id) || 0;
            const loadB = this.staffWorkLoad.get(b.id) || 0;
            if (loadA !== loadB) return loadA - loadB;
            const countA = this.staffShiftCounts.get(a.id)![shiftIdx] || 0;
            const countB = this.staffShiftCounts.get(b.id)![shiftIdx] || 0;
            if (countA !== countB) return countA - countB;
            if (this.config.balanceHolidays && this.isHoliday(date)) {
              const holA = this.staffHolidayLoad.get(a.id) || 0;
              const holB = this.staffHolidayLoad.get(b.id) || 0;
              if (holA !== holB) return holA - holB;
            }
            return 0;
          });

          if (randomize && candidates.length > 1) {
            const topLoad = this.staffWorkLoad.get(candidates[0].id) || 0;
            let groupEnd = 1;
            while (groupEnd < candidates.length &&
                   (this.staffWorkLoad.get(candidates[groupEnd].id) || 0) <= topLoad + 2) {
              groupEnd++;
            }
            for (let i = groupEnd - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
            }
          }

          const emptyPos = this.schedule[dayIdx].shifts[shiftIdx].indexOf("");
          if (emptyPos !== -1) {
            this.schedule[dayIdx].shifts[shiftIdx][emptyPos] = candidates[0].id;
            this.updateStats(candidates[0].id, shiftIdx, date);
            assignedToday.add(candidates[0].id);
            anyAssigned = true;
          }
        }
      }
    }
  }

  private computeDayOrder(randomize: boolean): number[] {
    const days = Array.from({ length: this.daysInMonth }, (_, i) => i);
    if (!randomize) return days;

    for (let i = days.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [days[i], days[j]] = [days[j], days[i]];
    }
    return days;
  }

  private canAssignHard(member: StaffMember, dayIdx: number, shiftIdx: number): boolean {
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

  private buildPartialResult(): OptimizerResult {
    this.resetState();
    this.initializeSchedule();

    this.dayByDayFill(false);

    this.gapFillRepair(3000);
    this.localRepair(2000);
    this.circadianRepair(2000);

    const unfilledSlots = this.findUnfilledSlots();
    const metrics = this.calculateMetrics();

    return {
      schedule: JSON.parse(JSON.stringify(this.schedule)),
      metrics,
      isPartial: unfilledSlots.length > 0,
      unfilledSlots: unfilledSlots.length > 0 ? unfilledSlots : undefined,
      feasibilityWarning: this.feasibilityMsg || undefined,
    };
  }

  private findUnfilledSlots(targetSchedule?: DaySchedule[]): UnfilledSlot[] {
    const sched = targetSchedule || this.schedule;
    const unfilled: UnfilledSlot[] = [];
    for (let dayIdx = 0; dayIdx < this.daysInMonth; dayIdx++) {
      for (let shiftIdx = 0; shiftIdx < this.config.shiftNames.length; shiftIdx++) {
        const required = this.getStaffPerShiftForDay(dayIdx + 1)[shiftIdx];
        const shiftArray = sched[dayIdx]?.shifts?.[shiftIdx];
        const filledCount = shiftArray ? shiftArray.filter(id => id !== "").length : 0;
        if (filledCount < required) {
          unfilled.push({
            date: dayIdx + 1,
            shiftIdx,
            shiftName: this.config.shiftNames[shiftIdx],
            required,
            assigned: filledCount,
          });
        }
      }
    }
    return unfilled;
  }

  private evaluateSolutionQuality(metrics: any, unfilledCount: number = 0): number {
    let score = unfilledCount * 100;

    score += metrics.range * 5;

    for (const ps of metrics.perStaff) {
      const counts = ps.byShift as number[];
      const variance = this.shiftTypeVariance(counts);
      score += variance;
    }
    return score;
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
        if (!staffA) continue;

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
            if (!staffB || staffA === staffB) continue;

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

  private gapFillRepair(maxIter: number) {
    for (let iter = 0; iter < maxIter; iter++) {
      if (this.isTimedOut()) break;
      let filledAny = false;

      for (let dayIdx = 0; dayIdx < this.daysInMonth; dayIdx++) {
        for (let shiftIdx = 0; shiftIdx < this.config.shiftNames.length; shiftIdx++) {
          const required = this.getStaffPerShiftForDay(dayIdx + 1)[shiftIdx];
          const arr = this.schedule[dayIdx].shifts[shiftIdx];
          while (arr.length < required) arr.push("");

          for (let pos = 0; pos < required; pos++) {
            if (arr[pos] !== "") continue;

            const candidates = this.staff.filter(m => this.canAssignHard(m, dayIdx, shiftIdx));
            if (candidates.length > 0) {
              candidates.sort((a, b) => {
                const loadA = this.staffWorkLoad.get(a.id) || 0;
                const loadB = this.staffWorkLoad.get(b.id) || 0;
                if (loadA !== loadB) return loadA - loadB;
                const cA = this.staffShiftCounts.get(a.id)![shiftIdx] || 0;
                const cB = this.staffShiftCounts.get(b.id)![shiftIdx] || 0;
                return cA - cB;
              });
              arr[pos] = candidates[0].id;
              this.updateStats(candidates[0].id, shiftIdx, dayIdx + 1);
              filledAny = true;
              continue;
            }

            if (this.trySwapToFillGap(dayIdx, shiftIdx, pos)) {
              filledAny = true;
            }
          }
        }
      }

      if (!filledAny) break;
    }
  }

  private trySwapToFillGap(gapDayIdx: number, gapShiftIdx: number, gapPos: number): boolean {
    const numShifts = this.config.shiftNames.length;

    for (let otherShift = 0; otherShift < numShifts; otherShift++) {
      if (otherShift === gapShiftIdx) continue;
      const otherAssigned = this.schedule[gapDayIdx].shifts[otherShift];

      for (let pos = 0; pos < otherAssigned.length; pos++) {
        const staffId = otherAssigned[pos];
        if (!staffId) continue;

        const member = this.staffLookup.get(staffId)!;
        if (member.blocked.some(b => b.date === gapDayIdx + 1 && (b.shift === -1 || b.shift === gapShiftIdx))) continue;
        if (!this.checkConsecutiveRulesForSwap(member, gapDayIdx, gapShiftIdx)) continue;

        const replacements = this.staff.filter(m =>
          m.id !== staffId && this.canAssignHard(m, gapDayIdx, otherShift)
        );

        if (replacements.length > 0) {
          replacements.sort((a, b) =>
            (this.staffWorkLoad.get(a.id) || 0) - (this.staffWorkLoad.get(b.id) || 0)
          );

          this.removeStats(staffId, otherShift, gapDayIdx + 1);
          otherAssigned[pos] = replacements[0].id;
          this.updateStats(replacements[0].id, otherShift, gapDayIdx + 1);

          this.schedule[gapDayIdx].shifts[gapShiftIdx][gapPos] = staffId;
          this.updateStats(staffId, gapShiftIdx, gapDayIdx + 1);
          return true;
        }
      }
    }

    for (let nearDay = Math.max(0, gapDayIdx - 5); nearDay <= Math.min(this.daysInMonth - 1, gapDayIdx + 5); nearDay++) {
      if (nearDay === gapDayIdx) continue;

      for (let s = 0; s < numShifts; s++) {
        const nearAssigned = this.schedule[nearDay].shifts[s];
        for (let pos = 0; pos < nearAssigned.length; pos++) {
          const candidateId = nearAssigned[pos];
          if (!candidateId) continue;

          const candidateMember = this.staffLookup.get(candidateId)!;
          if (!this.canMoveToSlot(candidateMember, gapDayIdx, gapShiftIdx)) continue;

          const replacements = this.staff.filter(m =>
            m.id !== candidateId && this.canAssignHard(m, nearDay, s)
          );

          if (replacements.length > 0) {
            replacements.sort((a, b) =>
              (this.staffWorkLoad.get(a.id) || 0) - (this.staffWorkLoad.get(b.id) || 0)
            );

            this.removeStats(candidateId, s, nearDay + 1);
            nearAssigned[pos] = replacements[0].id;
            this.updateStats(replacements[0].id, s, nearDay + 1);

            this.schedule[gapDayIdx].shifts[gapShiftIdx][gapPos] = candidateId;
            this.updateStats(candidateId, gapShiftIdx, gapDayIdx + 1);
            return true;
          }
        }
      }
    }

    return false;
  }

  private canMoveToSlot(member: StaffMember, dayIdx: number, shiftIdx: number): boolean {
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
          if (prevDaySchedule.shifts[rule.from].includes(member.id)) return false;
        }
      }
    }

    if (dayIdx < this.daysInMonth - 1) {
      const nextDaySchedule = this.schedule[dayIdx + 1];
      for (const rule of this.config.consecutiveRules) {
        if (rule.from === shiftIdx) {
          if (nextDaySchedule.shifts[rule.to].includes(member.id)) return false;
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
