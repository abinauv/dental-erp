import { AsyncLocalStorage } from 'node:async_hooks'
import { Prisma, type PrismaClient } from './generated/prisma/client'
import {
  auditUserAgent,
  currentAuditActor,
  type AuditActor,
  type AuditSource,
} from './audit-context'
import { logger } from './logger'

/**
 * The audit log's record of changes to clinic records.
 *
 * Every create, update and delete made through Prisma on a clinic table is
 * logged: who made it (lib/audit-context), which record, and for an update the
 * changed fields' old and new values. It hooks Prisma itself, so a new API
 * route is covered without doing anything. Raw SQL ($executeRaw) is not seen.
 *
 * Secrets are never written: passwords, tokens and keys show as "[hidden]",
 * and ID numbers (Aadhaar, PAN, bank account) as their last four characters.
 */

/**
 * Tables whose writes aren't changes to clinic records: sign-in plumbing, logs
 * and what the app computes for itself. Every other table is audited, so a new
 * table is covered unless it is added here. tests/lib/audit-log.test.ts checks
 * these are real table names.
 */
export const NOT_AUDITED: Readonly<Record<string, string>> = {
  AuditLog: 'the log itself',
  Account: 'legacy sign-in data',
  Session: 'legacy sign-in sessions',
  VerificationToken: 'legacy sign-in tokens',
  BaSession: 'sign-in sessions; a sign-in is logged as LOGIN',
  BaAccount: 'credentials; a password change shows as a change to User.password',
  BaVerification: 'one-time sign-in and password reset tokens',
  PatientOTP: 'patient portal one-time codes',
  Notification: 'in-app notifications the app writes',
  SMSLog: 'message delivery log, shown under Communications',
  EmailLog: 'message delivery log, shown under Communications',
  AIConversation: 'AI chat history; AI use is logged as AI_INTERACTION',
  AISkillExecution: 'AI working data',
  AIInsight: 'AI working data',
  PatientRiskScore: 'computed by the AI',
  DeviceDataLog: 'device readings',
  PushDevice: 'push notification registrations',
  DataImportJob: 'import jobs; an import is logged as DATA_IMPORT',
  AppointmentReminder: 'the reminder schedule the app keeps',
  StockAlert: 'computed from stock levels',
  LabOrderHistory: 'the status history of a lab order, which is audited itself',
}

/** Bookkeeping fields: a write that changes only these isn't logged. */
const IGNORED_FIELDS = new Set(['createdAt', 'updatedAt'])
const IGNORED_BY_TABLE: Readonly<Record<string, readonly string[]>> = {
  Patient: ['aiSummary', 'aiSummaryAt'],
  CalendarIntegration: ['accessToken', 'refreshToken', 'lastSyncAt'],
  MarketingAutomation: ['lastRunAt', 'runCount'],
  Device: ['lastPingAt'],
  BulkCommunication: ['sentCount', 'failedCount', 'actualCost'],
}

/** Field names that hold secrets, and Setting keys whose value is one. */
const SECRET_FIELD = /(password|secret|token|apikey|saltkey|merchantkey|privatekey)$/i
const SECRET_SETTING = /(password|secret|token|api_?key|salt|merchantkey|privatekey)/i
/**
 * Keys inside a JSON value that hold secrets. Settings → Communications saves
 * its whole form as one JSON setting (email_settings, sms_settings), with the
 * SMTP password and the SMS API key in it.
 */
const SECRET_KEY =
  /(password|passwd|secret|token|api_?key|auth_?key|salt|merchant_?key|private_?key|credential)/i
const MASKED_FIELDS = new Set(['aadharNumber', 'panNumber', 'bankAccountNo'])
export const HIDDEN = '[hidden]'
/** A change Prisma computed in the database (e.g. an increment) and didn't return. */
export const CHANGED = '[changed]'

/** Document numbers that name a record, in order of preference. */
const NUMBER_FIELDS = [
  'appointmentNo',
  'invoiceNo',
  'paymentNo',
  'treatmentNo',
  'planNumber',
  'prescriptionNo',
  'claimNumber',
  'authNumber',
  'orderNumber',
  'batchNumber',
  'referralCode',
]

const MAX_TEXT = 200
/** updateMany/deleteMany: one entry per record up to this many, else one in all. */
export const BULK_LIMIT = 50
/** In a bulk entry's values: how many records the change touched. */
export const COUNT_KEY = '$count'

const WRITES = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
])
const SCALAR_OPS = new Set(['set', 'increment', 'decrement', 'multiply', 'divide', 'unset'])

type Row = Record<string, unknown>
type Shown = string | number | boolean | null

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'

export interface AuditEntry {
  hospitalId: string
  userId: string | null
  action: AuditAction | 'LOGIN'
  entityType: string
  entityId: string
  entityLabel: string | null
  oldValues: string | null
  newValues: string | null
  source: string | null
  ipAddress: string | null
  userAgent: string | null
}

export function isAudited(model: string | undefined): model is string {
  return !!model && !Object.prototype.hasOwnProperty.call(NOT_AUDITED, model)
}

function isIgnored(model: string, field: string): boolean {
  return IGNORED_FIELDS.has(field) || (IGNORED_BY_TABLE[model]?.includes(field) ?? false)
}

function isSecret(model: string, field: string, row: Row): boolean {
  if (SECRET_FIELD.test(field)) return true
  // A setting's value is a secret when its key says so, and is treated as one
  // when the key isn't known (a bulk update that names it only in `where`).
  return (
    model === 'Setting' &&
    field === 'value' &&
    (typeof row.key !== 'string' || SECRET_SETTING.test(row.key))
  )
}

function clip(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text
}

function isDecimal(value: unknown): value is Prisma.Decimal {
  return Prisma.Decimal.isDecimal(value)
}

/** A stored value as the log shows it. */
function show(value: unknown): Shown {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') return value.startsWith('data:') ? '[file]' : clip(value)
  if (isDecimal(value)) return value.toString()
  if (value instanceof Uint8Array) return '[binary]'
  try {
    return clip(JSON.stringify(value))
  } catch {
    return '[value]'
  }
}

/** Whether two values are the same, comparing a Decimal with a number etc. */
function same(a: unknown, b: unknown): boolean {
  const key = (v: unknown): string => {
    if (v === null || v === undefined) return '\u0000null'
    if (v instanceof Date) return v.toISOString()
    if (isDecimal(v)) return v.toString()
    if (typeof v === 'object') {
      try {
        return JSON.stringify(v)
      } catch {
        return String(v)
      }
    }
    return String(v)
  }
  return key(a) === key(b)
}

/** A JSON value with what its secret-named keys hold replaced by HIDDEN. */
function withoutSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSecrets)
  if (!isObject(value)) return value
  const out: Row = {}
  for (const [key, item] of Object.entries(value)) {
    const plain =
      item === null || item === '' || typeof item === 'boolean' || typeof item === 'number'
    out[key] = SECRET_KEY.test(key) && !plain ? HIDDEN : withoutSecrets(item)
  }
  return out
}

function present(model: string, field: string, value: unknown, row: Row): Shown {
  if (value === CHANGED) return CHANGED
  // A flag (mustChangePassword) gives nothing away.
  if (typeof value !== 'boolean' && isSecret(model, field, row)) {
    return value === null || value === undefined ? null : HIDDEN
  }
  let safe = value
  if (typeof value === 'string' && /^\s*[[{]/.test(value)) {
    // Text that holds JSON, such as a setting saved as a whole form.
    try {
      safe = JSON.stringify(withoutSecrets(JSON.parse(value)))
    } catch {
      // Not JSON after all.
    }
  } else if (Array.isArray(value) || isObject(value)) {
    safe = withoutSecrets(value)
  }
  const shown = show(safe)
  if (MASKED_FIELDS.has(field) && typeof shown === 'string' && shown.length > 0) {
    return `****${shown.slice(-4)}`
  }
  return shown
}

function isObject(value: unknown): value is Row {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !isDecimal(value) &&
    !(value instanceof Uint8Array)
  )
}

/**
 * What a key in a write's `data` is: a value, an operation on a value
 * ({ increment: 1 }), or a write to a related record ({ connect: … }).
 */
function inputKind(value: unknown): 'value' | 'scalarOp' | 'relation' {
  if (!isObject(value)) return 'value'
  const keys = Object.keys(value)
  if (keys.length > 0 && keys.every((k) => SCALAR_OPS.has(k))) {
    // { set: [...] } on a relation replaces its links.
    return Array.isArray(value.set) ? 'relation' : 'scalarOp'
  }
  const RELATION_OPS = [
    'connect',
    'connectOrCreate',
    'create',
    'createMany',
    'disconnect',
    'delete',
    'deleteMany',
    'update',
    'updateMany',
    'upsert',
  ]
  return keys.some((k) => RELATION_OPS.includes(k)) ? 'relation' : 'value'
}

/** Keys of a result that are related records the write asked for. */
function relationKeys(args: Row): Set<string> {
  const keys = new Set<string>(['_count'])
  if (isObject(args.include)) Object.keys(args.include).forEach((k) => keys.add(k))
  if (isObject(args.select)) {
    for (const [k, v] of Object.entries(args.select)) if (isObject(v)) keys.add(k)
  }
  return keys
}

/** The plain field values in a write's `data`, without related-record writes. */
function dataValues(data: unknown): Row {
  const out: Row = {}
  if (!isObject(data)) return out
  for (const [k, v] of Object.entries(data)) {
    const kind = inputKind(v)
    if (kind === 'value') out[k] = v
    else if (kind === 'scalarOp') out[k] = 'set' in (v as Row) ? (v as Row).set : CHANGED
  }
  return out
}

function columns(row: unknown, skip: Set<string>): Row {
  const out: Row = {}
  if (!isObject(row)) return out
  for (const [k, v] of Object.entries(row)) if (!skip.has(k)) out[k] = v
  return out
}

/** Every value of a record, for a creation or a deletion. */
function snapshot(model: string, row: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue
    if (k === 'id' || k === 'hospitalId' || isIgnored(model, k)) continue
    out[k] = present(model, k, v, row)
  }
  return out
}

/** The fields an update changed, old and new. Null if it changed nothing. */
function difference(
  model: string,
  before: Row | null,
  after: Row,
  data: Row
): { from: Row | null; to: Row } | null {
  const from: Row = {}
  const to: Row = {}
  const row = { ...before, ...after }
  const fields = new Set([...Object.keys(data), ...(before ? Object.keys(after) : [])])
  for (const field of fields) {
    if (isIgnored(model, field)) continue
    if (before && !(field in before)) continue // not a column of this table
    const next = field in after ? after[field] : data[field]
    if (before && next !== CHANGED && same(before[field], next)) continue
    if (!before && !(field in data)) continue
    if (before) from[field] = present(model, field, before[field], row)
    to[field] = present(model, field, next, row)
  }
  if (Object.keys(to).length === 0) return null
  return { from: before ? from : null, to }
}

export function entityLabel(model: string, row: Row | null | undefined): string | null {
  if (!row) return null
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const name = [text(row.firstName), text(row.lastName)].filter(Boolean).join(' ')
  if (model === 'Patient' && name) {
    const code = text(row.patientId)
    return clip(code ? `${name} (${code})` : name)
  }
  for (const field of NUMBER_FIELDS) {
    const value = text(row[field])
    if (value) return clip(value)
  }
  if (name) return clip(name)
  for (const field of ['name', 'title', 'key', 'email']) {
    const value = text(row[field])
    if (value) return clip(value)
  }
  return null
}

function json(values: Row | null): string | null {
  return values && Object.keys(values).length > 0 ? JSON.stringify(values) : null
}

export interface ChangeInput {
  model: string
  operation: string
  args: Row
  /**
   * The record beforehand (for a bulk write, up to BULK_LIMIT + 1 of them).
   * Null when there was none; undefined when it wasn't read.
   */
  before: Row | Row[] | null | undefined
  result: unknown
  actor: AuditActor | undefined
}

/**
 * The audit entries for one write. Pure, so the rules can be tested without a
 * database: `before` is read by the caller, and null when it couldn't be.
 */
export function auditEntries(input: ChangeInput): AuditEntry[] {
  const { model, operation, args, actor } = input
  const skip = relationKeys(args)
  const data = dataValues(args.data)
  const result = columns(input.result, skip)
  const single = Array.isArray(input.before) ? null : (input.before ?? null)
  const many = Array.isArray(input.before) ? input.before : null

  const entry = (
    action: AuditAction,
    row: Row,
    values: { from: Row | null; to: Row | null }
  ): AuditEntry | null => {
    const hospitalId =
      (typeof row.hospitalId === 'string' && row.hospitalId) ||
      actor?.hospitalId ||
      (model === 'Hospital' && typeof row.id === 'string' ? row.id : null)
    if (!hospitalId) return null
    return {
      hospitalId,
      userId: actor?.userId ?? null,
      action,
      entityType: model,
      entityId: typeof row.id === 'string' ? row.id : '',
      entityLabel: entityLabel(model, row),
      oldValues: json(values.from),
      newValues: json(values.to),
      source: actor?.source ?? null,
      ipAddress: actor?.ipAddress ?? null,
      userAgent: actor?.userAgent ?? null,
    }
  }
  const bulk = (action: AuditAction, count: number, values: Row): AuditEntry[] => {
    const one = entry(action, {}, { from: null, to: { [COUNT_KEY]: count, ...values } })
    return one ? [one] : []
  }
  const done = (entries: (AuditEntry | null)[]) => entries.filter((e): e is AuditEntry => !!e)

  switch (operation) {
    case 'create': {
      const row = { ...data, ...result }
      return done([entry('CREATE', row, { from: null, to: snapshot(model, row) })])
    }
    case 'createMany': {
      const rows = (Array.isArray(args.data) ? args.data : [args.data]).map(dataValues)
      const count = (input.result as { count?: number } | null)?.count ?? rows.length
      if (count === 0) return []
      if (rows.length > BULK_LIMIT) return bulk('CREATE', count, {})
      return done(rows.map((row) => entry('CREATE', row, { from: null, to: snapshot(model, row) })))
    }
    case 'upsert': {
      // Unread beforehand (in a batch), a record whose timestamps differ
      // already existed.
      const existed =
        input.before === undefined
          ? !!result.createdAt && !same(result.createdAt, result.updatedAt ?? result.createdAt)
          : !!single
      if (!existed) {
        const row = { ...dataValues(args.create), ...result }
        return done([entry('CREATE', row, { from: null, to: snapshot(model, row) })])
      }
      const changed = difference(model, single, result, dataValues(args.update))
      return changed ? done([entry('UPDATE', { ...single, ...result }, changed)]) : []
    }
    case 'update': {
      const changed = difference(model, single, result, data)
      return changed ? done([entry('UPDATE', { ...single, ...result }, changed)]) : []
    }
    case 'delete': {
      const row = single ?? result
      return done([entry('DELETE', row, { from: snapshot(model, row), to: null })])
    }
    case 'updateMany': {
      const count = (input.result as { count?: number } | null)?.count ?? 0
      if (count === 0) return []
      if (!many || many.length > BULK_LIMIT) {
        const values: Row = {}
        for (const [k, v] of Object.entries(data)) {
          if (!isIgnored(model, k)) values[k] = present(model, k, v, data)
        }
        return bulk('UPDATE', count, values)
      }
      return done(
        many.map((row) => {
          const changed = difference(model, row, { ...row, ...data }, data)
          return changed ? entry('UPDATE', row, changed) : null
        })
      )
    }
    case 'deleteMany': {
      const count = (input.result as { count?: number } | null)?.count ?? 0
      if (count === 0) return []
      if (!many || many.length > BULK_LIMIT) return bulk('DELETE', count, {})
      return done(many.map((row) => entry('DELETE', row, { from: snapshot(model, row), to: null })))
    }
    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// The Prisma hook
// ---------------------------------------------------------------------------

/**
 * The transaction a write is part of. Inside `$transaction(async (tx) => …)`
 * entries wait for the commit, so a rolled-back change isn't logged, and the
 * record is read beforehand on the transaction's own connection. In a batch,
 * `$transaction([…])`, nothing is read beforehand: Prisma sends a batch once
 * all its writes have arrived, and a read would hold one back.
 */
interface TransactionScope {
  batch?: boolean
  tx?: unknown
  pending?: AuditEntry[]
  closed?: boolean
}
// One per process, like lib/audit-context's store: Next.js may bundle this
// module into several chunks.
const globalForAudit = globalThis as unknown as {
  auditTransactions: AsyncLocalStorage<TransactionScope> | undefined
}
const transactions = (globalForAudit.auditTransactions ??=
  new AsyncLocalStorage<TransactionScope>())

interface Reader {
  findUnique(args: unknown): Promise<Row | null>
  findMany(args: unknown): Promise<Row[]>
}

function reader(client: unknown, model: string): Reader {
  return (client as Record<string, Reader>)[model.charAt(0).toLowerCase() + model.slice(1)]
}

async function readBefore(
  client: unknown,
  model: string,
  operation: string,
  args: Row
): Promise<Row | Row[] | null | undefined> {
  try {
    if (operation === 'update' || operation === 'upsert' || operation === 'delete') {
      return await reader(client, model).findUnique({ where: args.where })
    }
    if (operation === 'updateMany' || operation === 'deleteMany') {
      return await reader(client, model).findMany({
        where: args.where ?? {},
        take: BULK_LIMIT + 1,
      })
    }
  } catch (err) {
    logger.warn({ err, model, operation }, 'Audit log: could not read a record before changing it')
  }
  return undefined
}

async function write(base: PrismaClient, entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return
  try {
    await base.auditLog.createMany({ data: entries })
  } catch (err) {
    logger.error({ err, count: entries.length }, 'Audit log: could not save entries')
  }
}

function auditExtension(base: PrismaClient) {
  return Prisma.defineExtension({
    name: 'audit-log',
    query: {
      $allModels: {
        async $allOperations(params) {
          const { model, operation, args, query } = params
          if (!WRITES.has(operation) || !isAudited(model)) return query(args)

          const scope = transactions.getStore()
          // Also Prisma's own marker, should a batch reach here another way.
          const internal = (params as { __internalParams?: { transaction?: { kind?: string } } })
            .__internalParams
          const inBatch = scope?.batch === true || internal?.transaction?.kind === 'batch'
          const before = inBatch
            ? undefined
            : await readBefore(
                scope?.tx && !scope.closed ? scope.tx : base,
                model,
                operation,
                args as Row
              )

          const result = await query(args)

          try {
            const entries = auditEntries({
              model,
              operation,
              args: args as Row,
              before,
              result,
              actor: currentAuditActor(),
            })
            if (scope?.pending && !scope.closed) scope.pending.push(...entries)
            else await write(base, entries)
          } catch (err) {
            logger.error({ err, model, operation }, 'Audit log: could not record a change')
          }
          return result
        },
      },
    },
  })
}

/**
 * `base` with every write to a clinic table audited. Typed as a plain
 * PrismaClient: the hook adds no methods and changes no results.
 */
export function withAuditLog(base: PrismaClient): PrismaClient {
  const extended = base.$extends(auditExtension(base))
  const transaction = extended.$transaction.bind(extended) as (
    arg: unknown,
    options?: unknown
  ) => Promise<unknown>

  const $transaction = (arg: unknown, options?: unknown): Promise<unknown> => {
    if (typeof arg !== 'function') {
      return transactions.run({ batch: true }, () => transaction(arg, options))
    }
    const scope: TransactionScope = { pending: [] }
    return transaction((tx: unknown) => {
      scope.tx = tx
      return transactions.run(scope, () => (arg as (tx: unknown) => unknown)(tx))
    }, options).then(
      async (result) => {
        scope.closed = true
        await write(base, scope.pending!.splice(0))
        return result
      },
      (err) => {
        scope.closed = true
        scope.pending = []
        throw err
      }
    )
  }

  return new Proxy(extended, {
    get(target, prop) {
      if (prop === '$transaction') return $transaction
      const value = Reflect.get(target, prop)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as unknown as PrismaClient
}

// ---------------------------------------------------------------------------
// Sign-ins
// ---------------------------------------------------------------------------

export interface SignIn {
  hospitalId: string
  /** The staff user; null for a patient. */
  userId: string | null
  entityType: 'User' | 'Patient'
  entityId: string
  label: string | null
  source: AuditSource
  ipAddress?: string | null
  userAgent?: string | null
}

/** Logs a successful sign-in. Never throws: a sign-in doesn't fail over it. */
export async function recordSignIn(
  client: Pick<PrismaClient, 'auditLog'>,
  signIn: SignIn
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        hospitalId: signIn.hospitalId,
        userId: signIn.userId,
        action: 'LOGIN',
        entityType: signIn.entityType,
        entityId: signIn.entityId,
        entityLabel: signIn.label ? clip(signIn.label) : null,
        source: signIn.source,
        ipAddress: signIn.ipAddress || null,
        userAgent: auditUserAgent(signIn.userAgent) ?? null,
      },
    })
  } catch (err) {
    logger.error({ err }, 'Audit log: could not record a sign-in')
  }
}
