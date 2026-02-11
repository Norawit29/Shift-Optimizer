import type { StaffMember, SchedulerConfig, DaySchedule, OptimizerResult } from "@shared/schema";
import { getDaysInMonth } from "date-fns";

interface FillStrategy {
  order: "forward" | "reverse" | "random" | "hardest-first" | "weekday-first" | "holiday-first";
  scoring: "balanced" | "greedy-load" | "random-biased" | "minimal";
  staffShuffle: boolean;
}

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
    const infeasible = this.checkFeasibility();
    if (infeasible) {
      throw new Error(infeasible);
    }

    let bestResult: OptimizerResult | null = null;
    let bestScore = Infinity;

    const maxAttempts = 500;
    const strategies = this.generateStrategies(maxAttempts);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        this.resetState();
        this.initializeSchedule();

        const strategy = strategies[attempt % strategies.length];
        this.fillAllShiftsWithStrategy(strategy);

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
      const originalMaxShifts = this.staff.map(s => s.maxShifts);

      this.staff.forEach(s => {
        s.maxShifts = s.maxShifts + relaxLevel;
      });

      const strategies = this.generateStrategies(200);

      for (let attempt = 0; attempt < 200; attempt++) {
        try {
          this.resetState();
          this.initializeSchedule();

          const strategy = strategies[attempt % strategies.length];
          this.fillAllShiftsWithStrategy(strategy);

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

  private generateStrategies(count: number): FillStrategy[] {
    const strategies: FillStrategy[] = [];

    const orders: FillStrategy["order"][] = ["hardest-first", "forward", "reverse", "random", "weekday-first", "holiday-first"];
    const scorings: FillStrategy["scoring"][] = ["balanced", "greedy-load", "random-biased", "minimal"];

    for (let i = 0; i < count; i++) {
      let order: FillStrategy["order"];
      const r = Math.random();
      if (r < 0.50) {
        order = "hardest-first";
      } else if (r < 0.65) {
        order = "random";
      } else if (r < 0.75) {
        order = "forward";
      } else if (r < 0.85) {
        order = "reverse";
      } else if (r < 0.92) {
        order = "weekday-first";
      } else {
        order = "holiday-first";
      }

      const scoring = scorings[Math.floor(Math.random() * scorings.length)];
      const staffShuffle = Math.random() < 0.5;

      strategies.push({ order, scoring, staffShuffle });
    }

    strategies[0] = { order: "hardest-first", scoring: "balanced", staffShuffle: false };
    strategies[1] = { order: "hardest-first", scoring: "greedy-load", staffShuffle: false };
    strategies[2] = { order: "forward", scoring: "balanced", staffShuffle: false };
    strategies[3] = { order: "hardest-first", scoring: "random-biased", staffShuffle: true };

    return strategies;
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

  private getDayOrder(strategy: FillStrategy): number[] {
    const days = Array.from({ length: this.daysInMonth }, (_, i) => i);

    switch (strategy.order) {
      case "forward":
        return days;
      case "reverse":
        return days.reverse();
      case "random":
        return this.shuffleArray(days);
      case "hardest-first":
        return this.sortDaysByDifficulty(days);
      case "weekday-first": {
        const weekdays = days.filter(d => !this.isHoliday(d + 1));
        const holidays = days.filter(d => this.isHoliday(d + 1));
        return [...this.shuffleArray(weekdays), ...this.shuffleArray(holidays)];
      }
      case "holiday-first": {
        const weekdays2 = days.filter(d => !this.isHoliday(d + 1));
        const holidays2 = days.filter(d => this.isHoliday(d + 1));
        return [...this.shuffleArray(holidays2), ...this.shuffleArray(weekdays2)];
      }
      default:
        return days;
    }
  }

  private sortDaysByDifficulty(days: number[]): number[] {
    const difficulty = days.map(dayIdx => {
      const date = dayIdx + 1;
      let totalUnavailable = 0;

      for (let shiftIdx = 0; shiftIdx < this.config.shiftNames.length; shiftIdx++) {
        const required = this.config.staffPerShift[shiftIdx];
        let unavailableForShift = 0;

        for (const member of this.staff) {
          const isBlocked = member.blocked.some(b => b.date === date && (b.shift === -1 || b.shift === shiftIdx));
          if (isBlocked) unavailableForShift++;
        }

        totalUnavailable += unavailableForShift * required;
      }

      return { dayIdx, totalUnavailable };
    });

    difficulty.sort((a, b) => b.totalUnavailable - a.totalUnavailable);
    return difficulty.map(d => d.dayIdx);
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

  private fillAllShiftsWithStrategy(strategy: FillStrategy) {
    const dayOrder = this.getDayOrder(strategy);
    const maxBacktracks = 5000;
    let backtracks = 0;

    const filledDays = new Set<number>();
    let orderIdx = 0;

    while (orderIdx < dayOrder.length) {
      const dayIdx = dayOrder[orderIdx];

      const success = this.fillDayShifts(dayIdx, strategy);

      if (success) {
        filledDays.add(dayIdx);
        orderIdx++;
      } else {
        if (backtracks >= maxBacktracks) {
          throw new Error(`Backtrack limit reached at Day ${dayIdx + 1}.`);
        }

        const clearCount = Math.min(
          Math.max(1, Math.floor(Math.random() * Math.min(5, orderIdx))),
          orderIdx
        );

        for (let c = 0; c < clearCount && orderIdx > 0; c++) {
          orderIdx--;
          const prevDayIdx = dayOrder[orderIdx];
          this.clearDay(prevDayIdx);
          filledDays.delete(prevDayIdx);
          backtracks++;
        }

        if (orderIdx === 0 && !success) {
          throw new Error(`Cannot fill Day ${dayIdx + 1}. No solution found.`);
        }
      }
    }
  }

  private fillDayShifts(dayIdx: number, strategy: FillStrategy): boolean {
    const daySchedule = this.schedule[dayIdx];

    for (let si = 0; si < daySchedule.shifts.length; si++) {
      daySchedule.shifts[si] = [];
    }

    const shiftOrder = this.getShiftFillOrder(dayIdx);

    for (const shiftIdx of shiftOrder) {
      const requiredStaff = this.config.staffPerShift[shiftIdx];

      for (let k = 0; k < requiredStaff; k++) {
        const candidate = this.selectBestCandidate(dayIdx + 1, shiftIdx, daySchedule.shifts[shiftIdx], strategy);

        if (candidate) {
          daySchedule.shifts[shiftIdx].push(candidate.id);
          this.updateStats(candidate.id, shiftIdx, dayIdx + 1);
        } else {
          for (let si = 0; si < daySchedule.shifts.length; si++) {
            for (const staffId of daySchedule.shifts[si]) {
              this.removeStats(staffId, si, dayIdx + 1);
            }
            daySchedule.shifts[si] = [];
          }
          return false;
        }
      }
    }
    return true;
  }

  private getShiftFillOrder(dayIdx: number): number[] {
    const date = dayIdx + 1;
    const indices = Array.from({ length: this.config.shiftNames.length }, (_, i) => i);

    const scored = indices.map(shiftIdx => {
      const required = this.config.staffPerShift[shiftIdx];
      let available = 0;
      for (const member of this.staff) {
        const isBlocked = member.blocked.some(b => b.date === date && (b.shift === -1 || b.shift === shiftIdx));
        if (!isBlocked && (this.staffWorkLoad.get(member.id) || 0) < member.maxShifts) {
          available++;
        }
      }
      return { shiftIdx, slack: available - required };
    });

    scored.sort((a, b) => a.slack - b.slack);
    return scored.map(s => s.shiftIdx);
  }

  private clearDay(dayIdx: number) {
    const daySchedule = this.schedule[dayIdx];
    for (let si = 0; si < daySchedule.shifts.length; si++) {
      for (const staffId of daySchedule.shifts[si]) {
        this.removeStats(staffId, si, dayIdx + 1);
      }
      daySchedule.shifts[si] = [];
    }
  }

  private selectBestCandidate(date: number, shiftIdx: number, currentAssigned: string[], strategy: FillStrategy): StaffMember | null {
    let staffList = this.staff;
    if (strategy.staffShuffle) {
      staffList = this.shuffleArray([...this.staff]);
    }

    const candidates: { member: StaffMember; score: number }[] = [];

    for (const member of staffList) {
      if (!this.canAssign(member, date, shiftIdx, currentAssigned)) {
        continue;
      }
      const score = this.calculateScore(member, shiftIdx, date, strategy.scoring);
      candidates.push({ member, score });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => a.score - b.score);

    if (strategy.scoring === "random-biased" || strategy.scoring === "minimal") {
      const topN = Math.min(Math.max(3, Math.ceil(candidates.length * 0.4)), candidates.length);
      const idx = Math.floor(Math.random() * topN);
      return candidates[idx].member;
    }

    const bestScore = candidates[0].score;
    const topCandidates = candidates.filter(c => c.score <= bestScore + 0.5);
    const chosen = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    return chosen.member;
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
          const nextShiftAssigned = nextDaySchedule.shifts[rule.to];
          if (nextShiftAssigned.length >= this.config.staffPerShift[rule.to] && nextShiftAssigned.includes(member.id)) {
            return false;
          }
        }
      }
    }

    return true;
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

  private calculateScore(member: StaffMember, shiftIdx: number, date: number, scoring: string): number {
    if (scoring === "minimal") {
      const totalCount = this.staffWorkLoad.get(member.id) || 0;
      return totalCount + Math.random() * 2;
    }

    const totalCount = this.staffWorkLoad.get(member.id) || 0;
    const shiftCounts = this.staffShiftCounts.get(member.id) || [];
    const specificShiftCount = shiftCounts[shiftIdx] || 0;

    let score: number;

    if (scoring === "greedy-load") {
      score = (Math.pow(totalCount, 2) * 40) + (Math.pow(specificShiftCount, 2) * 60);
    } else if (scoring === "random-biased") {
      score = (Math.pow(totalCount, 2) * 10) + (Math.pow(specificShiftCount, 2) * 30) + Math.random() * 20;
    } else {
      score = (Math.pow(totalCount, 2) * 20) + (Math.pow(specificShiftCount, 2) * 100);
    }

    if (this.config.balanceHolidays && this.holidayDays.size > 0) {
      const holiday = this.isHoliday(date);
      if (holiday) {
        const holLoad = this.staffHolidayLoad.get(member.id) || 0;
        const holShiftCounts = this.staffHolidayShiftCounts.get(member.id) || [];
        const holSpecific = holShiftCounts[shiftIdx] || 0;
        score += (Math.pow(holLoad, 2) * 30) + (Math.pow(holSpecific, 2) * 80);

        const simCounts = [...holShiftCounts];
        simCounts[shiftIdx] = (simCounts[shiftIdx] || 0) + 1;
        score += this.shiftTypeVariance(simCounts) * 120;
      } else {
        const wdLoad = this.staffWeekdayLoad.get(member.id) || 0;
        const wdShiftCounts = this.staffWeekdayShiftCounts.get(member.id) || [];
        const wdSpecific = wdShiftCounts[shiftIdx] || 0;
        score += (Math.pow(wdLoad, 2) * 30) + (Math.pow(wdSpecific, 2) * 80);

        const simCounts = [...wdShiftCounts];
        simCounts[shiftIdx] = (simCounts[shiftIdx] || 0) + 1;
        score += this.shiftTypeVariance(simCounts) * 120;
      }
    }

    if (scoring !== "greedy-load") {
      const dayIdx = date - 1;
      const numShiftTypes = this.config.shiftNames.length;

      if (dayIdx > 0) {
        const prevShift = this.getStaffShiftOnDay(member.id, dayIdx - 1);

        if (prevShift !== -1) {
          if (prevShift === shiftIdx) {
            score -= 50;
          } else {
            const forwardDist = (shiftIdx - prevShift + numShiftTypes) % numShiftTypes;
            if (forwardDist === 1) {
              score -= 15;
            } else {
              score += 25;
            }
          }
        }

        if (dayIdx > 1) {
          const prevPrevShift = this.getStaffShiftOnDay(member.id, dayIdx - 2);
          if (prevPrevShift !== -1 && prevPrevShift === shiftIdx) {
            const prevShiftAgain = this.getStaffShiftOnDay(member.id, dayIdx - 1);
            if (prevShiftAgain === shiftIdx) {
              score -= 30;
            }
          }
        }
      }
    }

    return score;
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

            if (!this.checkConsecutiveRulesForSwap(memberB, dayIdx, shiftIdx, staffA)) continue;
            if (!this.checkConsecutiveRulesForSwap(memberA, dayIdx2, shiftIdx2, staffB)) continue;

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

  private checkConsecutiveRulesForSwap(member: StaffMember, dayIdx: number, shiftIdx: number, _excludeStaffId?: string): boolean {
    const date = dayIdx + 1;

    if (date > 1) {
      const prevDaySchedule = this.schedule[date - 2];
      for (const rule of this.config.consecutiveRules) {
        if (rule.to === shiftIdx) {
          const prevAssigned = prevDaySchedule.shifts[rule.from];
          if (prevAssigned.includes(member.id)) {
            return false;
          }
        }
      }
    }

    if (date < this.daysInMonth) {
      const nextDaySchedule = this.schedule[date];
      for (const rule of this.config.consecutiveRules) {
        if (rule.from === shiftIdx) {
          const nextAssigned = nextDaySchedule.shifts[rule.to];
          if (nextAssigned.includes(member.id)) {
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
