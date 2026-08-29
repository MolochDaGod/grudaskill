export type GlState = "ok" | "lost" | "restored";

export type LabDiag = {
  gl: GlState;
  tickErr: number;
  lastErr: string;
  kit: string;
  clips: number;
  physics: boolean;
};

const logs: string[] = [];

export function labLog(msg: string) {
  const line = msg.slice(0, 240);
  logs.push(line);
  if (logs.length > 32) logs.shift();
}

export function labLogs(): string[] {
  return logs.slice(-12);
}

export function errText(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  return String(err);
}

export function emptyDiag(): LabDiag {
  return { gl: "ok", tickErr: 0, lastErr: "", kit: "human", clips: 0, physics: false };
}
