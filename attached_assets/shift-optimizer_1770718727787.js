/**
 * Constraint-based Shift Optimizer
 * Deterministic, fast, CPU-friendly
 */

class ShiftOptimizer {
    constructor(config, staff) {
        this.config = config;
        this.staff = staff;
        this.days = config.daysInMonth;
        this.shifts = config.shiftsPerDay;

        this.reset();
    }

    /* =========================
       INIT / RESET
    ========================= */

    reset() {
        this.schedule = Array.from({ length: this.days }, (_, d) => ({
            date: d + 1,
            shifts: Array.from({ length: this.shifts }, () => [])
        }));

        this.totalCount = Array(this.staff.length).fill(0);
        this.shiftCount = Array.from(
            { length: this.staff.length },
            () => Array(this.shifts).fill(0)
        );
    }

    /* =========================
       PUBLIC API
    ========================= */

    optimize() {
        this.reset();

        this.fillAllShifts();
        this.localRepair();

        return {
            schedule: this.schedule,
            metrics: this.getMetrics()
        };
    }

    /* =========================
       PHASE 1: HARD CONSTRAINT FILL
    ========================= */

    fillAllShifts() {
        for (let d = 0; d < this.days; d++) {
            for (let s = 0; s < this.shifts; s++) {
                const required = this.config.staffPerShift[s];

                while (this.schedule[d].shifts[s].length < required) {
                    const staffId = this.selectBestCandidate(d, s);
                    if (staffId === null) {
                        throw new Error(
                            `ไม่สามารถจัดคนลงเวรได้ (วันที่ ${d + 1}, กะ ${this.config.shiftNames[s]})`
                        );
                    }
                    this.assign(staffId, d, s);
                }
            }
        }
    }

    selectBestCandidate(day, shift) {
        let bestId = null;
        let bestScore = Infinity;

        for (let i = 0; i < this.staff.length; i++) {
            if (!this.canAssign(i, day, shift)) continue;

            // fairness heuristic
            const score =
                this.totalCount[i] * 3 +
                this.shiftCount[i][shift] * 2;

            if (score < bestScore) {
                bestScore = score;
                bestId = i;
            }
        }

        return bestId;
    }

    /* =========================
       CONSTRAINT CHECKS
    ========================= */

    canAssign(staffId, day, shift) {
        const s = this.staff[staffId];

        // max shifts
        if (this.totalCount[staffId] >= s.maxShifts) return false;

        // blocked
        if (s.blocked?.some(b => b.date === day + 1 && b.shift === shift))
            return false;

        // duplicate in same shift
        if (this.schedule[day].shifts[shift].includes(staffId))
            return false;

        // consecutive rules
        if (this.violatesConsecutive(staffId, day, shift))
            return false;

        return true;
    }

    violatesConsecutive(staffId, day, shift) {
        const rules = this.config.consecutiveRules || [];

        for (const rule of rules) {
            // previous day
            if (
                day > 0 &&
                rule.from !== undefined &&
                rule.to === shift &&
                this.schedule[day - 1].shifts[rule.from]?.includes(staffId)
            ) return true;

            // same day
            if (
                rule.from !== undefined &&
                rule.to !== undefined &&
                rule.to === shift &&
                this.schedule[day].shifts[rule.from]?.includes(staffId)
            ) return true;
        }

        return false;
    }

    /* =========================
       ASSIGN / UNASSIGN
    ========================= */

    assign(staffId, day, shift) {
        this.schedule[day].shifts[shift].push(staffId);
        this.totalCount[staffId]++;
        this.shiftCount[staffId][shift]++;
    }

    unassign(staffId, day, shift) {
        const arr = this.schedule[day].shifts[shift];
        const idx = arr.indexOf(staffId);
        if (idx !== -1) {
            arr.splice(idx, 1);
            this.totalCount[staffId]--;
            this.shiftCount[staffId][shift]--;
        }
    }

    /* =========================
       PHASE 2: LOCAL REPAIR (FAIRNESS)
    ========================= */

    localRepair(iterations = 500) {
        for (let i = 0; i < iterations; i++) {
            const maxId = this.argmax(this.totalCount);
            const minId = this.argmin(this.totalCount);

            if (this.totalCount[maxId] - this.totalCount[minId] <= 1) break;

            if (!this.trySwap(maxId, minId)) break;
        }
    }

    trySwap(high, low) {
        for (let d = 0; d < this.days; d++) {
            for (let s = 0; s < this.shifts; s++) {
                if (!this.schedule[d].shifts[s].includes(high)) continue;
                if (!this.canAssign(low, d, s)) continue;

                this.unassign(high, d, s);
                this.assign(low, d, s);
                return true;
            }
        }
        return false;
    }

    /* =========================
       UTILS
    ========================= */

    argmax(arr) {
        return arr.indexOf(Math.max(...arr));
    }

    argmin(arr) {
        return arr.indexOf(Math.min(...arr));
    }

    /* =========================
       METRICS
    ========================= */

    getMetrics() {
        const max = Math.max(...this.totalCount);
        const min = Math.min(...this.totalCount);

        return {
            range: max - min,
            perStaff: this.staff.map((s, i) => ({
                name: s.name,
                total: this.totalCount[i],
                byShift: this.shiftCount[i]
            }))
        };
    }
}
