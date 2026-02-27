import type { SchedulerConfig, StaffMember, OptimizerResult } from "@shared/schema";

const WORKER_TIMEOUT_MS = 210_000;

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

    let settled = false;

    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        worker.terminate();
        reject(new Error("OPTIMIZER_TIMEOUT"));
      }
    }, WORKER_TIMEOUT_MS);

    worker.postMessage({ config, staff, month, year, options });

    worker.onmessage = (e: MessageEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (e.data.success) {
        resolve(e.data.result);
      } else {
        reject(new Error(e.data.error));
      }
      worker.terminate();
    };

    worker.onerror = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(err);
      worker.terminate();
    };
  });
}
