// Shared by the headless perf scripts: refuses to measure on a loaded machine and never leaves a
// browser behind (a crash, Ctrl-C or kill used to orphan headless Chrome and skew the next run).
import { cpus, loadavg } from "node:os";

/** Exits 2 when the 1-minute load exceeds the core count; warns above half of it. */
export function checkLoad() {
  const load = loadavg()[0];
  const cores = cpus().length;
  if (process.env.PERF_IGNORE_LOAD === "1") return;
  if (load > cores) {
    console.error(
      `Machine is overloaded (1-min load ${load.toFixed(1)} > ${cores} cores): the numbers would be meaningless. Stop other work or set PERF_IGNORE_LOAD=1.`,
    );
    process.exit(2);
  }
  if (load > cores / 2)
    console.warn(`Warning: 1-min load ${load.toFixed(1)} on ${cores} cores; numbers may be noisy.`);
}

/** Calls `cleanup` (synchronous: kill the browser) on exit, SIGINT, SIGTERM and crashes. */
export function cleanupOnExit(cleanup) {
  let ran = false;
  const run = () => {
    if (ran) return;
    ran = true;
    try {
      cleanup();
    } catch {
      // Already gone.
    }
  };
  process.on("exit", run);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      run();
      process.exit(130);
    });
  process.on("uncaughtException", (error) => {
    console.error(error);
    run();
    process.exit(2);
  });
  process.on("unhandledRejection", (error) => {
    console.error(error);
    run();
    process.exit(2);
  });
}
