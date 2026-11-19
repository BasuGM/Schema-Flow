import type { SessionBackend } from "@/lib/session-db";

/** An in-memory session store. `holdPuts` keeps writes pending until `releasePuts()`. */
export class FakeSessionBackend implements SessionBackend {
  readonly data = new Map<string, unknown>();
  mode: "ok" | "fail" | "hang" = "ok";
  holdPuts = false;
  gets = 0;
  private held: (() => void)[] = [];
  private getGate: Promise<void> | null = null;
  private openGetGate: (() => void) | null = null;

  /** Reads wait until `releaseGets()`. */
  holdGets(): void {
    this.getGate = new Promise((resolve) => (this.openGetGate = resolve));
  }
  releaseGets(): void {
    this.openGetGate?.();
    this.getGate = null;
  }
  releasePuts(): void {
    this.holdPuts = false;
    for (const run of this.held.splice(0)) run();
  }

  private guard(): Promise<void> {
    if (this.mode === "fail") return Promise.reject(new Error("blocked"));
    if (this.mode === "hang") return new Promise(() => undefined);
    return Promise.resolve();
  }

  async get(key: string): Promise<unknown> {
    this.gets += 1;
    await this.guard();
    await this.getGate;
    return this.data.get(key);
  }

  async put(key: string, value: unknown): Promise<void> {
    await this.guard();
    if (this.holdPuts) await new Promise<void>((resolve) => this.held.push(resolve));
    this.data.set(key, value);
  }

  async remove(key: string): Promise<void> {
    await this.guard();
    this.data.delete(key);
  }
}
