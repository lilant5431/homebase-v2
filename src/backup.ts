import { MAX_BACKUP_BYTES, serializeState, type State } from "./domain";

/** Used directly by the download UI; normal backups always match save encoding. */
export function createBackupBlob(state: State): Blob {
  return new Blob([serializeState(state)], { type: "application/json" });
}
/** Used by the file input before the store's schema and byte-limit validation. */
export async function readBackupFile(
  file: Pick<Blob, "size" | "text">,
): Promise<string> {
  if (file.size > MAX_BACKUP_BYTES)
    throw Error("Backup is too large (5 MB UTF-8 limit).");
  return file.text();
}
