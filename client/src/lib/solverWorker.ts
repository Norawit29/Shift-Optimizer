import { ShiftOptimizer } from "./optimizer";

self.onmessage = async (e: MessageEvent) => {
  try {
    const { config, staff, month, year, options } = e.data;
    const optimizer = new ShiftOptimizer(config, staff, month, year, options);
    const result = await optimizer.optimize();
    (self as any).postMessage({ success: true, result });
  } catch (err: any) {
    (self as any).postMessage({
      success: false,
      error: err?.message || "Worker error",
    });
  }
};
