/**
 * Storage Manager (Constraint-based version)
 * Compatible with new ShiftOptimizer + UI
 */

class StorageManager {
    constructor() {
        this.storageKey = 'hospital_shift_scheduler_v2';
    }

    /* =========================
       CORE LOAD / SAVE
    ========================= */

    loadAll() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : this.emptyData();
        } catch (e) {
            console.error('Error loading storage:', e);
            return this.emptyData();
        }
    }

    emptyData() {
        return {
            config: null,
            staff: [],
            currentSchedule: null,
            schedules: [],
            blockedTemplates: [],
            lastUpdated: null
        };
    }

    persist(data) {
        data.lastUpdated = new Date().toISOString();
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    /* =========================
       CONFIG / STAFF
    ========================= */

    saveConfig(config) {
        const data = this.loadAll();
        data.config = config;
        this.persist(data);
        return true;
    }

    loadConfig() {
        return this.loadAll().config;
    }

    saveStaff(staff) {
        const data = this.loadAll();
        data.staff = staff;
        this.persist(data);
        return true;
    }

    loadStaff() {
        return this.loadAll().staff || [];
    }

    /* =========================
       SCHEDULE
    ========================= */

    saveSchedule(schedule, metrics = null) {
        const data = this.loadAll();

        const record = {
            id: Date.now(),
            createdAt: new Date().toISOString(),
            schedule,
            metrics,
            config: data.config,
            staff: data.staff
        };

        data.schedules.unshift(record);

        // keep last 10 only
        if (data.schedules.length > 10) {
            data.schedules = data.schedules.slice(0, 10);
        }

        data.currentSchedule = schedule;
        this.persist(data);

        return record.id;
    }

    loadCurrentSchedule() {
        return this.loadAll().currentSchedule;
    }

    loadSchedules() {
        return this.loadAll().schedules || [];
    }

    loadScheduleById(id) {
        return this.loadAll().schedules.find(s => s.id === id);
    }

    deleteSchedule(id) {
        const data = this.loadAll();
        data.schedules = data.schedules.filter(s => s.id !== id);
        this.persist(data);
        return true;
    }

    /* =========================
       BLOCKED TEMPLATES
    ========================= */

    saveBlockedTemplate(name, blockedDates) {
        const data = this.loadAll();

        const template = {
            id: Date.now(),
            name,
            blockedDates,
            createdAt: new Date().toISOString()
        };

        data.blockedTemplates.push(template);
        this.persist(data);

        return template.id;
    }

    loadBlockedTemplates() {
        return this.loadAll().blockedTemplates || [];
    }

    deleteBlockedTemplate(id) {
        const data = this.loadAll();
        data.blockedTemplates = data.blockedTemplates.filter(t => t.id !== id);
        this.persist(data);
        return true;
    }

    /* =========================
       IMPORT / EXPORT
    ========================= */

    exportToFile() {
        const data = this.loadAll();
        const blob = new Blob(
            [JSON.stringify(data, null, 2)],
            { type: 'application/json' }
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shift_scheduler_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    localStorage.setItem(this.storageKey, JSON.stringify(parsed));
                    resolve(parsed);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    clearAll() {
        localStorage.removeItem(this.storageKey);
        return true;
    }

    /* =========================
       INFO / DEBUG
    ========================= */

    getStorageInfo() {
        const data = this.loadAll();
        const bytes = new Blob([JSON.stringify(data)]).size;

        return {
            bytes,
            kilobytes: (bytes / 1024).toFixed(2),
            scheduleCount: data.schedules.length,
            templateCount: data.blockedTemplates.length,
            lastUpdated: data.lastUpdated
        };
    }
}

/* =========================
   MODULE EXPORT
========================= */

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}
