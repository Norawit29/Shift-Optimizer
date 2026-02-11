import type { StaffMember, SchedulerConfig, DaySchedule, OptimizerResult, UnfilledSlot } from "@shared/schema";
import { getDaysInMonth, differenceInCalendarDays, addDays, parseISO } from "date-fns";

let solverInstance: any = null;
let solverLoading: Promise<any> | null = null;

async function getSolver(): Promise<any> {
  if (solverInstance) return solverInstance;
  if (solverLoading) return solverLoading;

  solverLoading = (async () => {
    const highs_loader = (await import("highs")).default;
    const solver = await highs_loader({
      locateFile: (file: string) => `/${file}`
    });
    solverInstance = solver;
    return solver;
  })();

  return solverLoading;
}

export class ShiftOptimizer {
  private config: SchedulerConfig;
  private staff: StaffMember[];
  private month: number;
  private year: number;
  private daysInMonth: number;
  private rangeStartDate: Date | null = null;

  private holidayDays: Set<number>;

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

  private isBlocked(staffIdx: number, dayIdx: number, shiftIdx: number): boolean {
    const member = this.staff[staffIdx];
    const date = dayIdx + 1;
    return member.blocked.some(b => b.date === date && (b.shift === -1 || b.shift === shiftIdx));
  }

  private varName(staffIdx: number, dayIdx: number, shiftIdx: number): string {
    return `x${staffIdx}d${dayIdx}s${shiftIdx}`;
  }

  private buildLPModel(): { model: string; varMap: Map<string, { staff: number; day: number; shift: number }> } {
    const N = this.staff.length;
    const D = this.daysInMonth;
    const S = this.config.shiftNames.length;

    const varMap = new Map<string, { staff: number; day: number; shift: number }>();
    const eligibleVars: string[][][] = [];

    for (let i = 0; i < N; i++) {
      eligibleVars[i] = [];
      for (let d = 0; d < D; d++) {
        eligibleVars[i][d] = [];
        for (let s = 0; s < S; s++) {
          if (this.isBlocked(i, d, s)) continue;
          const required = this.getStaffPerShiftForDay(d + 1)[s];
          if (required === 0) continue;
          const v = this.varName(i, d, s);
          eligibleVars[i][d].push(v);
          varMap.set(v, { staff: i, day: d, shift: s });
        }
      }
    }

    const totalSlots = Array.from(varMap.keys()).length;
    if (totalSlots === 0) {
      return { model: "", varMap };
    }

    const lines: string[] = [];
    const constraints: string[] = [];
    const binaryVars: string[] = Array.from(varMap.keys());

    const COVERAGE_W = 1000;
    const FAIRNESS_W = 5;
    const SHIFT_BALANCE_W = 2;
    const HOLIDAY_BALANCE_W = this.config.balanceHolidays ? 3 : 0;

    const objTerms: string[] = [];
    for (const v of binaryVars) {
      objTerms.push(`${COVERAGE_W} ${v}`);
    }
    objTerms.push(`${FAIRNESS_W} wmin`);
    objTerms.push(`- ${FAIRNESS_W} wmax`);

    for (let s = 0; s < S; s++) {
      objTerms.push(`${SHIFT_BALANCE_W} smin${s}`);
      objTerms.push(`- ${SHIFT_BALANCE_W} smax${s}`);
    }

    if (HOLIDAY_BALANCE_W > 0) {
      objTerms.push(`${HOLIDAY_BALANCE_W} hmin`);
      objTerms.push(`- ${HOLIDAY_BALANCE_W} hmax`);
    }

    lines.push("Maximize");
    lines.push("  obj: " + objTerms.join(" + ").replace(/\+ -/g, "- "));

    lines.push("Subject To");

    let cIdx = 0;

    for (let i = 0; i < N; i++) {
      for (let d = 0; d < D; d++) {
        const dayVars: string[] = [];
        for (let s = 0; s < S; s++) {
          const v = this.varName(i, d, s);
          if (varMap.has(v)) dayVars.push(v);
        }
        if (dayVars.length > 1) {
          constraints.push(`  c${cIdx++}: ${dayVars.join(" + ")} <= 1`);
        }
      }
    }

    for (let d = 0; d < D; d++) {
      const required = this.getStaffPerShiftForDay(d + 1);
      for (let s = 0; s < S; s++) {
        if (required[s] === 0) continue;
        const shiftVars: string[] = [];
        for (let i = 0; i < N; i++) {
          const v = this.varName(i, d, s);
          if (varMap.has(v)) shiftVars.push(v);
        }
        if (shiftVars.length > 0) {
          constraints.push(`  c${cIdx++}: ${shiftVars.join(" + ")} <= ${required[s]}`);
        }
      }
    }

    for (const rule of this.config.consecutiveRules) {
      for (let i = 0; i < N; i++) {
        for (let d = 0; d < D - 1; d++) {
          const v1 = this.varName(i, d, rule.from);
          const v2 = this.varName(i, d + 1, rule.to);
          if (varMap.has(v1) && varMap.has(v2)) {
            constraints.push(`  c${cIdx++}: ${v1} + ${v2} <= 1`);
          }
        }
      }
    }

    for (let i = 0; i < N; i++) {
      const maxShifts = this.staff[i].maxShifts;
      const staffVars: string[] = [];
      for (let d = 0; d < D; d++) {
        for (let s = 0; s < S; s++) {
          const v = this.varName(i, d, s);
          if (varMap.has(v)) staffVars.push(v);
        }
      }
      if (staffVars.length > 0) {
        constraints.push(`  c${cIdx++}: ${staffVars.join(" + ")} <= ${maxShifts}`);
      }
    }

    for (let i = 0; i < N; i++) {
      const staffVars: string[] = [];
      for (let d = 0; d < D; d++) {
        for (let s = 0; s < S; s++) {
          const v = this.varName(i, d, s);
          if (varMap.has(v)) staffVars.push(v);
        }
      }
      if (staffVars.length > 0) {
        const neg = staffVars.join(" - ");
        constraints.push(`  c${cIdx++}: wmax - ${neg} >= 0`);
        constraints.push(`  c${cIdx++}: wmin - ${neg} <= 0`);
      }
    }

    for (let s = 0; s < S; s++) {
      for (let i = 0; i < N; i++) {
        const shiftVars: string[] = [];
        for (let d = 0; d < D; d++) {
          const v = this.varName(i, d, s);
          if (varMap.has(v)) shiftVars.push(v);
        }
        if (shiftVars.length > 0) {
          const neg = shiftVars.join(" - ");
          constraints.push(`  c${cIdx++}: smax${s} - ${neg} >= 0`);
          constraints.push(`  c${cIdx++}: smin${s} - ${neg} <= 0`);
        }
      }
    }

    if (HOLIDAY_BALANCE_W > 0 && this.holidayDays.size > 0) {
      for (let i = 0; i < N; i++) {
        const holVars: string[] = [];
        for (let d = 0; d < D; d++) {
          if (!this.isHoliday(d + 1)) continue;
          for (let s = 0; s < S; s++) {
            const v = this.varName(i, d, s);
            if (varMap.has(v)) holVars.push(v);
          }
        }
        if (holVars.length > 0) {
          const neg = holVars.join(" - ");
          constraints.push(`  c${cIdx++}: hmax - ${neg} >= 0`);
          constraints.push(`  c${cIdx++}: hmin - ${neg} <= 0`);
        }
      }
    }

    for (const c of constraints) {
      lines.push(c);
    }

    lines.push("Bounds");

    let totalRequired = 0;
    for (let d = 0; d < D; d++) {
      const req = this.getStaffPerShiftForDay(d + 1);
      for (let s = 0; s < S; s++) {
        totalRequired += req[s];
      }
    }

    lines.push(`  0 <= wmax <= ${totalRequired}`);
    lines.push(`  0 <= wmin <= ${totalRequired}`);
    for (let s = 0; s < S; s++) {
      lines.push(`  0 <= smax${s} <= ${totalRequired}`);
      lines.push(`  0 <= smin${s} <= ${totalRequired}`);
    }
    if (HOLIDAY_BALANCE_W > 0) {
      lines.push(`  0 <= hmax <= ${totalRequired}`);
      lines.push(`  0 <= hmin <= ${totalRequired}`);
    }

    lines.push("Binary");
    const chunkSize = 50;
    for (let i = 0; i < binaryVars.length; i += chunkSize) {
      lines.push("  " + binaryVars.slice(i, i + chunkSize).join(" "));
    }

    lines.push("End");

    return { model: lines.join("\n"), varMap };
  }

  private extractSchedule(
    solution: any,
    varMap: Map<string, { staff: number; day: number; shift: number }>
  ): DaySchedule[] {
    const D = this.daysInMonth;
    const S = this.config.shiftNames.length;

    const schedule: DaySchedule[] = [];
    for (let d = 0; d < D; d++) {
      const required = this.getStaffPerShiftForDay(d + 1);
      const shifts: string[][] = [];
      for (let s = 0; s < S; s++) {
        shifts.push(new Array(required[s]).fill(""));
      }
      schedule.push({ date: d + 1, shifts });
    }

    const assignedPerDayShift: Map<string, string[]> = new Map();
    for (let d = 0; d < D; d++) {
      for (let s = 0; s < S; s++) {
        assignedPerDayShift.set(`${d}_${s}`, []);
      }
    }

    const columns = solution.Columns || {};
    varMap.forEach((info, varName) => {
      const col = columns[varName];
      if (col && Math.round(col.Primal) === 1) {
        const key = `${info.day}_${info.shift}`;
        assignedPerDayShift.get(key)!.push(this.staff[info.staff].id);
      }
    });

    for (let d = 0; d < D; d++) {
      const required = this.getStaffPerShiftForDay(d + 1);
      for (let s = 0; s < S; s++) {
        const assigned = assignedPerDayShift.get(`${d}_${s}`)!;
        const arr = schedule[d].shifts[s];
        for (let pos = 0; pos < arr.length && pos < assigned.length; pos++) {
          arr[pos] = assigned[pos];
        }
      }
    }

    return schedule;
  }

  private calculateMetricsFromSchedule(schedule: DaySchedule[]) {
    const N = this.staff.length;
    const S = this.config.shiftNames.length;

    const workLoad = new Map<string, number>();
    const shiftCounts = new Map<string, number[]>();
    const holidayLoad = new Map<string, number>();
    const holidayShiftCounts = new Map<string, number[]>();
    const weekdayLoad = new Map<string, number>();
    const weekdayShiftCounts = new Map<string, number[]>();

    for (const member of this.staff) {
      workLoad.set(member.id, 0);
      shiftCounts.set(member.id, new Array(S).fill(0));
      holidayLoad.set(member.id, 0);
      holidayShiftCounts.set(member.id, new Array(S).fill(0));
      weekdayLoad.set(member.id, 0);
      weekdayShiftCounts.set(member.id, new Array(S).fill(0));
    }

    for (let d = 0; d < this.daysInMonth; d++) {
      const date = d + 1;
      const isHol = this.isHoliday(date);
      for (let s = 0; s < S; s++) {
        const assigned = schedule[d].shifts[s];
        for (const staffId of assigned) {
          if (!staffId) continue;
          workLoad.set(staffId, (workLoad.get(staffId) || 0) + 1);
          const sc = shiftCounts.get(staffId)!;
          sc[s] = (sc[s] || 0) + 1;

          if (this.config.balanceHolidays) {
            if (isHol) {
              holidayLoad.set(staffId, (holidayLoad.get(staffId) || 0) + 1);
              const hsc = holidayShiftCounts.get(staffId)!;
              hsc[s] = (hsc[s] || 0) + 1;
            } else {
              weekdayLoad.set(staffId, (weekdayLoad.get(staffId) || 0) + 1);
              const wsc = weekdayShiftCounts.get(staffId)!;
              wsc[s] = (wsc[s] || 0) + 1;
            }
          }
        }
      }
    }

    let minLoad = Infinity;
    let maxLoad = -Infinity;

    const perStaff = this.staff.map(s => {
      const total = workLoad.get(s.id) || 0;
      minLoad = Math.min(minLoad, total);
      maxLoad = Math.max(maxLoad, total);

      const result: any = {
        name: s.name,
        total,
        byShift: shiftCounts.get(s.id) || []
      };

      if (this.config.balanceHolidays && this.holidayDays.size > 0) {
        result.holidayTotal = holidayLoad.get(s.id) || 0;
        result.holidayByShift = holidayShiftCounts.get(s.id) || [];
        result.weekdayTotal = weekdayLoad.get(s.id) || 0;
        result.weekdayByShift = weekdayShiftCounts.get(s.id) || [];
      }

      return result;
    });

    return {
      range: maxLoad - minLoad,
      perStaff
    };
  }

  private buildEmptySchedule(): DaySchedule[] {
    const schedule: DaySchedule[] = [];
    for (let d = 0; d < this.daysInMonth; d++) {
      const required = this.getStaffPerShiftForDay(d + 1);
      const shifts: string[][] = [];
      for (let s = 0; s < this.config.shiftNames.length; s++) {
        shifts.push(new Array(required[s]).fill(""));
      }
      schedule.push({ date: d + 1, shifts });
    }
    return schedule;
  }

  private findUnfilledSlots(schedule: DaySchedule[]): UnfilledSlot[] {
    const unfilled: UnfilledSlot[] = [];
    for (let dayIdx = 0; dayIdx < this.daysInMonth; dayIdx++) {
      for (let shiftIdx = 0; shiftIdx < this.config.shiftNames.length; shiftIdx++) {
        const required = this.getStaffPerShiftForDay(dayIdx + 1)[shiftIdx];
        const shiftArray = schedule[dayIdx]?.shifts?.[shiftIdx];
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

  public async optimize(): Promise<OptimizerResult> {
    const feasibilityMsg = this.checkFeasibility();

    const { model, varMap } = this.buildLPModel();

    if (!model || varMap.size === 0) {
      const emptySchedule = this.buildEmptySchedule();
      const unfilledSlots = this.findUnfilledSlots(emptySchedule);
      return {
        schedule: emptySchedule,
        metrics: { range: 0, perStaff: this.staff.map(s => ({ name: s.name, total: 0, byShift: new Array(this.config.shiftNames.length).fill(0) })) },
        isPartial: true,
        unfilledSlots,
        feasibilityWarning: feasibilityMsg || "No eligible assignments found."
      };
    }

    const solver = await getSolver();

    const solution = solver.solve(model, {
      time_limit: 30.0,
      presolve: "on",
      mip_rel_gap: 0.01,
    });

    const status = solution.Status;
    const failStatuses = ["Infeasible", "Model error", "Load error", "Presolve error", "Solve error", "Empty"];

    if (failStatuses.includes(status) || !solution.Columns) {
      const emptySchedule = this.buildEmptySchedule();
      return {
        schedule: emptySchedule,
        metrics: { range: 0, perStaff: this.staff.map(s => ({ name: s.name, total: 0, byShift: new Array(this.config.shiftNames.length).fill(0) })) },
        isPartial: true,
        unfilledSlots: this.findUnfilledSlots(emptySchedule),
        feasibilityWarning: feasibilityMsg || `Solver status: ${status}. The constraints may be too tight — try relaxing rules or adding more staff.`
      };
    }

    const schedule = this.extractSchedule(solution, varMap);
    const metrics = this.calculateMetricsFromSchedule(schedule);
    const unfilledSlots = this.findUnfilledSlots(schedule);

    const result: OptimizerResult = {
      schedule,
      metrics
    };

    if (unfilledSlots.length > 0) {
      result.isPartial = true;
      result.unfilledSlots = unfilledSlots;
      result.feasibilityWarning = feasibilityMsg || (status === "Time limit reached"
        ? "Time limit reached — showing best solution found so far."
        : undefined);
    }

    return result;
  }
}
