import type { SchedulerConfig, StaffMember, OptimizerResult } from "@shared/schema";

export function runOptimizerInWorker(
  config: SchedulerConfig,
  staff: StaffMember[],
  month: number,
  year: number,
  options?: { softLevelConstraints?: boolean }
): Promise<OptimizerResult> {
  return new Promise<OptimizerResult>((resolve, reject) => {
    const worker = new Worker(
      new URL("./solverWorker.ts", import.meta.url),
      { type: "module" }
    );

    worker.postMessage({ config, staff, month, year, options });

    worker.onmessage = (e: MessageEvent) => {
      if (e.data.success) {
        resolve(e.data.result);
      } else {
        reject(new Error(e.data.error));
      }
      worker.terminate();
    };

    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };
  });
}
