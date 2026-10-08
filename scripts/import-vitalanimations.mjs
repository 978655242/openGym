#!/usr/bin/env node
// Local-only Free50 import; never fetch or redistribute the supplier's raw media.
import { accessSync, constants, copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'frontend', 'public', 'video', 'vitalanimations');

try {
  if (process.argv.length !== 3) {
    throw new Error('Usage: node scripts/import-vitalanimations.mjs "/path/to/VitalAnimations"');
  }
  const source = resolve(process.argv[2]);
  const metadata = join(source, 'Free50', '50gymworkouts.json');
  let exercises;
  try {
    exercises = JSON.parse(readFileSync(metadata, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read Free50 metadata at ${metadata}: ${error.message}. Pass the extracted VitalAnimations directory containing Free50/50gymworkouts.json.`);
  }
  if (!Array.isArray(exercises) || exercises.length !== 50) {
    throw new Error(`Expected exactly 50 exercise records in ${metadata}. Use the complete Free50 pack.`);
  }
  const ids = new Set();
  for (const exercise of exercises) {
    const id = exercise?.id;
    if (typeof id !== 'string' || !/^\d{4}$/.test(id) || ids.has(id)) {
      throw new Error(`Invalid or duplicate Free50 ID ${JSON.stringify(id)} in ${metadata}; expected unique four-digit strings.`);
    }
    ids.add(id);
  }
  const files = [...ids].map(id => `${id}.mp4`);
  // Validate the entire pack and destination before creating or copying anything.
  for (const file of files) {
    const input = join(source, 'Free50', 'Free50', file);
    try {
      const stat = statSync(input);
      if (!stat.isFile() || stat.size === 0) throw new Error('expected a non-empty MP4 file');
      accessSync(input, constants.R_OK);
    } catch (error) {
      throw new Error(`Cannot import ${input}: ${error.message}. Extract all 50 Free50 MP4 files and retry; nothing has been copied.`);
    }
    if (existsSync(join(output, file))) {
      throw new Error(`Destination already exists: ${join(output, file)}. Existing files are never overwritten; move them aside before importing again. Nothing has been copied.`);
    }
  }
  mkdirSync(output, { recursive: true });
  for (const file of files) {
    copyFileSync(join(source, 'Free50', 'Free50', file), join(output, file), constants.COPYFILE_EXCL);
  }
  console.log(`Imported ${files.length} Vital Animations MP4 videos into ${output}.`);
  console.log('Source files, catalogue metadata and localized instructions are unchanged. Keep these licensed assets out of public repositories and images.');
} catch (error) {
  console.error(`Vital Animations import failed: ${error.message}`);
  process.exitCode = 1;
}
