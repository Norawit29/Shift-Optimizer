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

function writeTerms(terms: string[], perLine: number = 10): string {
  const chunks: string[] = [];
  for (let i = 0; i < terms.length; i += perLine) {
    chunks.push("  " + terms.slice(i, i + perLine).join(" "));
  }
  return chunks.join("\n");
}

function fmt(n: number): string {
  return Number(n.toFixed(6)).toString();
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
    const warnings: string[] = [];

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
          warnings.push(
            `Day ${day}, Shift "${this.config.shiftNames[shiftIdx]}": ` +
            `needs ${required} staff but only ${available} available.`
          );
        }
      }
    }

    const weekdaySlots = this.config.staffPerShift.reduce((a, b) => a + b, 0);
    const holidaySlots = this.config.separateHolidayConfig && this.config.holidayStaffPerShift
      ? this.config.holidayStaffPerShift.reduce((a, b) => a + b, 0)
      : weekdaySlots;
    const totalSlotsPerDay = Math.max(weekdaySlots, holidaySlots);
    if (totalSlotsPerDay > this.staff.length) {
      warnings.push(
        `Each day requires ${totalSlotsPerDay} staff slots but only ${this.staff.length} staff members exist.`
      );
    }

    return warnings.length > 0 ? warnings.join(" ") : null;
  }

  private isBlocked(staffIdx: number, dayIdx: number, shiftIdx: number): boolean {
    const member = this.staff[staffIdx];
    const date = dayIdx + 1;
    return member.blocked.some(b => b.date === date && (b.shift === -1 || b.shift === shiftIdx));
  }

  private vn(staffIdx: number, dayIdx: number, shiftIdx: number): string {
    return `x_${staffIdx}_${dayIdx}_${shiftIdx}`;
  }

  private prepareVariables(): {
    varMap: Map<string, { staff: number; day: number; shift: number }>;
    binaryVars: string[];
  } {
    const N = this.staff.length;
    const D = this.daysInMonth;
    const S = this.config.shiftNames.length;
    const varMap = new Map<string, { staff: number; day: number; shift: number }>();

    for (let i = 0; i < N; i++) {
      for (let d = 0; d < D; d++) {
        for (let s = 0; s < S; s++) {
          if (this.isBlocked(i, d, s)) continue;
          const required = this.getStaffPerShiftForDay(d + 1)[s];
          if (required === 0) continue;
          const v = this.vn(i, d, s);
          varMap.set(v, { staff: i, day: d, shift: s });
        }
      }
    }

    const binaryVars: string[] = [];
    varMap.forEach((_info, vName) => binaryVars.push(vName));
    return { varMap, binaryVars };
  }

  private writeCommonConstraints(
    lines: string[],
    varMap: Map<string, { staff: number; day: number; shift: number }>,
    cIdx: { val: number },
    options?: { skipStaffingCap?: boolean }
  ): void {
    const N = this.staff.length;
    const D = this.daysInMonth;
    const S = this.config.shiftNames.length;

    for (let i = 0; i < N; i++) {
      for (let d = 0; d < D; d++) {
        const dayVars: string[] = [];
        for (let s = 0; s < S; s++) {
          const v = this.vn(i, d, s);
          if (varMap.has(v)) dayVars.push(v);
        }
        if (dayVars.length > 1) {
          const terms = dayVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
          lines.push(`  c${cIdx.val++}:`);
          lines.push(writeTerms(terms, 10));
          lines.push(`  <= 1`);
        }
      }
    }

    if (!options?.skipStaffingCap) {
      for (let d = 0; d < D; d++) {
        const required = this.getStaffPerShiftForDay(d + 1);
        for (let s = 0; s < S; s++) {
          if (required[s] === 0) continue;
          const shiftVars: string[] = [];
          for (let i = 0; i < N; i++) {
            const v = this.vn(i, d, s);
            if (varMap.has(v)) shiftVars.push(v);
          }
          if (shiftVars.length > 0) {
            const terms = shiftVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
            lines.push(`  c${cIdx.val++}:`);
            lines.push(writeTerms(terms, 10));
            lines.push(`  <= ${required[s]}`);
          }
        }
      }
    }

    for (const rule of this.config.consecutiveRules) {
      for (let i = 0; i < N; i++) {
        for (let d = 0; d < D - 1; d++) {
          const v1 = this.vn(i, d, rule.from);
          const v2 = this.vn(i, d + 1, rule.to);
          if (varMap.has(v1) && varMap.has(v2)) {
            lines.push(`  c${cIdx.val++}: ${v1} + ${v2} <= 1`);
          }
        }
      }
    }

    for (let i = 0; i < N; i++) {
      const maxShifts = this.staff[i].maxShifts;
      const staffVars: string[] = [];
      for (let d = 0; d < D; d++) {
        for (let s = 0; s < S; s++) {
          const v = this.vn(i, d, s);
          if (varMap.has(v)) staffVars.push(v);
        }
      }
      if (staffVars.length > 0) {
        const terms = staffVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
        lines.push(`  c${cIdx.val++}:`);
        lines.push(writeTerms(terms, 10));
        lines.push(`  <= ${maxShifts}`);
      }
    }
  }

  private buildPhase1Model(
    varMap: Map<string, { staff: number; day: number; shift: number }>,
    binaryVars: string[]
  ): { model: string; slackVars: string[] } {
    const N = this.staff.length;
    const D = this.daysInMonth;
    const S = this.config.shiftNames.length;
    const lines: string[] = [];
    const slackVars: string[] = [];

    for (let d = 0; d < D; d++) {
      const required = this.getStaffPerShiftForDay(d + 1);
      for (let s = 0; s < S; s++) {
        if (required[s] === 0) continue;
        slackVars.push(`u_${d}_${s}`);
      }
    }

    lines.push("Minimize");
    lines.push("  obj:");
    const objParts = slackVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
    lines.push(writeTerms(objParts, 10));

    lines.push("Subject To");
    const cIdx = { val: 0 };
    this.writeCommonConstraints(lines, varMap, cIdx, { skipStaffingCap: true });

    for (let d = 0; d < D; d++) {
      const required = this.getStaffPerShiftForDay(d + 1);
      for (let s = 0; s < S; s++) {
        if (required[s] === 0) continue;
        const uVar = `u_${d}_${s}`;
        const shiftVars: string[] = [];
        for (let i = 0; i < N; i++) {
          const v = this.vn(i, d, s);
          if (varMap.has(v)) shiftVars.push(v);
        }
        if (shiftVars.length > 0) {
          const terms = shiftVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
          terms.push(`+ ${uVar}`);
          lines.push(`  c${cIdx.val++}:`);
          lines.push(writeTerms(terms, 10));
          lines.push(`  = ${required[s]}`);
        } else {
          lines.push(`  c${cIdx.val++}: ${uVar} = ${required[s]}`);
        }
      }
    }

    lines.push("Bounds");
    for (const uVar of slackVars) {
      lines.push(`  ${uVar} >= 0`);
    }

    lines.push("Binary");
    for (let i = 0; i < binaryVars.length; i += 20) {
      lines.push("  " + binaryVars.slice(i, i + 20).join(" "));
    }

    lines.push("End");
    return { model: lines.join("\n"), slackVars };
  }

  private extractPhase1Targets(
    phase1Solution: any,
    varMap: Map<string, { staff: number; day: number; shift: number }>
  ): { perShift: number[]; holidayTotal: number; totalCoverage: number; slotCoverage: Map<string, number> } {
    const S = this.config.shiftNames.length;
    const D = this.daysInMonth;
    const perShift = new Array(S).fill(0);
    let holidayTotal = 0;
    let totalCoverage = 0;
    const slotCoverage = new Map<string, number>();

    for (let d = 0; d < D; d++) {
      for (let s = 0; s < S; s++) {
        slotCoverage.set(`${d}_${s}`, 0);
      }
    }

    const columns = phase1Solution.Columns || {};
    varMap.forEach((info, varName) => {
      const col = columns[varName];
      if (col && Math.round(col.Primal) === 1) {
        perShift[info.shift]++;
        totalCoverage++;
        const key = `${info.day}_${info.shift}`;
        slotCoverage.set(key, (slotCoverage.get(key) || 0) + 1);
        if (this.isHoliday(info.day + 1)) {
          holidayTotal++;
        }
      }
    });

    return { perShift, holidayTotal, totalCoverage, slotCoverage };
  }

  private buildPhase2Model(
    varMap: Map<string, { staff: number; day: number; shift: number }>,
    binaryVars: string[],
    phase1Targets: { perShift: number[]; holidayTotal: number; totalCoverage: number; slotCoverage: Map<string, number> }
  ): string {
    const N = this.staff.length;
    const D = this.daysInMonth;
    const S = this.config.shiftNames.length;
    const enableHolidayBalance = this.config.balanceHolidays && this.holidayDays.size > 0;

    const COVERAGE_W = 1000;
    const WORKLOAD_W = 1.0;
    const SHIFT_W = 0.4;
    const HOLIDAY_W = enableHolidayBalance ? 0.6 : 0;

    const avgWorkload = phase1Targets.totalCoverage / N;
    const shiftTargets = phase1Targets.perShift.map(total => total / N);
    const avgHoliday = enableHolidayBalance ? phase1Targets.holidayTotal / N : 0;

    const lines: string[] = [];
    const slackVars: string[] = [];

    for (let d = 0; d < D; d++) {
      const required = this.getStaffPerShiftForDay(d + 1);
      for (let s = 0; s < S; s++) {
        if (required[s] === 0) continue;
        slackVars.push(`u2_${d}_${s}`);
      }
    }

    lines.push("Minimize");
    lines.push("  obj:");
    const objParts: string[] = [];
    for (const uVar of slackVars) {
      objParts.push(`+ ${COVERAGE_W} ${uVar}`);
    }
    for (let i = 0; i < N; i++) {
      objParts.push(`+ ${WORKLOAD_W} dw_${i}`);
    }
    for (let i = 0; i < N; i++) {
      for (let s = 0; s < S; s++) {
        if (shiftTargets[s] > 0) {
          objParts.push(`+ ${SHIFT_W} ds_${i}_${s}`);
        }
      }
    }
    if (enableHolidayBalance && avgHoliday > 0) {
      for (let i = 0; i < N; i++) {
        objParts.push(`+ ${HOLIDAY_W} dh_${i}`);
      }
    }
    lines.push(writeTerms(objParts, 8));

    lines.push("Subject To");
    const cIdx = { val: 0 };
    this.writeCommonConstraints(lines, varMap, cIdx, { skipStaffingCap: true });

    for (let d = 0; d < D; d++) {
      const required = this.getStaffPerShiftForDay(d + 1);
      for (let s = 0; s < S; s++) {
        if (required[s] === 0) continue;
        const uVar = `u2_${d}_${s}`;
        const shiftVars: string[] = [];
        for (let i = 0; i < N; i++) {
          const v = this.vn(i, d, s);
          if (varMap.has(v)) shiftVars.push(v);
        }
        if (shiftVars.length > 0) {
          const terms = shiftVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
          terms.push(`+ ${uVar}`);
          lines.push(`  c${cIdx.val++}:`);
          lines.push(writeTerms(terms, 10));
          lines.push(`  = ${required[s]}`);
        } else {
          lines.push(`  c${cIdx.val++}: ${uVar} = ${required[s]}`);
        }
      }
    }

    for (let d = 0; d < D; d++) {
      for (let s = 0; s < S; s++) {
        const coverage = phase1Targets.slotCoverage.get(`${d}_${s}`) || 0;
        if (coverage === 0) continue;
        const slotVars: string[] = [];
        for (let i = 0; i < N; i++) {
          const v = this.vn(i, d, s);
          if (varMap.has(v)) slotVars.push(v);
        }
        if (slotVars.length > 0) {
          const terms = slotVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
          lines.push(`  c${cIdx.val++}:`);
          lines.push(writeTerms(terms, 10));
          lines.push(`  >= ${coverage}`);
        }
      }
    }

    for (let i = 0; i < N; i++) {
      const staffVars: string[] = [];
      for (let d = 0; d < D; d++) {
        for (let s = 0; s < S; s++) {
          const v = this.vn(i, d, s);
          if (varMap.has(v)) staffVars.push(v);
        }
      }
      if (staffVars.length > 0) {
        const terms1 = staffVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
        terms1.push(`- dw_${i}`);
        lines.push(`  c${cIdx.val++}:`);
        lines.push(writeTerms(terms1, 10));
        lines.push(`  <= ${fmt(avgWorkload)}`);

        const terms2 = staffVars.map(v => `- ${v}`);
        terms2.push(`- dw_${i}`);
        lines.push(`  c${cIdx.val++}:`);
        lines.push(writeTerms(terms2, 10));
        lines.push(`  <= ${fmt(-avgWorkload)}`);
      }
    }

    for (let i = 0; i < N; i++) {
      for (let s = 0; s < S; s++) {
        const target = shiftTargets[s];
        if (target === 0) continue;

        const shiftVars: string[] = [];
        for (let d = 0; d < D; d++) {
          const v = this.vn(i, d, s);
          if (varMap.has(v)) shiftVars.push(v);
        }
        if (shiftVars.length > 0) {
          const terms1 = shiftVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
          terms1.push(`- ds_${i}_${s}`);
          lines.push(`  c${cIdx.val++}:`);
          lines.push(writeTerms(terms1, 10));
          lines.push(`  <= ${fmt(target)}`);

          const terms2 = shiftVars.map(v => `- ${v}`);
          terms2.push(`- ds_${i}_${s}`);
          lines.push(`  c${cIdx.val++}:`);
          lines.push(writeTerms(terms2, 10));
          lines.push(`  <= ${fmt(-target)}`);
        }
      }
    }

    if (enableHolidayBalance && avgHoliday > 0) {
      for (let i = 0; i < N; i++) {
        const holVars: string[] = [];
        for (let d = 0; d < D; d++) {
          if (!this.isHoliday(d + 1)) continue;
          for (let s = 0; s < S; s++) {
            const v = this.vn(i, d, s);
            if (varMap.has(v)) holVars.push(v);
          }
        }
        if (holVars.length > 0) {
          const terms1 = holVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
          terms1.push(`- dh_${i}`);
          lines.push(`  c${cIdx.val++}:`);
          lines.push(writeTerms(terms1, 10));
          lines.push(`  <= ${fmt(avgHoliday)}`);

          const terms2 = holVars.map(v => `- ${v}`);
          terms2.push(`- dh_${i}`);
          lines.push(`  c${cIdx.val++}:`);
          lines.push(writeTerms(terms2, 10));
          lines.push(`  <= ${fmt(-avgHoliday)}`);
        }
      }
    }

    lines.push("Bounds");
    for (const uVar of slackVars) {
      lines.push(`  ${uVar} >= 0`);
    }
    for (let i = 0; i < N; i++) {
      lines.push(`  dw_${i} >= 0`);
    }
    for (let i = 0; i < N; i++) {
      for (let s = 0; s < S; s++) {
        if (shiftTargets[s] > 0) {
          lines.push(`  ds_${i}_${s} >= 0`);
        }
      }
    }
    if (enableHolidayBalance && avgHoliday > 0) {
      for (let i = 0; i < N; i++) {
        lines.push(`  dh_${i} >= 0`);
      }
    }

    lines.push("Binary");
    for (let i = 0; i < binaryVars.length; i += 20) {
      lines.push("  " + binaryVars.slice(i, i + 20).join(" "));
    }

    lines.push("End");
    return lines.join("\n");
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
        const arr = assignedPerDayShift.get(key);
        if (arr) arr.push(this.staff[info.staff].id);
      }
    });

    for (let d = 0; d < D; d++) {
      const required = this.getStaffPerShiftForDay(d + 1);
      for (let s = 0; s < S; s++) {
        const assigned = assignedPerDayShift.get(`${d}_${s}`) || [];
        const arr = schedule[d].shifts[s];
        for (let pos = 0; pos < arr.length && pos < assigned.length; pos++) {
          arr[pos] = assigned[pos];
        }
      }
    }

    return schedule;
  }

  private calculateMetricsFromSchedule(schedule: DaySchedule[]) {
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

  private makeEmptyResult(warning: string): OptimizerResult {
    const emptySchedule = this.buildEmptySchedule();
    return {
      schedule: emptySchedule,
      metrics: {
        range: 0,
        perStaff: this.staff.map(s => ({
          name: s.name, total: 0,
          byShift: new Array(this.config.shiftNames.length).fill(0)
        }))
      },
      isPartial: true,
      unfilledSlots: this.findUnfilledSlots(emptySchedule),
      feasibilityWarning: warning
    };
  }

  public async optimize(): Promise<OptimizerResult> {
    const feasibilityMsg = this.checkFeasibility();
    const { varMap, binaryVars } = this.prepareVariables();

    if (varMap.size === 0) {
      return this.makeEmptyResult(feasibilityMsg || "No eligible assignments found.");
    }

    const solver = await getSolver();

    const failStatuses = [
      "Infeasible", "Model error", "Load error", "Presolve error",
      "Solve error", "Empty", "Not Set", "Primal infeasible or unbounded", "Unbounded"
    ];

    const { model: phase1Model } = this.buildPhase1Model(varMap, binaryVars);
    let phase1Solution: any;
    try {
      phase1Solution = solver.solve(phase1Model, {
        time_limit: 15.0,
        presolve: "on",
        mip_rel_gap: 0.01,
      });
    } catch (err: any) {
      console.error("Phase 1 solver error:", err);
      return this.makeEmptyResult(`Solver crashed during coverage optimization: ${err?.message || "Unknown error"}.`);
    }

    if (failStatuses.includes(phase1Solution.Status) || !phase1Solution.Columns) {
      return this.makeEmptyResult(feasibilityMsg || `Phase 1 solver status: ${phase1Solution.Status}.`);
    }

    const phase1Targets = this.extractPhase1Targets(phase1Solution, varMap);

    if (phase1Targets.totalCoverage === 0) {
      return this.makeEmptyResult("No assignments possible with current constraints.");
    }

    const phase2Model = this.buildPhase2Model(varMap, binaryVars, phase1Targets);
    let finalSolution: any;
    try {
      const phase2Solution = solver.solve(phase2Model, {
        time_limit: 15.0,
        presolve: "on",
        mip_rel_gap: 0.01,
      });

      if (failStatuses.includes(phase2Solution.Status) || !phase2Solution.Columns) {
        console.warn("Phase 2 failed, using Phase 1 result. Status:", phase2Solution.Status);
        finalSolution = phase1Solution;
      } else {
        finalSolution = phase2Solution;
      }
    } catch (err: any) {
      console.error("Phase 2 solver error, using Phase 1 result:", err);
      finalSolution = phase1Solution;
    }

    const schedule = this.extractSchedule(finalSolution, varMap);
    const metrics = this.calculateMetricsFromSchedule(schedule);
    const unfilledSlots = this.findUnfilledSlots(schedule);

    const result: OptimizerResult = {
      schedule,
      metrics
    };

    if (unfilledSlots.length > 0) {
      result.isPartial = true;
      result.unfilledSlots = unfilledSlots;
      result.feasibilityWarning = feasibilityMsg || (finalSolution.Status === "Time limit reached"
        ? "Time limit reached — showing best solution found so far."
        : undefined);
    }

    return result;
  }
}
