/**
 * Copy an existing local `uploads` tree into S3-compatible object storage.
 *
 *   npm run storage:migrate -- --dry-run
 *   npm run storage:migrate
 *
 * Reads the same `S3_*` variables the application does, so if the app can talk
 * to the bucket then so can this. `STORAGE_DRIVER` is deliberately ignored:
 * the source is always local disk and the target is always S3, which means the
 * script does the same thing whether it is run before or after the switch.
 *
 * It never deletes anything from the source. That makes it safe to re-run, and
 * it makes rollback a matter of unsetting `STORAGE_DRIVER` rather than a
 * restore from backup. Removing the local tree is a separate, manual decision
 * to be taken once the bucket has been verified — see docs/STORAGE.md.
 */

import { readdir, readFile, stat } from 'fs/promises'
import path from 'path'

import { createStorage } from '../lib/storage'
import { InvalidStorageKeyError, toStorageKey } from '../lib/storage/keys'
import type { StorageDriver } from '../lib/storage/types'

interface Options {
  dryRun: boolean
  overwrite: boolean
  root: string
}

function parseArgs(argv: string[]): Options {
  return {
    dryRun: argv.includes('--dry-run'),
    // Off by default: a re-run after a partial failure should resume, not
    // re-upload gigabytes of X-rays that already arrived intact.
    overwrite: argv.includes('--overwrite'),
    root: path.resolve(process.cwd(), process.env.UPLOAD_DIR?.trim() || 'uploads'),
  }
}

/** Every file under `dir`, as paths relative to it, using `/` separators. */
async function walk(dir: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      files.push(...(await walk(path.join(dir, entry.name), relative)))
    } else if (entry.isFile()) {
      files.push(relative)
    }
    // Symlinks and sockets are skipped deliberately. Following a symlink here
    // would copy something from outside the uploads tree into a bucket that
    // the whole application can read.
  }

  return files
}

function humanBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  let target: StorageDriver
  try {
    target = createStorage({ ...process.env, STORAGE_DRIVER: 's3' })
  } catch (err) {
    console.error(`Cannot build the S3 driver: ${(err as Error).message}`)
    console.error('Set S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY and S3_SECRET_KEY first.')
    process.exit(1)
  }

  console.log(`Source : ${options.root}`)
  console.log(`Target : ${process.env.S3_BUCKET} at ${process.env.S3_ENDPOINT || 'AWS S3'}`)
  console.log(options.dryRun ? 'Mode   : dry run, nothing will be written\n' : '')

  let files: string[]
  try {
    files = await walk(options.root)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('No uploads directory — nothing to migrate.')
      return
    }
    throw err
  }

  if (files.length === 0) {
    console.log('Uploads directory is empty — nothing to migrate.')
    return
  }

  let copied = 0
  let skipped = 0
  let failed = 0
  let bytes = 0
  const problems: string[] = []

  for (const relative of files) {
    let key: string
    try {
      key = toStorageKey(relative)
    } catch (err) {
      // A file whose path cannot become a valid key is left alone and
      // reported. Guessing a nearby key would silently move a patient's
      // record somewhere nobody will look for it.
      if (err instanceof InvalidStorageKeyError) {
        problems.push(`skipped (unmappable path): ${relative}`)
        skipped++
        continue
      }
      throw err
    }

    const absolute = path.join(options.root, ...relative.split('/'))
    const size = (await stat(absolute)).size

    if (!options.overwrite && (await target.exists(key))) {
      skipped++
      continue
    }

    if (options.dryRun) {
      console.log(`would copy  ${key}  (${humanBytes(size)})`)
      copied++
      bytes += size
      continue
    }

    try {
      await target.put(key, await readFile(absolute))

      // Verify rather than trust. A silent short write here is patient data
      // that looks migrated and is not.
      const stored = await target.get(key)
      if (stored.size !== size) {
        problems.push(`size mismatch: ${key} — ${size} on disk, ${stored.size} in the bucket`)
        failed++
        continue
      }

      copied++
      bytes += size
      console.log(`copied  ${key}  (${humanBytes(size)})`)
    } catch (err) {
      problems.push(`failed: ${key} — ${(err as Error).message}`)
      failed++
    }
  }

  console.log('')
  console.log(
    `${options.dryRun ? 'Would copy' : 'Copied'}: ${copied} file(s), ${humanBytes(bytes)}`
  )
  console.log(`Skipped (already present or unmappable): ${skipped}`)
  console.log(`Failed: ${failed}`)

  if (problems.length > 0) {
    console.log('\nProblems:')
    for (const problem of problems) console.log(`  ${problem}`)
  }

  if (failed > 0) {
    console.error('\nMigration incomplete. Nothing was deleted from local disk — fix the')
    console.error('cause and re-run; files already copied will be skipped.')
    process.exit(1)
  }

  if (!options.dryRun) {
    console.log('\nDone. The local files are untouched.')
    console.log('Set STORAGE_DRIVER=s3 and restart, then confirm uploads and downloads')
    console.log('work before removing the local tree.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
