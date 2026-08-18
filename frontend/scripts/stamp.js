/**
 * Write down what was built, and when.
 *
 * The one question asked constantly while working on a deployed app: *is my
 * last push live yet?* Without an answer you reload, squint at whether the
 * thing you changed changed, and get a plain wrong answer when the browser is
 * holding an old page.
 *
 * The commit if git is here, and the content hash of the built bundle if it is
 * not — a container build copies the source without `.git`, and the hash
 * changes exactly when the code does, which is the only property this needs.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '..', 'dist');

function fromGit() {
  try {
    return execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;                  // no git, which a container build is
  }
}

function fromBundle() {
  const assets = path.join(dist, 'assets');
  const hash = createHash('sha256');
  // Sorted, so the same build hashes the same however the directory is read.
  for (const name of readdirSync(assets).sort()) {
    hash.update(name);
    hash.update(readFileSync(path.join(assets, name)));
  }
  return hash.digest('hex').slice(0, 8);
}

const sha = fromGit() ?? fromBundle();
const stamp = { sha, builtAt: new Date().toISOString() };
writeFileSync(path.join(dist, 'version.json'), JSON.stringify(stamp));
console.log(`stamped ${sha} at ${stamp.builtAt}`);
