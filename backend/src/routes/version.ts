/**
 * What is running, so a browser can tell whether its page is still current.
 *
 * Read once and remembered: the file is written at build time and cannot change
 * under a running server, and this is polled by every open tab.
 *
 * Deliberately outside authentication. A login screen is exactly where somebody
 * checks whether their deploy landed, and there is nothing here that is not
 * already obvious from the asset filenames the browser just fetched.
 */
import { Router } from "express";
import { readFileSync } from "fs";
import path from "path";

interface Stamp {
  sha: string;
  builtAt: string | null;
}

let cached: Stamp | null = null;

export function readVersion(): Stamp {
  if (cached) return cached;
  try {
    // Written by the frontend build, and copied in beside it by the image.
    const file = path.join(__dirname, "../../public/version.json");
    const raw = JSON.parse(readFileSync(file, "utf8"));
    cached = { sha: String(raw.sha ?? "dev").slice(0, 16), builtAt: raw.builtAt ?? null };
  } catch {
    // Running from source, which is not a build and should say so rather than
    // inventing a version that would then look stale for ever.
    cached = { sha: "dev", builtAt: null };
  }
  return cached;
}

const router = Router();
router.get("/", (_req, res) => res.json(readVersion()));
export default router;
