import type { StaffMember, SchedulerConfig, DaySchedule, OptimizerResult, UnfilledSlot } from "@shared/schema";
import { getDaysInMonth, differenceInCalendarDays, addDays, parseISO } from "date-fns";

let _cachedHighsFactory: any = null;

async function loadHighsFactory(): Promise<any> {
  if (_cachedHighsFactory) return _cachedHighsFactory;
  const response = await fetch("/highs.js");
  const code = await response.text();
  const wrappedCode = code + "\nreturn Module;";
  const factory = new Function(wrappedCode)();
  _cachedHighsFactory = factory;
  return factory;
}

async function createSolver(): Promise<any> {
  const highsFactory = await loadHighsFactory();
  const solver = await highsFactory({
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
  private coverageThreshold = 0.2;

  private getActualDate(dayIndex: number): Date {
    if (this.rangeStartDate) {
      return addDays(this.rangeStartDate, dayIndex - 1);
    }
    return new Date(this.year, this.month - 1, dayIndex);
  }

  constructor(config: SchedulerConfig, staff: StaffMember[], month: number, year: number, _options?: { softLevelConstraints?: boolean }) {
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

  private checkLevelFillability(): { canFillAll: boolean; levelShortages: string[] } {
    const S = this.config.shiftNames.length;
    const levelShortages: string[] = [];

    if (!this.config.staffLevels || this.config.staffLevels.length === 0 || !this.config.minStaffPerLevel) {
      return { canFillAll: true, levelShortages: [] };
    }

    for (let shiftIdx = 0; shiftIdx < S; shiftIdx++) {
      const sumLevelMins = this.config.staffLevels.reduce((sum, _, lvl) => {
        return sum + (this.config.minStaffPerLevel![shiftIdx]?.[lvl] || 0);
      }, 0);
      const shiftCapacity = this.config.staffPerShift[shiftIdx] || 0;
      if (sumLevelMins > shiftCapacity && shiftCapacity > 0) {
        levelShortages.push(
          `Shift "${this.config.shiftNames[shiftIdx]}": sum of level minimums (${sumLevelMins}) exceeds shift capacity (${shiftCapacity}).`
        );
      }

      for (let lvl = 0; lvl < this.config.staffLevels.length; lvl++) {
        const minReq = this.config.minStaffPerLevel[shiftIdx]?.[lvl] || 0;
        if (minReq <= 0) continue;
        const totalAtLevel = this.staff.filter(s => (s.level ?? 0) === lvl).length;
        if (totalAtLevel < minReq) {
          levelShortages.push(
            `Shift "${this.config.shiftNames[shiftIdx]}": needs ${minReq} "${this.config.staffLevels[lvl]}" but only ${totalAtLevel} exist.`
          );
        }
      }
    }

    if (levelShortages.length > 0) {
      return { canFillAll: false, levelShortages };
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
            if (levelShortages.length < 10) {
              levelShortages.push(
                `Day ${day}, "${this.config.shiftNames[shiftIdx]}": needs ${minReq} "${this.config.staffLevels[lvl]}" but only ${availableAtLevel} available.`
              );
            }
          }
        }
      }
    }

    return {
      canFillAll: levelShortages.length === 0,
      levelShortages
    };
  }

  private checkFeasibility(): { hardErrors: string[]; levelErrors: string[]; softWarnings: string[] } {
    const hardErrors: string[] = [];
    const levelErrors: string[] = [];
    const softWarnings: string[] = [];
    const S = this.config.shiftNames.length;

    let hasAnyAvailable = false;
    for (let day = 1; day <= this.daysInMonth; day++) {
      const dayStaffPerShift = this.getStaffPerShiftForDay(day);
      for (let shiftIdx = 0; shiftIdx < S; shiftIdx++) {
        const required = dayStaffPerShift[shiftIdx];
        if (required <= 0) continue;
        let available = 0;
        for (const member of this.staff) {
          const isBlocked = member.blocked.some(b => b.date === day && (b.shift === -1 || b.shift === shiftIdx));
          if (!isBlocked) available++;
        }
        if (available > 0) hasAnyAvailable = true;
        if (available < required) {
          softWarnings.push(
            `Day ${day}, Shift "${this.config.shiftNames[shiftIdx]}": needs ${required} staff but only ${available} available.`
          );
        }
      }
    }
    if (!hasAnyAvailable) {
      hardErrors.push("All staff are blocked on all days/shifts. No assignments are possible.");
    }

    const totalMaxShifts = this.staff.reduce((sum, s) => sum + s.maxShifts, 0);
    let totalRequired = 0;
    for (let d = 0; d < this.daysInMonth; d++) {
      const req = this.getStaffPerShiftForDay(d + 1);
      for (let s = 0; s < S; s++) totalRequired += req[s];
    }
    if (totalMaxShifts === 0) {
      hardErrors.push("All staff have maxShifts set to 0. No assignments are possible.");
    } else if (totalMaxShifts < totalRequired) {
      softWarnings.push(
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
              if (levelErrors.length < 10) {
                levelErrors.push(
                  `Day ${day}, "${this.config.shiftNames[shiftIdx]}": needs ${minReq} "${this.config.staffLevels[lvl]}" but only ${availableAtLevel} available (not blocked).`
                );
              }
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

  private computePerShiftAvailability(shiftIdx: number): number[] {
    const D = this.daysInMonth;
    return this.staff.map((_, i) => {
      let count = 0;
      for (let d = 0; d < D; d++) {
        const req = this.getStaffPerShiftForDay(d + 1)[shiftIdx];
        if (req > 0 && !this.isBlocked(i, d, shiftIdx)) count++;
      }
      return count;
    });
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
    options?: { skipStaffingCap?: boolean; auxBinaryVars?: string[] }
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

  }

  private writeSoftLevelConstraints(
    lines: string[],
    varMap: Map<string, { staff: number; day: number; shift: number }>,
    cIdx: { val: number },
    levelSlackVars: string[]
  ): void {
    if (!this.config.staffLevels || this.config.staffLevels.length === 0 || !this.config.minStaffPerLevel) return;
    const N = this.staff.length;
    const D = this.daysInMonth;
    const S = this.config.shiftNames.length;
    const numLevels = this.config.staffLevels.length;

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
            const slackVar = `lslk_${d}_${s}_${lvl}`;
            levelSlackVars.push(slackVar);
            const terms = levelVars.map((v, idx) => idx === 0 ? v : `+ ${v}`);
            terms.push(`+ ${slackVar}`);
            lines.push(`  c${cIdx.val++}:`);
            lines.push(writeTerms(terms, 10));
            lines.push(`  >= ${minRequired}`);
          }
        }
      }
    }
  }

  private buildCoverageModel(
    varMap: Map<string, { staff: number; day: number; shift: number }>,
    binaryVars: string[]
  ): { model: string; slackVars: string[] } {
    const N = this.staff.length;
    const D = this.daysInMonth;
    const S = this.config.shiftNames.length;
    const slackVars: string[] = [];

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
    this.writeCommonConstraints(constraintLines, varMap, cIdx, { skipStaffingCap: true, auxBinaryVars });

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
    lines.push(writeTerms(objParts, 10));

    lines.push("Subject To");
    lines.push(...constraintLines);

    lines.push("Bounds");
    for (const uVar of slackVars) {
      lines.push(`  ${uVar} >= 0`);
    }

    const allBinary = [...binaryVars, ...auxBinaryVars];
    lines.push("Binary");
    for (let i = 0; i < allBinary.length; i += 20) {
      lines.push("  " + allBinary.slice(i, i + 20).join(" "));
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

  private writeCoverageConstraints(
    constraintLines: string[],
    varMap: Map<string, { staff: number; day: number; shift: number }>,
    cIdx: { val: number },
    phase1Targets: { slotCoverage: Map<string, number> }
  ) {
    const N = this.staff.length;
    const D = this.daysInMonth;
    const S = this.config.shiftNames.length;
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
  }

  private writeLoadTrackingConstraints(
    constraintLines: string[],
    varMap: Map<string, { staff: number; day: number; shift: number }>,
    cIdx: { val: number }
  ) {
    const N = this.staff.length;
    const D = this.daysInMonth;
    const S = this.config.shiftNames.length;
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
  }

  private buildRangeModel(
    varMap: Map<string, { staff: number; day: number; shift: number }>,
    binaryVars: string[],
    phase1Targets: { perShift: number[]; holidayTotal: number; totalCoverage: number; slotCoverage: Map<string, number> }
  ): string {
    const N = this.staff.length;

    const constraintLines: string[] = [];
    const cIdx = { val: 0 };
    const auxBinaryVars: string[] = [];
    this.writeCommonConstraints(constraintLines, varMap, cIdx, { auxBinaryVars });
    this.writeCoverageConstraints(constraintLines, varMap, cIdx, phase1Targets);
    this.writeLoadTrackingConstraints(constraintLines, varMap, cIdx);

    const lines: string[] = [];
    lines.push("Minimize");
    lines.push("  obj:");
    lines.push("  maxLoad - minLoad");

    lines.push("Subject To");
    lines.push(...constraintLines);

    lines.push("Bounds");
    lines.push(`  maxLoad >= 0`);
    lines.push(`  minLoad >= 0`);
    for (let i = 0; i < N; i++) {
      lines.push(`  tw_${i} >= 0`);
    }

    const allBinary = [...binaryVars, ...auxBinaryVars];
    lines.push("Binary");
    for (let i = 0; i < allBinary.length; i += 20) {
      lines.push("  " + allBinary.slice(i, i + 20).join(" "));
    }

    lines.push("End");
    return lines.join("\n");
  }

  private buildDistributionModel(
    varMap: Map<string, { staff: number; day: number; shift: number }>,
    binaryVars: string[],
    phase1Targets: { perShift: number[]; holidayTotal: number; totalCoverage: number; slotCoverage: Map<string, number> },
    bestRange: number
  ): string {
    const N = this.staff.length;
    const D = this.daysInMonth;
    const S = this.config.shiftNames.length;

    const SHIFT_W = 1_000;
    const HOLIDAY_W = 100;
    const LEVEL_W = 10;

    const enableHolidayBalance = this.config.balanceHolidays && this.holidayDays.size > 0;

    const staffShiftTargets = phase1Targets.perShift.map((total, s) => {
      const avail = this.computePerShiftAvailability(s);
      const totalAvail = avail.reduce((a, b) => a + b, 0);
      if (totalAvail === 0) return this.staff.map(() => 0);
      return this.staff.map((_, i) => total * (avail[i] / totalAvail));
    });
    const staffHolidayTargets = enableHolidayBalance
      ? (() => {
          const holAvail = this.staff.map((_, i) => {
            let count = 0;
            for (let d = 0; d < this.daysInMonth; d++) {
              if (!this.isHoliday(d + 1)) continue;
              for (let sv = 0; sv < this.config.shiftNames.length; sv++) {
                const req = this.getStaffPerShiftForDay(d + 1)[sv];
                if (req > 0 && !this.isBlocked(i, d, sv)) { count++; break; }
              }
            }
            return count;
          });
          const totalHolAvail = holAvail.reduce((a, b) => a + b, 0);
          if (totalHolAvail === 0) return this.staff.map(() => 0);
          return this.staff.map((_, i) => phase1Targets.holidayTotal * (holAvail[i] / totalHolAvail));
        })()
      : this.staff.map(() => 0);

    const levelSlackVars: string[] = [];
    const constraintLines: string[] = [];
    const cIdx = { val: 0 };
    const auxBinaryVars: string[] = [];
    this.writeCommonConstraints(constraintLines, varMap, cIdx, { auxBinaryVars });
    this.writeSoftLevelConstraints(constraintLines, varMap, cIdx, levelSlackVars);
    this.writeCoverageConstraints(constraintLines, varMap, cIdx, phase1Targets);
    this.writeLoadTrackingConstraints(constraintLines, varMap, cIdx);

    constraintLines.push(`  c${cIdx.val++}: maxLoad - minLoad <= ${fmt(bestRange)}`);

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
    let firstTerm = true;
    for (let i = 0; i < N; i++) {
      for (let s = 0; s < S; s++) {
        if (staffShiftTargets[s][i] > 0) {
          objParts.push(`${firstTerm ? "" : "+ "}${SHIFT_W} ds_${i}_${s}`);
          firstTerm = false;
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
    for (let i = 0; i < N; i++) {
      objParts.push(`+ ${fmt(1e-6)} tw_${i}`);
    }
    if (objParts.length === 0) {
      objParts.push("0 maxLoad");
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
    const levelCheck = this.checkLevelFillability();
    const hasLevels = !!(this.config.staffLevels && this.config.staffLevels.length > 0 && this.config.minStaffPerLevel);
    let levelAutoSoftened = hasLevels && !levelCheck.canFillAll;

    const feasibility = this.checkFeasibility();

    if (feasibility.hardErrors.length > 0) {
      console.error(`[OPT] Hard infeasibility detected — aborting before solver`);
      for (const e of feasibility.hardErrors) console.error(`[OPT]   ${e}`);
      const allDiags = [...feasibility.hardErrors, ...feasibility.levelErrors, ...feasibility.softWarnings];
      return this.makeEmptyResult(
        feasibility.hardErrors[0],
        allDiags
      );
    }

    if (feasibility.levelErrors.length > 0 && !levelAutoSoftened) {
      console.warn(`[OPT] Level-only infeasibility detected — auto-downgrading to soft level constraints`);
      for (const e of feasibility.levelErrors) console.warn(`[OPT]   ${e}`);
      levelAutoSoftened = true;
    }

    const feasibilityMsg = [...feasibility.softWarnings, ...feasibility.levelErrors].join(" ") || null;

    const { varMap, binaryVars } = this.prepareVariables();

    if (varMap.size === 0) {
      return this.makeEmptyResult(feasibilityMsg || "No eligible assignments found.", [...levelCheck.levelShortages, ...feasibility.levelErrors]);
    }

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
    console.log(`[OPT] Total required: ${totalRequired}, capacity: ${totalMaxShifts}, vars: ${varMap.size}`);
    if (levelAutoSoftened) {
      console.log(`[OPT] Level constraints will be SOFT only (shortage detected / auto-downgraded)`);
    }

    const solver = await createSolver();
    const { model: coverageModel } = this.buildCoverageModel(varMap, binaryVars);
    let phase1Solution: any;
    try {
      phase1Solution = solver.solve(coverageModel, {
        time_limit: 90,
        mip_rel_gap: 0.001,
        threads: 1,
        presolve: "on",
      });
    } catch (err: any) {
      console.error("[OPT] Phase 1 (coverage) CRASH:", err);
      return this.makeEmptyResult(`Solver crashed during coverage optimization: ${err?.message || "Unknown error"}.`);
    }

    console.log(`[OPT] Phase 1 status: ${phase1Solution.Status}, obj: ${phase1Solution.ObjectiveValue}`);

    if (phase1Solution.Status === "Time limit reached" && phase1Solution.Columns) {
      console.warn(`[OPT] Phase 1 hit time limit, using best solution found`);
    } else if (failStatuses.includes(phase1Solution.Status) || !phase1Solution.Columns) {
      console.error(`[OPT] Phase 1 FAILED: ${phase1Solution.Status}`);
      let infeasibleMsg = feasibilityMsg || "";
      if (phase1Solution.Status === "Infeasible" && !infeasibleMsg) {
        const totalReq = this.config.staffPerShift.reduce((a, b) => a + b, 0);
        infeasibleMsg = `Infeasible: constraints conflict. Staff per day: ${totalReq}, Staff: ${this.staff.length}, Shifts: ${this.config.shiftNames.length}. Try: reduce staff-per-shift, relax consecutive rules, remove conflicting requested shifts, or add more staff.`;
      }
      if (phase1Solution.Status === "Time limit reached") {
        infeasibleMsg = "Time limit reached and no feasible solution found. Try reducing constraints or adding more staff.";
      }
      return this.makeEmptyResult(infeasibleMsg || `Phase 1 solver status: ${phase1Solution.Status}.`);
    }

    const phase1Targets = this.extractPhase1Targets(phase1Solution, varMap);
    console.log(`[OPT] Phase 1 coverage: ${phase1Targets.totalCoverage}/${totalRequired}`);
    console.log(`[OPT] Phase 1 per-shift: ${phase1Targets.perShift.join(', ')}`);

    if (phase1Targets.totalCoverage === 0) {
      return this.makeEmptyResult("No assignments possible with current constraints.");
    }

    const coverageRatio = phase1Targets.totalCoverage / totalRequired;
    console.log(`[OPT] Phase 1.5 coverage ratio: ${(coverageRatio * 100).toFixed(1)}% (threshold: ${(this.coverageThreshold * 100).toFixed(0)}%)`);

    let finalSolution: any;
    let usedPhase: string;

    if (coverageRatio < this.coverageThreshold) {
      console.warn(`[OPT] Coverage below ${(this.coverageThreshold * 100).toFixed(0)}%, skipping fairness phase — returning partial result`);
      finalSolution = phase1Solution;
      usedPhase = "1 (coverage only, fairness skipped)";
    } else {
      const rangeModel = this.buildRangeModel(varMap, binaryVars, phase1Targets);
      console.log(`[OPT] Phase 2A (range) model: ${rangeModel.length} chars, ${rangeModel.split('\n').length} lines`);
      usedPhase = "2A";

      let bestRange = Infinity;
      let phase2aSolution: any = null;

      try {
        const solver2a = await createSolver();
        phase2aSolution = solver2a.solve(rangeModel, {
          time_limit: 90,
          mip_rel_gap: 0.001,
          threads: 1,
          presolve: "on",
        });

        console.log(`[OPT] Phase 2A status: ${phase2aSolution.Status}, obj: ${phase2aSolution.ObjectiveValue}`);

        if (phase2aSolution.Columns) {
          const cols = phase2aSolution.Columns;
          const maxVal = cols["maxLoad"]?.Primal ?? 0;
          const minVal = cols["minLoad"]?.Primal ?? 0;
          const rawRange = maxVal - minVal;
          bestRange = Math.round(rawRange + 1e-6);
          console.log(`[OPT] Phase 2A raw range=${rawRange}, locked range=${bestRange} (maxLoad=${maxVal.toFixed(1)}, minLoad=${minVal.toFixed(1)})`);

          if (phase2aSolution.Status === "Time limit reached") {
            console.warn(`[OPT] Phase 2A hit time limit, using best range found`);
          }
        }

        if (failStatuses.includes(phase2aSolution.Status) || !phase2aSolution.Columns) {
          console.warn(`[OPT] Phase 2A FAILED (${phase2aSolution.Status}), falling back to Phase 1`);
          finalSolution = phase1Solution;
          usedPhase = "1 (Phase 2A fallback)";
          phase2aSolution = null;
        }
      } catch (err: any) {
        console.error("[OPT] Phase 2A CRASH, falling back to Phase 1:", String(err));
        finalSolution = phase1Solution;
        usedPhase = "1 (Phase 2A crash fallback)";
        phase2aSolution = null;
      }

      if (phase2aSolution && bestRange < Infinity) {
        const distModel = this.buildDistributionModel(varMap, binaryVars, phase1Targets, bestRange);
        console.log(`[OPT] Phase 2B (distribution) model: ${distModel.length} chars, ${distModel.split('\n').length} lines, range locked to ${bestRange}`);
        usedPhase = "2B";

        try {
          const solver2b = await createSolver();
          let phase2bTimeLimit: number;
          let phase2bGap: number;
          if (this.staff.length <= 40) {
            phase2bTimeLimit = 90;
            phase2bGap = 1e-4;
          } else if (this.staff.length <= 80) {
            phase2bTimeLimit = 120;
            phase2bGap = 5e-4;
          } else {
            phase2bTimeLimit = 90;
            phase2bGap = 1e-3;
          }
          console.log(`[OPT] Phase 2B adaptive config: time_limit=${phase2bTimeLimit}, mip_rel_gap=${phase2bGap}`);
          const phase2bSolution = solver2b.solve(distModel, {
            time_limit: phase2bTimeLimit,
            mip_rel_gap: phase2bGap,
            mip_abs_gap: 1e-6,
            threads: 1,
            presolve: "on",
          });

          console.log(`[OPT] Phase 2B status: ${phase2bSolution.Status}, obj: ${phase2bSolution.ObjectiveValue}`);

          if (phase2bSolution.Status === "Time limit reached" && phase2bSolution.Columns) {
            console.warn(`[OPT] Phase 2B hit time limit, using best solution found`);
            finalSolution = phase2bSolution;
          } else if (failStatuses.includes(phase2bSolution.Status) || !phase2bSolution.Columns) {
            console.warn(`[OPT] Phase 2B FAILED (${phase2bSolution.Status}), falling back to Phase 2A result`);
            finalSolution = phase2aSolution;
            usedPhase = "2A (Phase 2B fallback)";
          } else {
            finalSolution = phase2bSolution;
          }
        } catch (err: any) {
          console.error("[OPT] Phase 2B CRASH, falling back to Phase 2A:", String(err));
          finalSolution = phase2aSolution;
          usedPhase = "2A (Phase 2B crash fallback)";
        }
      }
    }

    const schedule = this.extractSchedule(finalSolution, varMap);

    const unfilledBefore = this.findUnfilledSlots(schedule);
    const coverageBefore = totalRequired - unfilledBefore.reduce((sum, u) => sum + (u.required - u.assigned), 0);
    console.log(`[OPT] Phase ${usedPhase}: coverage ${coverageBefore}/${totalRequired}, unfilled: ${unfilledBefore.length}`);

    if (unfilledBefore.length > 0) {
      const greedyFilled = this.greedyFillUnfilled(schedule);
      if (greedyFilled > 0) {
        console.log(`[OPT] Greedy post-fill: ${greedyFilled} slot(s)`);
      }
    }

    const metrics = this.calculateMetricsFromSchedule(schedule);
    const unfilledSlots = this.findUnfilledSlots(schedule);

    const finalCoverage = metrics.perStaff.reduce((sum: number, s: any) => sum + s.total, 0);
    console.log(`[OPT] Final: coverage ${finalCoverage}/${totalRequired}, unfilled: ${unfilledSlots.length}`);

    const resultDiagnostics: string[] = [...levelCheck.levelShortages, ...feasibility.levelErrors];
    if (coverageRatio < this.coverageThreshold) {
      resultDiagnostics.push(`Coverage too low (${(coverageRatio * 100).toFixed(0)}%) — fairness optimization was skipped.`);
    }
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

