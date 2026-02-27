import type { StaffMember, SchedulerConfig, DaySchedule, OptimizerResult, UnfilledSlot } from "@shared/schema";
import { getDaysInMonth, differenceInCalendarDays, addDays, parseISO } from "date-fns";
import highsFactory from "highs";

async function createSolver(): Promise<any> {
  const solver = await (highsFactory as any)({
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
  private softLevelConstraints: boolean;

  private getActualDate(dayIndex: number): Date {
    if (this.rangeStartDate) {
      return addDays(this.rangeStartDate, dayIndex - 1);
    }
    return new Date(this.year, this.month - 1, dayIndex);
  }

  constructor(config: SchedulerConfig, staff: StaffMember[], month: number, year: number, options?: { softLevelConstraints?: boolean }) {
    this.config = config;
    this.staff = staff;
    this.month = month;
    this.softLevelConstraints = options?.softLevelConstraints ?? false;
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

  private checkFeasibility(): { hardErrors: string[]; levelErrors: string[]; softWarnings: string[] } {
    const hardErrors: string[] = [];
    const levelErrors: string[] = [];
    const softWarnings: string[] = [];
    const S = this.config.shiftNames.length;

    for (let day = 1; day <= this.daysInMonth; day++) {
      const dayStaffPerShift = this.getStaffPerShiftForDay(day);
      for (let shiftIdx = 0; shiftIdx < S; shiftIdx++) {
        const required = dayStaffPerShift[shiftIdx];
        let available = 0;
        for (const member of this.staff) {
          const isBlocked = member.blocked.some(b => b.date === day && (b.shift === -1 || b.shift === shiftIdx));
          if (!isBlocked) available++;
        }
        if (available < required) {
          hardErrors.push(
            `Day ${day}, Shift "${this.config.shiftNames[shiftIdx]}": needs ${required} staff but only ${available} available.`
          );
        }
      }
    }

    const totalMaxShifts = this.staff.reduce((sum, s) => sum + s.maxShifts, 0);
    let totalRequired = 0;
    for (let d = 0; d < this.daysInMonth; d++) {
      const req = this.getStaffPerShiftForDay(d + 1);
      for (let s = 0; s < S; s++) totalRequired += req[s];
    }
    if (totalMaxShifts < totalRequired) {
      hardErrors.push(
        `Total staff capacity (${totalMaxShifts} shifts) is less than total required slots (${totalRequired}). Increase maxShifts or add more staff.`
      );
    }

    if (this.config.staffLevels && this.config.minStaffPerLevel) {
      for (let shiftIdx = 0; shiftIdx < S; shiftIdx++) {
        for (let lvl = 0; lvl < this.config.staffLevels.length; lvl++) {
          const minReq = this.config.minStaffPerLevel[shiftIdx]?.[lvl] || 0;
          if (minReq <= 0) continue;
          const staffAtLevel = this.staff.filter(s => (s.level ?? 0) === lvl).length;
          if (staffAtLevel < minReq) {
            levelErrors.push(
              `Shift "${this.config.shiftNames[shiftIdx]}": needs ${minReq} "${this.config.staffLevels[lvl]}" but only ${staffAtLevel} staff at that level.`
            );
          }
        }
      }

      for (let day = 1; day <= this.daysInMonth; day++) {
        const dayStaffPerShift = this.getStaffPerShiftForDay(day);
        for (let shiftIdx = 0; shiftIdx < S; shiftIdx++) {
          if (dayStaffPerShift[shiftIdx] === 0) continue;
          for (let lvl = 0; lvl < this.config.staffLevels.length; lvl++) {
            const minReq = this.config.minStaffPerLevel[shiftIdx]?.[lvl] || 0;
            if (minReq <= 0) continue;
            let availableAtLevel = 0;
            for (const member of this.staff) {
              if ((member.level ?? 0) !== lvl) continue;
              const isBlocked = member.blocked.some(b => b.date === day && (b.shift === -1 || b.shift === shiftIdx));
              if (!isBlocked) availableAtLevel++;
            }
            if (availableAtLevel < minReq) {
              levelErrors.push(
                `Day ${day}, "${this.config.shiftNames[shiftIdx]}": needs ${minReq} "${this.config.staffLevels[lvl]}" but only ${availableAtLevel} available (not blocked).`
              );
            }
          }
        }
      }
    }

    for (let day = 1; day <= this.daysInMonth; day++) {
      const dayStaffPerShift = this.getStaffPerShiftForDay(day);
      for (let shiftIdx = 0; shiftIdx < S; shiftIdx++) {
        const capacity = dayStaffPerShift[shiftIdx];
        if (capacity <= 0) continue;
        const requestedNames: string[] = [];
        for (const member of this.staff) {
          const hasReq = (member.requested || []).some(r => r.date === day && r.shift === shiftIdx);
          if (hasReq) requestedNames.push(member.name);
        }
        if (requestedNames.length > capacity) {
          softWarnings.push(
            `Day ${day}, "${this.config.shiftNames[shiftIdx]}": ${requestedNames.length} staff requested but only ${capacity} slots (${requestedNames.join(', ')})`
          );
        }

        if (this.config.staffLevels && this.config.staffLevels.length > 0 && this.config.minStaffPerLevel) {
          const requestedByLevel: Record<number, number> = {};
          let totalReqCount = 0;
          for (const member of this.staff) {
            const hasReq = (member.requested || []).some(r => r.date === day && r.shift === shiftIdx);
            if (hasReq) {
              const lvl = member.level ?? 0;
              requestedByLevel[lvl] = (requestedByLevel[lvl] || 0) + 1;
              totalReqCount++;
            }
          }
          if (totalReqCount > 0) {
            const remainingSlots = capacity - totalReqCount;
            for (let lvl = 0; lvl < this.config.staffLevels.length; lvl++) {
              const minReq = this.config.minStaffPerLevel[shiftIdx]?.[lvl] || 0;
              if (minReq <= 0) continue;
              const reqAtLevel = requestedByLevel[lvl] || 0;
              const stillNeeded = minReq - reqAtLevel;
              if (stillNeeded > 0 && stillNeeded > remainingSlots) {
                softWarnings.push(
                  `Day ${day}, "${this.config.shiftNames[shiftIdx]}": requested staff leave only ${Math.max(0, remainingSlots)} slots but need ${stillNeeded} more "${this.config.staffLevels[lvl]}".`
                );
              }
            }
          }
        }
      }
    }

    for (let i = 0; i < this.staff.length; i++) {
      const member = this.staff[i];
      const requested = member.requested || [];
      if (requested.length === 0) continue;

      for (const rule of this.config.consecutiveRules) {
        const ruleType = rule.type || 'nextDay';
        for (const req of requested) {
          const d = req.date;
          if (ruleType === 'nextDay') {
            if (req.shift === rule.from) {
              const hasNextDay = requested.some(r => r.date === d + 1 && r.shift === rule.to);
              if (hasNextDay) {
                softWarnings.push(
                  `${member.name}: requested "${this.config.shiftNames[rule.from]}" day ${d} + "${this.config.shiftNames[rule.to]}" day ${d + 1}, violates next-day rule.`
                );
              }
            }
          } else {
            if (req.shift === rule.from) {
              const hasSameDay = requested.some(r => r.date === d && r.shift === rule.to);
              if (hasSameDay) {
                softWarnings.push(
                  `${member.name}: requested "${this.config.shiftNames[rule.from]}" + "${this.config.shiftNames[rule.to]}" on day ${d}, violates same-day rule.`
                );
              }
            }
          }
        }
      }

      const reqCount = requested.length;
      if (reqCount > member.maxShifts) {
        softWarnings.push(
          `${member.name}: requested ${reqCount} shifts but maxShifts is ${member.maxShifts}.`
        );
      }
    }

    return { hardErrors, levelErrors, softWarnings };
  }

  private isBlocked(staffIdx: number, dayIdx: number, shiftIdx: number): boolean {
    const member = this.staff[staffIdx];
    const date = dayIdx + 1;
    return member.blocked.some(b => b.date === date && (b.shift === -1 || b.shift === shiftIdx));
  }

  private isRequested(staffIdx: number, dayIdx: number, shiftIdx: number): boolean {
    const member = this.staff[staffIdx];
    const date = dayIdx + 1;
    return (member.requested || []).some(r => r.date === date && r.shift === shiftIdx);
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
    options?: { skipStaffingCap?: boolean; levelSlackVars?: string[]; auxBinaryVars?: string[] }
  ): void {
    const N = this.staff.length;
    const D = this.daysInMonth;
    const S = this.config.shiftNames.length;

    const maxPerDay = this.config.shiftsPerDay || S;
    for (let i = 0; i < N; i++) {
      const memberReqs = this.staff[i].requested || [];
      for (let d = 0; d < D; d++) {
        const dayVars: string[] = [];
        for (let s = 0; s < S; s++) {
          const v = this.vn(i, d, s);
          if (varMap.has(v)) dayVars.push(v);
        }
        let reqOnDay = 0;
        for (let ri = 0; ri < memberReqs.length; ri++) {
          if (memberReqs[ri].date === d + 1) reqOnDay++;
        }
        const effectiveMax = Math.max(maxPerDay, reqOnDay);
        if (dayVars.length > 1 && effectiveMax < dayVars.length) {
          const terms = dayVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
          lines.push(`  c${cIdx.val++}:`);
          lines.push(writeTerms(terms, 10));
          lines.push(`  <= ${effectiveMax}`);
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
      const ruleType = rule.type || 'nextDay';
      for (let i = 0; i < N; i++) {
        if (ruleType === 'nextDay') {
          for (let d = 0; d < D - 1; d++) {
            const v1 = this.vn(i, d, rule.from);
            const v2 = this.vn(i, d + 1, rule.to);
            if (varMap.has(v1) && varMap.has(v2)) {
              lines.push(`  c${cIdx.val++}: ${v1} + ${v2} <= 1`);
            }
          }
        } else {
          for (let d = 0; d < D; d++) {
            const v1 = this.vn(i, d, rule.from);
            const v2 = this.vn(i, d, rule.to);
            if (varMap.has(v1) && varMap.has(v2)) {
              lines.push(`  c${cIdx.val++}: ${v1} + ${v2} <= 1`);
            }
          }
        }
      }
    }

    if (this.config.maxConsecutiveRules) {
      for (let ruleIdx = 0; ruleIdx < this.config.maxConsecutiveRules.length; ruleIdx++) {
        const rule = this.config.maxConsecutiveRules[ruleIdx];
        const windowSize = rule.maxDays + 1;
        const isCombined = rule.shifts.length > 1;

        for (let i = 0; i < N; i++) {
          if (isCombined) {
            const auxVars: string[] = [];
            for (let d = 0; d < D; d++) {
              const allExist = rule.shifts.every(s => varMap.has(this.vn(i, d, s)));
              if (!allExist) {
                auxVars.push("");
                continue;
              }
              const yVar = `y_${i}_${d}_r${ruleIdx}`;
              auxVars.push(yVar);
              if (options?.auxBinaryVars) options.auxBinaryVars.push(yVar);
              for (const s of rule.shifts) {
                lines.push(`  c${cIdx.val++}: ${yVar} - ${this.vn(i, d, s)} <= 0`);
              }
              const sumTerms = rule.shifts.map((s, idx) => idx === 0 ? this.vn(i, d, s) : `+ ${this.vn(i, d, s)}`);
              lines.push(`  c${cIdx.val++}:`);
              lines.push(writeTerms([...sumTerms, `- ${rule.shifts.length} ${yVar}`], 10));
              lines.push(`  <= ${rule.shifts.length - 1}`);
            }

            for (let dStart = 0; dStart <= D - windowSize; dStart++) {
              const windowYVars: string[] = [];
              let reqDays = 0;
              const memberReqs = this.staff[i].requested || [];
              for (let dd = 0; dd < windowSize; dd++) {
                const yv = auxVars[dStart + dd];
                if (yv) windowYVars.push(yv);
                const dayIdx = dStart + 1 + dd;
                const allReq = rule.shifts.every(s =>
                  memberReqs.some(r => r.date === dayIdx && r.shift === s)
                );
                if (allReq) reqDays++;
              }
              const effectiveMax = Math.max(rule.maxDays, reqDays);
              if (windowYVars.length > 0 && effectiveMax < windowYVars.length) {
                const terms = windowYVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
                lines.push(`  c${cIdx.val++}:`);
                lines.push(writeTerms(terms, 10));
                lines.push(`  <= ${effectiveMax}`);
              }
            }
          } else {
            for (let dStart = 0; dStart <= D - windowSize; dStart++) {
              let reqCount = 0;
              const memberReqs = this.staff[i].requested || [];
              for (let dd = 0; dd < windowSize; dd++) {
                const dayIdx = dStart + 1 + dd;
                for (let ri = 0; ri < memberReqs.length; ri++) {
                  const r = memberReqs[ri];
                  if (r.date === dayIdx && rule.shifts.indexOf(r.shift) >= 0) {
                    reqCount++;
                  }
                }
              }
              const effectiveMax = Math.max(rule.maxDays, reqCount);
              const windowVars: string[] = [];
              for (let dd = 0; dd < windowSize; dd++) {
                const d = dStart + dd;
                for (const s of rule.shifts) {
                  const v = this.vn(i, d, s);
                  if (varMap.has(v)) windowVars.push(v);
                }
              }
              if (windowVars.length > 0 && effectiveMax < windowVars.length) {
                const terms = windowVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
                lines.push(`  c${cIdx.val++}:`);
                lines.push(writeTerms(terms, 10));
                lines.push(`  <= ${effectiveMax}`);
              }
            }
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

    for (let i = 0; i < N; i++) {
      const requested = this.staff[i].requested || [];
      for (const req of requested) {
        const d = req.date - 1;
        if (d < 0 || d >= D) continue;
        const v = this.vn(i, d, req.shift);
        if (varMap.has(v)) {
          lines.push(`  c${cIdx.val++}: ${v} = 1`);
        }
      }
    }

    if (this.config.staffLevels && this.config.staffLevels.length > 0 && this.config.minStaffPerLevel) {
      const numLevels = this.config.staffLevels.length;
      const useSoft = this.softLevelConstraints && options?.levelSlackVars;
      for (let d = 0; d < D; d++) {
        const dayStaffPerShift = this.getStaffPerShiftForDay(d + 1);
        for (let s = 0; s < S; s++) {
          if (dayStaffPerShift[s] === 0) continue;
          for (let lvl = 0; lvl < numLevels; lvl++) {
            const minRequired = this.config.minStaffPerLevel[s]?.[lvl] || 0;
            if (minRequired <= 0) continue;
            const levelVars: string[] = [];
            for (let i = 0; i < N; i++) {
              if ((this.staff[i].level ?? 0) !== lvl) continue;
              const v = this.vn(i, d, s);
              if (varMap.has(v)) levelVars.push(v);
            }
            if (levelVars.length > 0) {
              if (useSoft) {
                const slackVar = `lslk_${d}_${s}_${lvl}`;
                options.levelSlackVars!.push(slackVar);
                const terms = levelVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
                terms.push(`+ ${slackVar}`);
                lines.push(`  c${cIdx.val++}:`);
                lines.push(writeTerms(terms, 10));
                lines.push(`  >= ${minRequired}`);
              } else {
                const terms = levelVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
                lines.push(`  c${cIdx.val++}:`);
                lines.push(writeTerms(terms, 10));
                lines.push(`  >= ${minRequired}`);
              }
            }
          }
        }
      }
    }
  }

  private buildPhase1Model(
    varMap: Map<string, { staff: number; day: number; shift: number }>,
    binaryVars: string[]
  ): { model: string; slackVars: string[]; levelSlackVars: string[] } {
    const N = this.staff.length;
    const D = this.daysInMonth;
    const S = this.config.shiftNames.length;
    const slackVars: string[] = [];
    const levelSlackVars: string[] = [];

    for (let d = 0; d < D; d++) {
      const required = this.getStaffPerShiftForDay(d + 1);
      for (let s = 0; s < S; s++) {
        if (required[s] === 0) continue;
        slackVars.push(`u_${d}_${s}`);
      }
    }

    const constraintLines: string[] = [];
    const cIdx = { val: 0 };
    const auxBinaryVars: string[] = [];
    this.writeCommonConstraints(constraintLines, varMap, cIdx, { skipStaffingCap: true, levelSlackVars, auxBinaryVars });

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
          constraintLines.push(`  c${cIdx.val++}:`);
          constraintLines.push(writeTerms(terms, 10));
          constraintLines.push(`  = ${required[s]}`);
        } else {
          constraintLines.push(`  c${cIdx.val++}: ${uVar} = ${required[s]}`);
        }
      }
    }

    const lines: string[] = [];
    lines.push("Minimize");
    lines.push("  obj:");
    const objParts = slackVars.map((v, idx) => {
      return idx === 0 ? `1000 ${v}` : `+ 1000 ${v}`;
    });
    for (const lv of levelSlackVars) {
      objParts.push(`+ 100 ${lv}`);
    }
    lines.push(writeTerms(objParts, 10));

    lines.push("Subject To");
    lines.push(...constraintLines);

    lines.push("Bounds");
    for (const uVar of slackVars) {
      lines.push(`  ${uVar} >= 0`);
    }
    for (const lv of levelSlackVars) {
      lines.push(`  ${lv} >= 0`);
    }

    const allBinary = [...binaryVars, ...auxBinaryVars];
    lines.push("Binary");
    for (let i = 0; i < allBinary.length; i += 20) {
      lines.push("  " + allBinary.slice(i, i + 20).join(" "));
    }

    lines.push("End");
    return { model: lines.join("\n"), slackVars, levelSlackVars };
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

    const RANGE_W = 1_000_000;
    const SHIFT_W = 1_000;
    const HOLIDAY_W = 100;
    const LEVEL_W = 10;

    const enableHolidayBalance = this.config.balanceHolidays && this.holidayDays.size > 0;

    const totalMaxShifts = this.staff.reduce((sum, s) => sum + s.maxShifts, 0);
    const staffShiftTargets = phase1Targets.perShift.map(total =>
      this.staff.map(s => total * (s.maxShifts / totalMaxShifts))
    );
    const staffHolidayTargets = enableHolidayBalance
      ? this.staff.map(s => phase1Targets.holidayTotal * (s.maxShifts / totalMaxShifts))
      : this.staff.map(() => 0);

    const levelSlackVars: string[] = [];
    const constraintLines: string[] = [];
    const cIdx = { val: 0 };
    const auxBinaryVars: string[] = [];
    this.writeCommonConstraints(constraintLines, varMap, cIdx, { levelSlackVars, auxBinaryVars });

    for (let d = 0; d < D; d++) {
      const required = this.getStaffPerShiftForDay(d + 1);
      for (let s = 0; s < S; s++) {
        if (required[s] === 0) continue;
        const slotKey = `${d}_${s}`;
        const p1Coverage = phase1Targets.slotCoverage.get(slotKey) || 0;
        if (p1Coverage <= 0) continue;
        const shiftVars: string[] = [];
        for (let i = 0; i < N; i++) {
          const v = this.vn(i, d, s);
          if (varMap.has(v)) shiftVars.push(v);
        }
        if (shiftVars.length > 0) {
          const terms = shiftVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
          constraintLines.push(`  c${cIdx.val++}:`);
          constraintLines.push(writeTerms(terms, 10));
          if (p1Coverage >= required[s]) {
            constraintLines.push(`  = ${required[s]}`);
          } else {
            constraintLines.push(`  >= ${p1Coverage}`);
          }
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
      if (staffVars.length === 0) continue;

      const defTerms = staffVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
      defTerms.push(`- tw_${i}`);
      constraintLines.push(`  c${cIdx.val++}:`);
      constraintLines.push(writeTerms(defTerms, 10));
      constraintLines.push(`  = 0`);

      constraintLines.push(`  c${cIdx.val++}: tw_${i} - maxLoad <= 0`);
      constraintLines.push(`  c${cIdx.val++}: - tw_${i} + minLoad <= 0`);
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
        constraintLines.push(`  c${cIdx.val++}:`);
        constraintLines.push(writeTerms(defTerms, 10));
        constraintLines.push(`  = 0`);

        constraintLines.push(`  c${cIdx.val++}: ts_${i}_${s} - ds_${i}_${s} <= ${fmt(target)}`);
        constraintLines.push(`  c${cIdx.val++}: - ts_${i}_${s} - ds_${i}_${s} <= ${fmt(-target)}`);
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
        constraintLines.push(`  c${cIdx.val++}:`);
        constraintLines.push(writeTerms(defTerms, 10));
        constraintLines.push(`  = 0`);

        constraintLines.push(`  c${cIdx.val++}: th_${i} - dh_${i} <= ${fmt(hTarget)}`);
        constraintLines.push(`  c${cIdx.val++}: - th_${i} - dh_${i} <= ${fmt(-hTarget)}`);
      }
    }

    const lines: string[] = [];
    lines.push("Minimize");
    lines.push("  obj:");
    const objParts: string[] = [];
    objParts.push(`${RANGE_W} maxLoad`);
    objParts.push(`- ${RANGE_W} minLoad`);
    for (let i = 0; i < N; i++) {
      for (let s = 0; s < S; s++) {
        if (staffShiftTargets[s][i] > 0) {
          objParts.push(`+ ${SHIFT_W} ds_${i}_${s}`);
        }
      }
    }
    if (enableHolidayBalance && staffHolidayTargets.some(t => t > 0)) {
      for (let i = 0; i < N; i++) {
        objParts.push(`+ ${HOLIDAY_W} dh_${i}`);
      }
    }
    for (const lv of levelSlackVars) {
      objParts.push(`+ ${LEVEL_W} ${lv}`);
    }
    lines.push(writeTerms(objParts, 8));

    lines.push("Subject To");
    lines.push(...constraintLines);

    lines.push("Bounds");
    lines.push(`  maxLoad >= 0`);
    lines.push(`  minLoad >= 0`);
    for (let i = 0; i < N; i++) {
      lines.push(`  tw_${i} >= 0`);
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
    for (const lv of levelSlackVars) {
      lines.push(`  ${lv} >= 0`);
    }

    const allBinary = [...binaryVars, ...auxBinaryVars];
    lines.push("Binary");
    for (let i = 0; i < allBinary.length; i += 20) {
      lines.push("  " + allBinary.slice(i, i + 20).join(" "));
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

  private greedyFillUnfilled(schedule: DaySchedule[]): number {
    const S = this.config.shiftNames.length;
    const D = this.daysInMonth;

    const rebuildState = () => {
      const totals = new Map<string, number>();
      const dayAssigned = new Map<string, Set<number>>();
      for (const member of this.staff) {
        totals.set(member.id, 0);
        dayAssigned.set(member.id, new Set<number>());
      }
      for (let d = 0; d < D; d++) {
        for (let s = 0; s < S; s++) {
          for (const staffId of schedule[d].shifts[s]) {
            if (!staffId) continue;
            totals.set(staffId, (totals.get(staffId) || 0) + 1);
            dayAssigned.get(staffId)?.add(d);
          }
        }
      }
      return { totals, dayAssigned };
    };

    const doPass = (): number => {
      const { totals, dayAssigned } = rebuildState();
      let passCount = 0;
      for (let d = 0; d < D; d++) {
        const required = this.getStaffPerShiftForDay(d + 1);
        for (let s = 0; s < S; s++) {
          if (required[s] === 0) continue;
          const arr = schedule[d].shifts[s];
          for (let pos = 0; pos < arr.length; pos++) {
            if (arr[pos] !== "") continue;

            const candidates: { idx: number; id: string; total: number }[] = [];
            for (let i = 0; i < this.staff.length; i++) {
              const member = this.staff[i];
              const currentTotal = totals.get(member.id) || 0;
              if (currentTotal >= member.maxShifts) continue;
              if (this.isBlocked(i, d, s)) continue;

              const maxPerDay = this.config.shiftsPerDay || S;
              const memberReqs = member.requested || [];
              let reqOnDay = 0;
              for (let ri = 0; ri < memberReqs.length; ri++) {
                if (memberReqs[ri].date === d + 1) reqOnDay++;
              }
              const effectiveMaxPerDay = Math.max(maxPerDay, reqOnDay);
              const dayShifts = dayAssigned.get(member.id);
              if (dayShifts && dayShifts.has(d)) {
                let dayCount = 0;
                for (let ss = 0; ss < S; ss++) {
                  if (schedule[d].shifts[ss].includes(member.id)) dayCount++;
                }
                if (dayCount >= effectiveMaxPerDay) continue;
              }

              let violatesConsecutive = false;
              for (const rule of this.config.consecutiveRules) {
                const ruleType = rule.type || 'nextDay';
                if (ruleType === 'nextDay') {
                  if (rule.to === s && d > 0) {
                    if (schedule[d - 1].shifts[rule.from]?.includes(member.id)) {
                      violatesConsecutive = true;
                      break;
                    }
                  }
                  if (rule.from === s && d < D - 1) {
                    if (schedule[d + 1].shifts[rule.to]?.includes(member.id)) {
                      violatesConsecutive = true;
                      break;
                    }
                  }
                } else {
                  if (rule.from === s && schedule[d].shifts[rule.to]?.includes(member.id)) {
                    violatesConsecutive = true;
                    break;
                  }
                  if (rule.to === s && schedule[d].shifts[rule.from]?.includes(member.id)) {
                    violatesConsecutive = true;
                    break;
                  }
                }
              }
              if (violatesConsecutive) continue;

              if (this.config.maxConsecutiveRules) {
                let violatesMaxConsec = false;
                for (const rule of this.config.maxConsecutiveRules) {
                  if (!rule.shifts.includes(s)) continue;
                  const isCombined = rule.shifts.length > 1;
                  if (isCombined) {
                    const wouldHaveAll = rule.shifts.every(rs => {
                      if (rs === s) return true;
                      return schedule[d].shifts[rs]?.includes(member.id);
                    });
                    if (!wouldHaveAll) continue;
                    let consecutive = 1;
                    for (let dd = d - 1; dd >= 0; dd--) {
                      const allOnDay = rule.shifts.every(rs => schedule[dd].shifts[rs]?.includes(member.id));
                      if (allOnDay) consecutive++; else break;
                    }
                    for (let dd = d + 1; dd < D; dd++) {
                      const allOnDay = rule.shifts.every(rs => schedule[dd].shifts[rs]?.includes(member.id));
                      if (allOnDay) consecutive++; else break;
                    }
                    if (consecutive > rule.maxDays) { violatesMaxConsec = true; break; }
                  } else {
                    let consecutive = 1;
                    for (let dd = d - 1; dd >= 0; dd--) {
                      let found = false;
                      for (const rs of rule.shifts) {
                        if (schedule[dd].shifts[rs]?.includes(member.id)) { found = true; break; }
                      }
                      if (found) consecutive++; else break;
                    }
                    for (let dd = d + 1; dd < D; dd++) {
                      let found = false;
                      for (const rs of rule.shifts) {
                        if (schedule[dd].shifts[rs]?.includes(member.id)) { found = true; break; }
                      }
                      if (found) consecutive++; else break;
                    }
                    if (consecutive > rule.maxDays) { violatesMaxConsec = true; break; }
                  }
                }
                if (violatesMaxConsec) continue;
              }

              if (arr.includes(member.id)) continue;
              candidates.push({ idx: i, id: member.id, total: currentTotal });
            }

            if (candidates.length > 0) {
              if (this.config.staffLevels && this.config.minStaffPerLevel) {
                const levelCounts: number[] = this.config.staffLevels.map(() => 0);
                for (const id of arr) {
                  if (!id) continue;
                  const member = this.staff.find(m => m.id === id);
                  if (member) levelCounts[member.level ?? 0]++;
                }
                const minReqs = this.config.minStaffPerLevel[s] || [];
                candidates.sort((a, b) => {
                  const aLevel = this.staff[a.idx].level ?? 0;
                  const bLevel = this.staff[b.idx].level ?? 0;
                  const aNeeded = (minReqs[aLevel] || 0) - levelCounts[aLevel];
                  const bNeeded = (minReqs[bLevel] || 0) - levelCounts[bLevel];
                  if (aNeeded > 0 && bNeeded <= 0) return -1;
                  if (bNeeded > 0 && aNeeded <= 0) return 1;
                  return a.total - b.total;
                });
              } else {
                candidates.sort((a, b) => a.total - b.total);
              }
              const chosen = candidates[0];
              arr[pos] = chosen.id;
              totals.set(chosen.id, chosen.total + 1);
              dayAssigned.get(chosen.id)?.add(d);
              passCount++;
            }
          }
        }
      }
      return passCount;
    };

    let filled = 0;
    for (let pass = 0; pass < 3; pass++) {
      const count = doPass();
      filled += count;
      if (count === 0) break;
    }

    return filled;
  }

  private diagnoseUnfilled(schedule: DaySchedule[]): string[] {
    const S = this.config.shiftNames.length;
    const D = this.daysInMonth;
    const diagnostics: string[] = [];
    const unfilled = this.findUnfilledSlots(schedule);
    if (unfilled.length === 0) return diagnostics;

    const staffTotals = new Map<string, number>();
    for (const member of this.staff) staffTotals.set(member.id, 0);
    for (let d = 0; d < D; d++) {
      for (let s = 0; s < S; s++) {
        for (const staffId of schedule[d].shifts[s]) {
          if (staffId) staffTotals.set(staffId, (staffTotals.get(staffId) || 0) + 1);
        }
      }
    }

    for (const slot of unfilled) {
      const d = slot.date - 1;
      const s = slot.shiftIdx;
      const reasons: { name: string; reason: string }[] = [];

      for (let i = 0; i < this.staff.length; i++) {
        const member = this.staff[i];
        const currentTotal = staffTotals.get(member.id) || 0;

        if (schedule[d].shifts[s].includes(member.id)) {
          continue;
        }
        if (currentTotal >= member.maxShifts) {
          reasons.push({ name: member.name, reason: "at maxShifts" });
          continue;
        }
        if (this.isBlocked(i, d, s)) {
          reasons.push({ name: member.name, reason: "blocked" });
          continue;
        }

        const maxPerDay = this.config.shiftsPerDay || S;
        let dayCount = 0;
        for (let ss = 0; ss < S; ss++) {
          if (schedule[d].shifts[ss].includes(member.id)) dayCount++;
        }
        if (dayCount >= maxPerDay) {
          reasons.push({ name: member.name, reason: `at maxPerDay(${maxPerDay})` });
          continue;
        }

        let consecutiveBlock = "";
        for (const rule of this.config.consecutiveRules) {
          const ruleType = rule.type || 'nextDay';
          if (ruleType === 'nextDay') {
            if (rule.to === s && d > 0) {
              if (schedule[d - 1].shifts[rule.from]?.includes(member.id)) {
                consecutiveBlock = `worked ${this.config.shiftNames[rule.from]} on Day${slot.date - 1}`;
                break;
              }
            }
            if (rule.from === s && d < D - 1) {
              if (schedule[d + 1].shifts[rule.to]?.includes(member.id)) {
                consecutiveBlock = `works ${this.config.shiftNames[rule.to]} on Day${slot.date + 1}`;
                break;
              }
            }
          } else {
            if (rule.from === s && schedule[d].shifts[rule.to]?.includes(member.id)) {
              consecutiveBlock = `works ${this.config.shiftNames[rule.to]} same day`;
              break;
            }
            if (rule.to === s && schedule[d].shifts[rule.from]?.includes(member.id)) {
              consecutiveBlock = `works ${this.config.shiftNames[rule.from]} same day`;
              break;
            }
          }
        }
        if (consecutiveBlock) {
          reasons.push({ name: member.name, reason: `consecutive rule: ${consecutiveBlock}` });
          continue;
        }

        if (this.config.maxConsecutiveRules) {
          let maxConsecBlock = "";
          for (const rule of this.config.maxConsecutiveRules) {
            if (!rule.shifts.includes(s)) continue;
            const isCombined = rule.shifts.length > 1;
            if (isCombined) {
              const wouldHaveAll = rule.shifts.every(rs => {
                if (rs === s) return true;
                return schedule[d].shifts[rs]?.includes(member.id);
              });
              if (!wouldHaveAll) continue;
              let consecutive = 1;
              for (let dd = d - 1; dd >= 0; dd--) {
                const allOnDay = rule.shifts.every(rs => schedule[dd].shifts[rs]?.includes(member.id));
                if (allOnDay) consecutive++; else break;
              }
              for (let dd = d + 1; dd < D; dd++) {
                const allOnDay = rule.shifts.every(rs => schedule[dd].shifts[rs]?.includes(member.id));
                if (allOnDay) consecutive++; else break;
              }
              if (consecutive > rule.maxDays) {
                const shiftNames = rule.shifts.map(si => this.config.shiftNames[si]).join("+");
                maxConsecBlock = `max ${rule.maxDays} consecutive ${shiftNames}`;
                break;
              }
            } else {
              let consecutive = 1;
              for (let dd = d - 1; dd >= 0; dd--) {
                let found = false;
                for (const rs of rule.shifts) {
                  if (schedule[dd].shifts[rs]?.includes(member.id)) { found = true; break; }
                }
                if (found) consecutive++; else break;
              }
              for (let dd = d + 1; dd < D; dd++) {
                let found = false;
                for (const rs of rule.shifts) {
                  if (schedule[dd].shifts[rs]?.includes(member.id)) { found = true; break; }
                }
                if (found) consecutive++; else break;
              }
              if (consecutive > rule.maxDays) {
                const shiftNames = rule.shifts.map(si => this.config.shiftNames[si]).join("+");
                maxConsecBlock = `max ${rule.maxDays} consecutive ${shiftNames}`;
                break;
              }
            }
          }
          if (maxConsecBlock) {
            reasons.push({ name: member.name, reason: maxConsecBlock });
            continue;
          }
        }

        reasons.push({ name: member.name, reason: "unknown" });
      }

      const grouped: Record<string, string[]> = {};
      for (const r of reasons) {
        if (!grouped[r.reason]) grouped[r.reason] = [];
        grouped[r.reason].push(r.name);
      }
      const summary = Object.entries(grouped).map(([reason, names]) =>
        `${names.length} staff ${reason}`
      ).join(", ");

      diagnostics.push(`Day${slot.date}-${slot.shiftName}(${slot.assigned}/${slot.required}): ${summary}`);
    }

    return diagnostics;
  }

  private makeEmptyResult(warning: string, diagnostics?: string[]): OptimizerResult {
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
      feasibilityWarning: warning,
      diagnostics: diagnostics
    };
  }

  public async optimize(): Promise<OptimizerResult> {
    const feasibility = this.checkFeasibility();
    const allWarnings = [...feasibility.softWarnings];
    const feasibilityMsg = [...feasibility.hardErrors, ...feasibility.levelErrors, ...feasibility.softWarnings].join(" ") || null;
    let levelAutoSoftened = false;

    if (feasibility.hardErrors.length > 0) {
      console.error(`[OPT] HARD infeasibility detected, aborting solver:`, feasibility.hardErrors);
      return this.makeEmptyResult(
        feasibility.hardErrors.join(" "),
        [...feasibility.hardErrors, ...feasibility.levelErrors]
      );
    }

    if (feasibility.levelErrors.length > 0) {
      if (!this.softLevelConstraints) {
        console.warn(`[OPT] Level infeasibility detected, auto-downgrading to soft level constraints:`, feasibility.levelErrors);
        this.softLevelConstraints = true;
        levelAutoSoftened = true;
      }
    }

    const { varMap, binaryVars } = this.prepareVariables();

    if (varMap.size === 0) {
      return this.makeEmptyResult(feasibilityMsg || "No eligible assignments found.", feasibility.levelErrors);
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
    if (levelAutoSoftened) {
      console.log(`[OPT] Level constraints auto-softened due to level infeasibility`);
    }

    const { model: phase1Model } = this.buildPhase1Model(varMap, binaryVars);
    let phase1Solution: any;
    try {
      phase1Solution = solver.solve(phase1Model, {
        time_limit: 30.0,
        presolve: "on",
        mip_rel_gap: 0.005,
        threads: 1,
      });
    } catch (err: any) {
      console.error("[OPT] Phase 1 solver CRASH:", err);
      return this.makeEmptyResult(`Solver crashed during coverage optimization: ${err?.message || "Unknown error"}.`);
    }

    console.log(`[OPT] Phase 1 status: ${phase1Solution.Status}, ObjectiveValue: ${phase1Solution.ObjectiveValue}`);

    if (phase1Solution.Status === "Time limit reached" && phase1Solution.Columns) {
      console.warn(`[OPT] Phase 1 hit time limit, using best solution found so far`);
    } else if (failStatuses.includes(phase1Solution.Status) || !phase1Solution.Columns) {
      console.error(`[OPT] Phase 1 FAILED: ${phase1Solution.Status}`);

      if (phase1Solution.Status === "Infeasible" && !this.softLevelConstraints &&
          this.config.staffLevels && this.config.staffLevels.length > 0 && this.config.minStaffPerLevel) {
        console.warn(`[OPT] Phase 1 infeasible — retrying with soft level constraints`);
        this.softLevelConstraints = true;
        levelAutoSoftened = true;
        const { model: retryModel } = this.buildPhase1Model(varMap, binaryVars);
        try {
          phase1Solution = solver.solve(retryModel, {
            time_limit: 30.0,
            presolve: "on",
            mip_rel_gap: 0.005,
            threads: 1,
          });
          console.log(`[OPT] Phase 1 retry status: ${phase1Solution.Status}, ObjectiveValue: ${phase1Solution.ObjectiveValue}`);
          if (phase1Solution.Status === "Time limit reached" && phase1Solution.Columns) {
            console.warn(`[OPT] Phase 1 retry hit time limit, using best solution found`);
          } else if (failStatuses.includes(phase1Solution.Status) || !phase1Solution.Columns) {
            console.error(`[OPT] Phase 1 retry also FAILED: ${phase1Solution.Status}`);
            let infeasibleMsg = feasibilityMsg || "";
            if (phase1Solution.Status === "Time limit reached") {
              infeasibleMsg = "Time limit reached and no feasible solution found. Try reducing constraints or adding more staff.";
            }
            return this.makeEmptyResult(infeasibleMsg || `Phase 1 solver status: ${phase1Solution.Status}.`);
          }
        } catch (err: any) {
          console.error("[OPT] Phase 1 retry CRASH:", err);
          return this.makeEmptyResult(`Solver crashed during retry: ${err?.message || "Unknown error"}.`);
        }
      } else {
        let infeasibleMsg = feasibilityMsg || "";
        if (phase1Solution.Status === "Infeasible" && !feasibilityMsg) {
          const totalReq = this.config.staffPerShift.reduce((a, b) => a + b, 0);
          infeasibleMsg = `Infeasible: constraints conflict. Staff per day: ${totalReq}, Staff count: ${this.staff.length}, Shifts: ${this.config.shiftNames.length}, Rules: ${this.config.consecutiveRules.length} consecutive + ${(this.config.maxConsecutiveRules || []).length} max-consecutive. Try: reduce staff-per-shift, relax consecutive rules, remove conflicting requested shifts, or add more staff.`;
        }
        if (phase1Solution.Status === "Time limit reached") {
          infeasibleMsg = "Time limit reached and no feasible solution found. Try reducing constraints or adding more staff.";
        }
        return this.makeEmptyResult(infeasibleMsg || `Phase 1 solver status: ${phase1Solution.Status}.`);
      }
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
        time_limit: 30.0,
        presolve: "on",
        mip_rel_gap: 0.005,
        threads: 1,
      });

      console.log(`[OPT] Phase 2 status: ${phase2Solution.Status}, ObjectiveValue: ${phase2Solution.ObjectiveValue}`);

      if (phase2Solution.Status === "Time limit reached" && phase2Solution.Columns) {
        console.warn(`[OPT] Phase 2 hit time limit, using best solution found so far`);
        finalSolution = phase2Solution;
      } else if (failStatuses.includes(phase2Solution.Status) || !phase2Solution.Columns) {
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

    let unfilledBefore = this.findUnfilledSlots(schedule);
    const coverageBefore = totalRequired - unfilledBefore.reduce((sum, u) => sum + (u.required - u.assigned), 0);
    console.log(`[OPT] Solver result (Phase ${usedPhase}): coverage ${coverageBefore}/${totalRequired}, unfilled slots: ${unfilledBefore.length}`);

    if (unfilledBefore.length > 0) {
      const greedyFilled = this.greedyFillUnfilled(schedule);
      if (greedyFilled > 0) {
        console.log(`[OPT] Greedy post-fill: filled ${greedyFilled} slot(s) respecting all hard constraints`);
      }
    }

    const metrics = this.calculateMetricsFromSchedule(schedule);
    const unfilledSlots = this.findUnfilledSlots(schedule);

    const finalCoverage = metrics.perStaff.reduce((sum: number, s: any) => sum + s.total, 0);
    console.log(`[OPT] Final result: coverage ${finalCoverage}/${totalRequired}, unfilled slots: ${unfilledSlots.length}`);
    const resultDiagnostics: string[] = [...feasibility.levelErrors];
    if (unfilledSlots.length > 0) {
      console.log(`[OPT] Unfilled: ${unfilledSlots.slice(0, 10).map(u => `Day${u.date}-${u.shiftName}(${u.assigned}/${u.required})`).join(', ')}${unfilledSlots.length > 10 ? '...' : ''}`);
      const unfilledDiags = this.diagnoseUnfilled(schedule);
      for (const diag of unfilledDiags) {
        console.log(`[OPT] Diagnosis: ${diag}`);
        resultDiagnostics.push(diag);
      }
    }

    const result: OptimizerResult = {
      schedule,
      metrics,
      levelAutoSoftened
    };

    if (resultDiagnostics.length > 0) {
      result.diagnostics = resultDiagnostics;
    }

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

