import type { Schedule, StaffMember, SchedulerConfig, DaySchedule, OptimizerResult } from "@shared/schema";
import { getDaysInMonth } from "date-fns";

export class ShiftOptimizer {
  private config: SchedulerConfig;
  private staff: StaffMember[];
  private month: number;
  private year: number;
  private daysInMonth: number;
  private schedule: DaySchedule[] = [];
  
  private staffWorkLoad: Map<string, number>;
  private staffShiftCounts: Map<string, number[]>;

  constructor(config: SchedulerConfig, staff: StaffMember[], month: number, year: number) {
    this.config = config;
    this.staff = staff;
    this.month = month;
    this.year = year;
    this.daysInMonth = getDaysInMonth(new Date(year, month - 1));
    
    this.staffWorkLoad = new Map();
    this.staffShiftCounts = new Map();
    
    staff.forEach(s => {
      this.staffWorkLoad.set(s.id, 0);
      this.staffShiftCounts.set(s.id, new Array(config.shiftNames.length).fill(0));
    });
  }

  public optimize(): OptimizerResult {
    const maxAttempts = 10;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        this.resetState();
        this.initializeSchedule();
        this.fillAllShifts();
        this.localRepair();
        this.circadianRepair();

        return {
          schedule: this.schedule,
          metrics: this.calculateMetrics()
        };
      } catch (e) {
        lastError = e as Error;
      }
    }

    throw lastError || new Error("Optimization failed after multiple attempts. Please check constraints or add more staff.");
  }

  private resetState() {
    this.staffWorkLoad = new Map();
    this.staffShiftCounts = new Map();
    this.staff.forEach(s => {
      this.staffWorkLoad.set(s.id, 0);
      this.staffShiftCounts.set(s.id, new Array(this.config.shiftNames.length).fill(0));
    });
  }

  private initializeSchedule() {
    this.schedule = [];
    for (let day = 1; day <= this.daysInMonth; day++) {
      const shifts: string[][] = Array(this.config.shiftNames.length).fill([]).map(() => []);
      this.schedule.push({
        date: day,
        shifts
      });
    }
  }

  private fillAllShifts() {
    for (let dayIdx = 0; dayIdx < this.daysInMonth; dayIdx++) {
      const daySchedule = this.schedule[dayIdx];
      
      for (let shiftIdx = 0; shiftIdx < this.config.shiftNames.length; shiftIdx++) {
        const requiredStaff = this.config.staffPerShift[shiftIdx];
        
        for (let k = 0; k < requiredStaff; k++) {
          const bestCandidate = this.selectBestCandidate(dayIdx + 1, shiftIdx, daySchedule.shifts[shiftIdx]);
          
          if (bestCandidate) {
            daySchedule.shifts[shiftIdx].push(bestCandidate.id);
            this.updateStats(bestCandidate.id, shiftIdx);
          } else {
            throw new Error(`Insufficient staff to fill Day ${dayIdx + 1}, Shift ${this.config.shiftNames[shiftIdx]}. Please check constraints or add more staff.`);
          }
        }
      }
    }
  }

  private selectBestCandidate(date: number, shiftIdx: number, currentAssigned: string[]): StaffMember | null {
    let bestCandidate: StaffMember | null = null;
    let minScore = Infinity;

    const shuffledStaff = [...this.staff].sort(() => Math.random() - 0.5);

    for (const member of shuffledStaff) {
      if (!this.canAssign(member, date, shiftIdx, currentAssigned)) {
        continue;
      }

      const score = this.calculateScore(member, shiftIdx, date);
      if (score < minScore) {
        minScore = score;
        bestCandidate = member;
      }
    }

    return bestCandidate;
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

  private calculateScore(member: StaffMember, shiftIdx: number, date: number): number {
    const totalCount = this.staffWorkLoad.get(member.id) || 0;
    const shiftCounts = this.staffShiftCounts.get(member.id) || [];
    const specificShiftCount = shiftCounts[shiftIdx] || 0;

    let score = (Math.pow(totalCount, 2) * 20) + (Math.pow(specificShiftCount, 2) * 100);

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

    return score;
  }

  private updateStats(memberId: string, shiftIdx: number) {
    const currentLoad = this.staffWorkLoad.get(memberId) || 0;
    this.staffWorkLoad.set(memberId, currentLoad + 1);

    const shiftCounts = this.staffShiftCounts.get(memberId) || [];
    shiftCounts[shiftIdx] = (shiftCounts[shiftIdx] || 0) + 1;
    this.staffShiftCounts.set(memberId, shiftCounts);
  }

  private circadianRepair() {
    const numShifts = this.config.shiftNames.length;
    if (numShifts <= 1) return;

    for (let iter = 0; iter < 2000; iter++) {
      let bestImprovement = 0;
      let bestSwapInfo: { dayIdx: number; shiftIdx: number; posA: number; staffA: string; dayIdx2: number; shiftIdx2: number; posB: number; staffB: string } | null = null;

      for (let attempt = 0; attempt < 50; attempt++) {
        const dayIdx = Math.floor(Math.random() * this.daysInMonth);
        const shiftIdx = Math.floor(Math.random() * numShifts);
        const assigned = this.schedule[dayIdx].shifts[shiftIdx];
        if (assigned.length === 0) continue;

        const posA = Math.floor(Math.random() * assigned.length);
        const staffA = assigned[posA];

        const prevShiftA = this.getStaffShiftOnDay(staffA, dayIdx - 1);
        const nextShiftA = this.getStaffShiftOnDay(staffA, dayIdx + 1);

        const currentContinuityA = this.continuityScore(prevShiftA, shiftIdx, nextShiftA, numShifts);

        for (let dayIdx2 = Math.max(0, dayIdx - 5); dayIdx2 <= Math.min(this.daysInMonth - 1, dayIdx + 5); dayIdx2++) {
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

            const memberA = this.staff.find(s => s.id === staffA)!;
            const memberB = this.staff.find(s => s.id === staffB)!;

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

            const fairnessDelta = (newFairness - oldFairness) * 5;

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

        this.staffShiftCounts.get(staffA)![shiftIdx]--;
        this.staffShiftCounts.get(staffA)![shiftIdx2] = (this.staffShiftCounts.get(staffA)![shiftIdx2] || 0) + 1;
        this.staffShiftCounts.get(staffB)![shiftIdx2]--;
        this.staffShiftCounts.get(staffB)![shiftIdx] = (this.staffShiftCounts.get(staffB)![shiftIdx] || 0) + 1;
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

  private localRepair() {
    for (let i = 0; i < 3000; i++) {
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
      
      if (!foundSwap && loadDiff <= 1) break; 
    }
  }

  private trySpecificShiftSwap(fromId: string, toId: string, targetShiftIdx: number): boolean {
    const fromMember = this.staff.find(s => s.id === fromId);
    const toMember = this.staff.find(s => s.id === toId);
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
          this.staffWorkLoad.set(fromId, fromLoad - 1);
          this.staffShiftCounts.get(fromId)![targetShiftIdx]--;
          this.staffWorkLoad.set(toId, toLoad + 1);
          this.staffShiftCounts.get(toId)![targetShiftIdx]++;
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
                this.staffShiftCounts.get(fromId)![targetShiftIdx]--;
                this.staffShiftCounts.get(toId)![targetShiftIdx]++;
                
                daySchedule2.shifts[sIdx2][idx2] = fromId;
                this.staffShiftCounts.get(toId)![sIdx2]--;
                this.staffShiftCounts.get(fromId)![sIdx2]++;
                
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
    const fromMember = this.staff.find(s => s.id === fromId);
    const toMember = this.staff.find(s => s.id === toId);
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
            
            this.staffWorkLoad.set(fromId, (this.staffWorkLoad.get(fromId) || 0) - 1);
            this.staffShiftCounts.get(fromId)![shiftIdx]--;
            
            this.staffWorkLoad.set(toId, (this.staffWorkLoad.get(toId) || 0) + 1);
            this.staffShiftCounts.get(toId)![shiftIdx]++;
            
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
      return {
        name: s.name,
        total,
        byShift: this.staffShiftCounts.get(s.id) || []
      };
    });

    return {
      range: maxLoad - minLoad,
      perStaff
    };
  }
}
