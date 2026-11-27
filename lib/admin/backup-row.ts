/** Backup como a API de administração devolve (os nomes antigos continuam aceitos). */
export interface BackupRow {
  id?: string;
  kind?: string;
  status?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt?: string;
  ok?: boolean;
  sizeBytes?: number | string;
}

export type BackupState = "ok" | "failed" | "running";

/** Quando o backup rodou: a API manda `startedAt`; sem ele, a linha ficava sem data. */
export function backupWhen(b: BackupRow): string | null {
  const when = b.startedAt ?? b.createdAt ?? null;
  return when && when !== "null" ? when : null;
}

export function backupState(b: BackupRow): BackupState {
  const status = (b.status ?? "").toUpperCase();
  if (b.ok === false || status === "FAILED") return "failed";
  if (status === "RUNNING" || status === "STARTED" || status === "PENDING") return "running";
  return "ok";
}

/** Tamanho em KB (a API manda o número como texto); sem tamanho, nada. */
export function backupSizeKb(b: BackupRow): number | null {
  const bytes = Number(b.sizeBytes);
  return Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes / 1024) : null;
}
