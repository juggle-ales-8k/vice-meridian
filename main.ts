// VICE MERIDIAN — the hand-in program for this gta6-01 entry (Node 22+, standard library only).
// The game itself is the static site in game/ (index.html, the ES modules in game/src and the
// vendored three.js build in game/vendor); it needs no build step and makes no network request.
// This program checks game/ against the entry's limits, copies game/ and screenshots/ into the
// output directory (/output, or MAKEFUN_OUTPUT_DIR when set), writes dossier.json with the vendored
// make.fun library, and prints a short summary of what it copied.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Limits this entry holds itself to. They sit inside the scorer's own caps (993 files, 48 MiB,
// 1000-byte paths) so a build that passes here is never refused later for size.
const MIN_GAME_FILES = 8;
const MAX_GAME_FILES = 900;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_PATH_BYTES = 1000;

type Tally = { files: number; bytes: number };

// Every regular file below `root`, depth first, with its size. Symbolic links are listed as files
// with their own (link) size and never followed, so a stray link cannot pull in a tree from outside.
function listFiles(root: string): { path: string; bytes: number }[] {
  const found: { path: string; bytes: number }[] = [];
  const pending: string[] = [root];
  while (pending.length > 0) {
    const dir = pending.pop() as string;
    const names = readdirSync(dir).sort();
    for (const name of names) {
      const full = join(dir, name);
      const info = lstatSync(full);
      if (info.isDirectory()) pending.push(full);
      else found.push({ path: full, bytes: info.size });
    }
  }
  return found;
}

// The path as the scorer spells it: relative to the entry root, forward slashes, e.g. "game/src/main.js".
function entryPath(full: string): string {
  return relative(here, full).split(sep).join('/');
}

function tally(root: string): Tally {
  let files = 0;
  let bytes = 0;
  if (!existsSync(root)) return { files, bytes };
  for (const f of listFiles(root)) {
    files += 1;
    bytes += f.bytes;
  }
  return { files, bytes };
}

// Refuse to build an entry that breaks the limits above, naming the first offending path.
function validate(): void {
  const gameDir = join(here, 'game');
  const indexHtml = join(gameDir, 'index.html');
  if (!existsSync(gameDir) || !lstatSync(gameDir).isDirectory()) {
    throw new Error(`validate: missing game directory: ${entryPath(gameDir)}`);
  }
  if (!existsSync(indexHtml) || !lstatSync(indexHtml).isFile()) {
    throw new Error(`validate: missing entry page: ${entryPath(indexHtml)}`);
  }

  const files = listFiles(gameDir);
  if (files.length < MIN_GAME_FILES || files.length > MAX_GAME_FILES) {
    throw new Error(
      `validate: ${entryPath(gameDir)} holds ${files.length} files; it must hold between ${MIN_GAME_FILES} and ${MAX_GAME_FILES}`,
    );
  }

  for (const f of files) {
    const name = entryPath(f.path);
    const nameBytes = Buffer.byteLength(name, 'utf8');
    if (nameBytes >= MAX_PATH_BYTES) {
      throw new Error(`validate: path is ${nameBytes} bytes, must be shorter than ${MAX_PATH_BYTES}: ${name}`);
    }
    if (f.bytes > MAX_FILE_BYTES) {
      throw new Error(`validate: file is ${f.bytes} bytes, larger than the ${MAX_FILE_BYTES}-byte limit: ${name}`);
    }
  }
}

validate();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Summary of what landed in the output directory (the copies only, not dossier.json).
const copiedGame = tally(join(out, 'game'));
const copiedShots = tally(join(out, 'screenshots'));
const copiedFiles = copiedGame.files + copiedShots.files;
const copiedBytes = copiedGame.bytes + copiedShots.bytes;
console.log(`game/        ${copiedGame.files} files, ${copiedGame.bytes} bytes`);
console.log(`screenshots/ ${copiedShots.files} files, ${copiedShots.bytes} bytes`);
console.log(`copied ${copiedFiles} files (${copiedBytes} bytes) into ${out}`);
console.log('VICE MERIDIAN build ok');
