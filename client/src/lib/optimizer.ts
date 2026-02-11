import type { StaffMember, SchedulerConfig, DaySchedule, OptimizerResult, UnfilledSlot } from "@shared/schema";
import { getDaysInMonth, differenceInCalendarDays, addDays, parseISO } from "date-fns";

let highsModule: any = null;

async function createSolver(): Promise<any> {
  if (!highsModule) {
    highsModule = (await import("highs")).default;
  }
  const solver = await highsModule({
    locateFile: (file: string) => `/${file}`
  });
  return solver;
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

    const maxPerDay = this.config.shiftsPerDay || S;
    for (let i = 0; i < N; i++) {
      for (let d = 0; d < D; d++) {
        const dayVars: string[] = [];
        for (let s = 0; s < S; s++) {
          const v = this.vn(i, d, s);
          if (varMap.has(v)) dayVars.push(v);
        }
        if (dayVars.length > 1 && maxPerDay < dayVars.length) {
          const terms = dayVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
          lines.push(`  c${cIdx.val++}:`);
          lines.push(writeTerms(terms, 10));
          lines.push(`  <= ${maxPerDay}`);
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
    const objParts = slackVars.map((v, idx) => {
      const w = fmt(1 + (Math.random() - 0.5) * 0.001);
      return idx === 0 ? `${w} ${v}` : `+ ${w} ${v}`;
    });
    const xVars = Array.from(varMap.keys());
    for (const xv of xVars) {
      const n = (Math.random() - 0.5) * 0.0001;
      objParts.push(n >= 0 ? `+ ${fmt(n)} ${xv}` : `- ${fmt(-n)} ${xv}`);
    }
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

    const WORKLOAD_W = 1.0;
    const SHIFT_W = 0.4;
    const HOLIDAY_W = enableHolidayBalance ? 0.6 : 0;

    const totalMaxShifts = this.staff.reduce((sum, s) => sum + s.maxShifts, 0);
    const staffWorkloadTargets = this.staff.map(s => phase1Targets.totalCoverage * (s.maxShifts / totalMaxShifts));
    const staffShiftTargets = phase1Targets.perShift.map(total =>
      this.staff.map(s => total * (s.maxShifts / totalMaxShifts))
    );
    const staffHolidayTargets = enableHolidayBalance
      ? this.staff.map(s => phase1Targets.holidayTotal * (s.maxShifts / totalMaxShifts))
      : this.staff.map(() => 0);

    const lines: string[] = [];

    lines.push("Minimize");
    lines.push("  obj:");
    const objParts: string[] = [];
    for (let i = 0; i < N; i++) {
      const w = fmt(WORKLOAD_W + (Math.random() - 0.5) * 0.001);
      objParts.push(i === 0 ? `${w} dw_${i}` : `+ ${w} dw_${i}`);
    }
    for (let i = 0; i < N; i++) {
      for (let s = 0; s < S; s++) {
        if (staffShiftTargets[s][i] > 0) {
          const w = fmt(SHIFT_W + (Math.random() - 0.5) * 0.001);
          objParts.push(`+ ${w} ds_${i}_${s}`);
        }
      }
    }
    if (enableHolidayBalance && staffHolidayTargets.some(t => t > 0)) {
      for (let i = 0; i < N; i++) {
        const w = fmt(HOLIDAY_W + (Math.random() - 0.5) * 0.001);
        objParts.push(`+ ${w} dh_${i}`);
      }
    }
    lines.push(writeTerms(objParts, 8));

    lines.push("Subject To");
    const cIdx = { val: 0 };
    this.writeCommonConstraints(lines, varMap, cIdx);

    for (let i = 0; i < N; i++) {
      const staffVars: string[] = [];
      for (let d = 0; d < D; d++) {
        for (let s = 0; s < S; s++) {
          const v = this.vn(i, d, s);
          if (varMap.has(v)) staffVars.push(v);
        }
      }
      if (staffVars.length === 0) continue;

      const defTerms = staffVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
      defTerms.push(`- tw_${i}`);
      lines.push(`  c${cIdx.val++}:`);
      lines.push(writeTerms(defTerms, 10));
      lines.push(`  = 0`);

      const wTarget = staffWorkloadTargets[i];
      lines.push(`  c${cIdx.val++}: tw_${i} - dw_${i} <= ${fmt(wTarget)}`);
      lines.push(`  c${cIdx.val++}: - tw_${i} - dw_${i} <= ${fmt(-wTarget)}`);
    }

    for (let i = 0; i < N; i++) {
      for (let s = 0; s < S; s++) {
        const target = staffShiftTargets[s][i];
        if (target === 0) continue;

        const shiftVars: string[] = [];
        for (let d = 0; d < D; d++) {
          const v = this.vn(i, d, s);
          if (varMap.has(v)) shiftVars.push(v);
        }
        if (shiftVars.length === 0) continue;

        const defTerms = shiftVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
        defTerms.push(`- ts_${i}_${s}`);
        lines.push(`  c${cIdx.val++}:`);
        lines.push(writeTerms(defTerms, 10));
        lines.push(`  = 0`);

        lines.push(`  c${cIdx.val++}: ts_${i}_${s} - ds_${i}_${s} <= ${fmt(target)}`);
        lines.push(`  c${cIdx.val++}: - ts_${i}_${s} - ds_${i}_${s} <= ${fmt(-target)}`);
      }
    }

    if (enableHolidayBalance && staffHolidayTargets.some(t => t > 0)) {
      for (let i = 0; i < N; i++) {
        const hTarget = staffHolidayTargets[i];
        if (hTarget === 0) continue;
        const holVars: string[] = [];
        for (let d = 0; d < D; d++) {
          if (!this.isHoliday(d + 1)) continue;
          for (let s = 0; s < S; s++) {
            const v = this.vn(i, d, s);
            if (varMap.has(v)) holVars.push(v);
          }
        }
        if (holVars.length === 0) continue;

        const defTerms = holVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
        defTerms.push(`- th_${i}`);
        lines.push(`  c${cIdx.val++}:`);
        lines.push(writeTerms(defTerms, 10));
        lines.push(`  = 0`);

        lines.push(`  c${cIdx.val++}: th_${i} - dh_${i} <= ${fmt(hTarget)}`);
        lines.push(`  c${cIdx.val++}: - th_${i} - dh_${i} <= ${fmt(-hTarget)}`);
      }
    }

    lines.push("Bounds");
    for (let i = 0; i < N; i++) {
      lines.push(`  tw_${i} >= 0`);
      lines.push(`  dw_${i} >= 0`);
    }
    for (let i = 0; i < N; i++) {
      for (let s = 0; s < S; s++) {
        if (staffShiftTargets[s][i] > 0) {
          lines.push(`  ts_${i}_${s} >= 0`);
          lines.push(`  ds_${i}_${s} >= 0`);
        }
      }
    }
    if (enableHolidayBalance && staffHolidayTargets.some(t => t > 0)) {
      for (let i = 0; i < N; i++) {
        lines.push(`  th_${i} >= 0`);
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

    const solver = await createSolver();

    const failStatuses = [
      "Infeasible", "Model error", "Load error", "Presolve error",
      "Solve error", "Empty", "Not Set", "Primal infeasible or unbounded", "Unbounded"
    ];

    let totalRequired = 0;
    for (let d = 0; d < this.daysInMonth; d++) {
      const req = this.getStaffPerShiftForDay(d + 1);
      for (let s = 0; s < this.config.shiftNames.length; s++) {
        totalRequired += req[s];
      }
    }
    const totalMaxShifts = this.staff.reduce((sum, s) => sum + s.maxShifts, 0);
    console.log(`[OPT] Setup: ${this.staff.length} staff, ${this.daysInMonth} days, ${this.config.shiftNames.length} shifts`);
    console.log(`[OPT] Total required slots: ${totalRequired}, Total staff capacity (maxShifts): ${totalMaxShifts}, Variables: ${varMap.size}`);

    const { model: phase1Model } = this.buildPhase1Model(varMap, binaryVars);
    let phase1Solution: any;
    try {
      phase1Solution = solver.solve(phase1Model, {
        time_limit: 15.0,
        presolve: "on",
        mip_rel_gap: 0.01,
      });
    } catch (err: any) {
      console.error("[OPT] Phase 1 solver CRASH:", err);
      return this.makeEmptyResult(`Solver crashed during coverage optimization: ${err?.message || "Unknown error"}.`);
    }

    console.log(`[OPT] Phase 1 status: ${phase1Solution.Status}, ObjectiveValue: ${phase1Solution.ObjectiveValue}`);

    if (failStatuses.includes(phase1Solution.Status) || !phase1Solution.Columns) {
      console.error(`[OPT] Phase 1 FAILED: ${phase1Solution.Status}`);
      return this.makeEmptyResult(feasibilityMsg || `Phase 1 solver status: ${phase1Solution.Status}.`);
    }

    const phase1Targets = this.extractPhase1Targets(phase1Solution, varMap);
    const phase1Unfilled = totalRequired - phase1Targets.totalCoverage;
    console.log(`[OPT] Phase 1 coverage: ${phase1Targets.totalCoverage}/${totalRequired} (unfilled: ${phase1Unfilled})`);
    console.log(`[OPT] Phase 1 per-shift totals: ${phase1Targets.perShift.join(', ')}`);

    const staffLoads: number[] = new Array(this.staff.length).fill(0);
    const columns1 = phase1Solution.Columns || {};
    varMap.forEach((info, varName) => {
      const col = columns1[varName];
      if (col && Math.round(col.Primal) === 1) {
        staffLoads[info.staff]++;
      }
    });
    console.log(`[OPT] Phase 1 staff loads: ${staffLoads.map((l, i) => `${this.staff[i].name}:${l}/${this.staff[i].maxShifts}`).join(', ')}`);

    if (phase1Targets.totalCoverage === 0) {
      return this.makeEmptyResult("No assignments possible with current constraints.");
    }

    const phase2Model = this.buildPhase2Model(varMap, binaryVars, phase1Targets);
    console.log(`[OPT] Phase 2 model size: ${phase2Model.length} chars, ${phase2Model.split('\n').length} lines`);
    let finalSolution: any;
    let usedPhase = 2;
    try {
      const solver2 = await createSolver();
      const phase2Solution = solver2.solve(phase2Model, {
        time_limit: 15.0,
        presolve: "on",
        mip_rel_gap: 0.01,
      });

      console.log(`[OPT] Phase 2 status: ${phase2Solution.Status}, ObjectiveValue: ${phase2Solution.ObjectiveValue}`);

      if (failStatuses.includes(phase2Solution.Status) || !phase2Solution.Columns) {
        console.warn(`[OPT] Phase 2 FAILED (${phase2Solution.Status}), falling back to Phase 1`);
        finalSolution = phase1Solution;
        usedPhase = 1;
      } else {
        finalSolution = phase2Solution;
      }
    } catch (err: any) {
      console.error("[OPT] Phase 2 solver CRASH, falling back to Phase 1:", String(err), err?.message, err?.stack);
      finalSolution = phase1Solution;
      usedPhase = 1;
    }

    const schedule = this.extractSchedule(finalSolution, varMap);
    const metrics = this.calculateMetricsFromSchedule(schedule);
    const unfilledSlots = this.findUnfilledSlots(schedule);

    const finalCoverage = metrics.perStaff.reduce((sum: number, s: any) => sum + s.total, 0);
    console.log(`[OPT] Final result (Phase ${usedPhase}): coverage ${finalCoverage}/${totalRequired}, unfilled slots: ${unfilledSlots.length}`);
    if (unfilledSlots.length > 0) {
      console.log(`[OPT] Unfilled: ${unfilledSlots.slice(0, 10).map(u => `Day${u.date}-${u.shiftName}(${u.assigned}/${u.required})`).join(', ')}${unfilledSlots.length > 10 ? '...' : ''}`);
    }

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
