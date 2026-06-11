import { tmpdir } from "node:os";
import path from "node:path";

export function defaultFileStorePath(filename: string) {
  if (process.env.VERCEL === "1") {
    return path.join(tmpdir(), "id-doppelganger", filename);
  }

  return path.join(process.cwd(), ".data", filename);
}
