import type { SchedulerConfig, StaffMember } from "@shared/schema";
import { ShiftOptimizer } from "./optimizer";

self.onmessage = async (e: MessageEvent) => {
  try {
    const { config, staff, month, year, options } = e.data as {
      config: SchedulerConfig;
      staff: StaffMember[];
      month: number;
      year: number;
      options?: { softLevelConstraints?: boolean };
    };

    const optimizer = new ShiftOptimizer(config, staff, month, year, options);
    const result = await optimizer.optimize();

    self.postMessage({ success: true, result });
  } catch (err: any) {
    self.postMessage({
      success: false,
      error: err?.message || "Worker error",
    });
  }
};
