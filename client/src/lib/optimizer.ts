import type { Schedule, StaffMember, SchedulerConfig, DaySchedule, OptimizerResult } from "@shared/schema";
import { getDaysInMonth } from "date-fns";

export class ShiftOptimizer {
  private config: SchedulerConfig;
  private staff: StaffMember[];
  private month: number;
  private year: number;
  private daysInMonth: number;
  private schedule: DaySchedule[] = [];
  
  // Tracking state during optimization
  private staffWorkLoad: Map<string, number>;
  private staffShiftCounts: Map<string, number[]>; // [shiftId] -> count

  constructor(config: SchedulerConfig, staff: StaffMember[], month: number, year: number) {
    this.config = config;
    this.staff = staff;
    this.month = month;
    this.year = year;
    this.daysInMonth = getDaysInMonth(new Date(year, month - 1));
    
    this.staffWorkLoad = new Map();
    this.staffShiftCounts = new Map();
    
    // Initialize tracking maps
    staff.forEach(s => {
      this.staffWorkLoad.set(s.id, 0);
      this.staffShiftCounts.set(s.id, new Array(config.shiftNames.length).fill(0));
    });
  }

  public optimize(): OptimizerResult {
    this.initializeSchedule();
    this.fillAllShifts();
    this.localRepair();

    return {
      schedule: this.schedule,
      metrics: this.calculateMetrics()
    };
  }

  private initializeSchedule() {
    this.schedule = [];
    for (let day = 1; day <= this.daysInMonth; day++) {
      // Initialize empty shifts for each day
      const shifts: string[][] = Array(this.config.shiftNames.length).fill([]).map(() => []);
      this.schedule.push({
        date: day,
        shifts
      });
    }
  }

  private fillAllShifts() {
    // Iterate through every day
    for (let dayIdx = 0; dayIdx < this.daysInMonth; dayIdx++) {
      const daySchedule = this.schedule[dayIdx];
      
      // Iterate through every shift type
      for (let shiftIdx = 0; shiftIdx < this.config.shiftNames.length; shiftIdx++) {
        const requiredStaff = this.config.staffPerShift[shiftIdx];
        
        // Fill slots for this shift
        for (let k = 0; k < requiredStaff; k++) {
          const bestCandidate = this.selectBestCandidate(dayIdx + 1, shiftIdx, daySchedule.shifts[shiftIdx]);
          
          if (bestCandidate) {
            daySchedule.shifts[shiftIdx].push(bestCandidate.id);
            this.updateStats(bestCandidate.id, shiftIdx);
          } else {
            // Error handling: if no candidate can be found, throw an error to alert the user
            throw new Error(`Insufficient staff to fill Day ${dayIdx + 1}, Shift ${this.config.shiftNames[shiftIdx]}. Please check constraints or add more staff.`);
          }
        }
      }
    }
  }

  private selectBestCandidate(date: number, shiftIdx: number, currentAssigned: string[]): StaffMember | null {
    let bestCandidate: StaffMember | null = null;
    let minScore = Infinity;

    // Shuffle staff to add randomness when scores are tied
    const shuffledStaff = [...this.staff].sort(() => Math.random() - 0.5);

    for (const member of shuffledStaff) {
      if (!this.canAssign(member, date, shiftIdx, currentAssigned)) {
        continue;
      }

      const score = this.calculateScore(member, shiftIdx);
      if (score < minScore) {
        minScore = score;
        bestCandidate = member;
      }
    }

    return bestCandidate;
  }

  private canAssign(member: StaffMember, date: number, shiftIdx: number, currentAssigned: string[]): boolean {
    // 1. Max shifts constraint
    const currentLoad = this.staffWorkLoad.get(member.id) || 0;
    if (currentLoad >= member.maxShifts) return false;

    // 2. Already assigned in this shift (shouldn't happen with logic but safe check)
    if (currentAssigned.includes(member.id)) return false;

    // 3. Already assigned to ANY shift on this day
    const daySchedule = this.schedule[date - 1];
    for (let s = 0; s < daySchedule.shifts.length; s++) {
      if (daySchedule.shifts[s].includes(member.id)) return false;
    }

    // 4. Blocked dates
    // Assuming blocked.date is 1-based day number
    if (member.blocked.some(b => b.date === date && (b.shift === -1 || b.shift === shiftIdx))) {
      return false;
    }

    // 5. Consecutive Rules (Previous Day Check)
    if (date > 1) {
      const prevDaySchedule = this.schedule[date - 2];
      
      for (const rule of this.config.consecutiveRules) {
        // If current shift is the 'to' part of a rule
        if (rule.to === shiftIdx) {
          // Check if user worked the 'from' shift yesterday
          if (prevDaySchedule.shifts[rule.from].includes(member.id)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private calculateScore(member: StaffMember, shiftIdx: number): number {
    const totalCount = this.staffWorkLoad.get(member.id) || 0;
    const shiftCounts = this.staffShiftCounts.get(member.id) || [];
    const specificShiftCount = shiftCounts[shiftIdx] || 0;

    // Heavily penalize staff who already have many shifts to force distribution
    // Exponential penalty for high workload to keep everyone in the same range
    return (Math.pow(totalCount, 2) * 20) + (specificShiftCount * 5);
  }

  private updateStats(memberId: string, shiftIdx: number) {
    const currentLoad = this.staffWorkLoad.get(memberId) || 0;
    this.staffWorkLoad.set(memberId, currentLoad + 1);

    const shiftCounts = this.staffShiftCounts.get(memberId) || [];
    shiftCounts[shiftIdx] = (shiftCounts[shiftIdx] || 0) + 1;
    this.staffShiftCounts.set(memberId, shiftCounts);
  }

  private localRepair() {
    // Attempt 2000 swaps (increased from 500) to maximize fairness
    for (let i = 0; i < 2000; i++) {
      const staffIds = Array.from(this.staffWorkLoad.keys());
      if (staffIds.length < 2) break;

      // Sort by workload
      staffIds.sort((a, b) => (this.staffWorkLoad.get(a) || 0) - (this.staffWorkLoad.get(b) || 0));
      
      const underLoadedId = staffIds[0];
      const overLoadedId = staffIds[staffIds.length - 1];

      if (underLoadedId === overLoadedId) continue;

      const loadDiff = (this.staffWorkLoad.get(overLoadedId) || 0) - (this.staffWorkLoad.get(underLoadedId) || 0);
      
      // Target absolute fairness (range 0-1)
      if (loadDiff <= 1) break; 

      if (!this.trySwap(overLoadedId, underLoadedId)) {
        // If we can't swap from the most overloaded to the most underloaded,
        // try swapping from overloaded to ANYONE with less load
        let swapped = false;
        for (let j = 0; j < staffIds.length - 1; j++) {
          const targetId = staffIds[j];
          if ((this.staffWorkLoad.get(overLoadedId) || 0) - (this.staffWorkLoad.get(targetId) || 0) > 1) {
            if (this.trySwap(overLoadedId, targetId)) {
              swapped = true;
              break;
            }
          }
        }
        if (!swapped) break; // No more possible swaps
      }
    }
  }

  private trySwap(fromId: string, toId: string) {
    const fromMember = this.staff.find(s => s.id === fromId);
    const toMember = this.staff.find(s => s.id === toId);
    if (!fromMember || !toMember) return;

    // Find a shift assigned to 'fromId' that 'toId' can take
    for (let dayIdx = 0; dayIdx < this.daysInMonth; dayIdx++) {
      const daySchedule = this.schedule[dayIdx];
      for (let shiftIdx = 0; shiftIdx < this.config.shiftNames.length; shiftIdx++) {
        const assignedStaff = daySchedule.shifts[shiftIdx];
        const assignedIndex = assignedStaff.indexOf(fromId);

        if (assignedIndex !== -1) {
          // 'fromId' is working here. Can 'toId' work here?
          
          // Temporarily remove 'fromId' to check constraints for 'toId' cleanly
          const tempAssigned = [...assignedStaff];
          tempAssigned.splice(assignedIndex, 1);

          if (this.canAssign(toMember, dayIdx + 1, shiftIdx, tempAssigned)) {
            // Perform swap
            daySchedule.shifts[shiftIdx][assignedIndex] = toId;
            
            // Update stats
            this.staffWorkLoad.set(fromId, (this.staffWorkLoad.get(fromId) || 0) - 1);
            this.staffShiftCounts.get(fromId)![shiftIdx]--;
            
            this.staffWorkLoad.set(toId, (this.staffWorkLoad.get(toId) || 0) + 1);
            this.staffShiftCounts.get(toId)![shiftIdx]++;
            
            return; // Swap done, exit for this iteration
          }
        }
      }
    }
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
