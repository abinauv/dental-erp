import pino from 'pino'

// Structured JSON logging to stdout (12-factor; matches SELF_HOSTING.md, where a
// log collector or `docker logs` reads stdout). No transport is configured, so
// output stays raw JSON — readable by collectors and safe in every server
// runtime (no worker thread). Level comes from LOG_LEVEL, defaulting to 'info'
// in production and 'debug' elsewhere.
//
// Server-only: never import this from a client component ('use client'); the
// browser keeps using console. Pair the logger with an error object as
// `logger.error({ err }, 'message')` so pino's serializer captures the stack.

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

export const logger = pino({
  level,
  // Emit `level` as the string label ("info") rather than the numeric value.
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Defence-in-depth: strip secrets if they ever reach a log payload.
  redact: {
    paths: [
      'password',
      '*.password',
      'token',
      '*.token',
      'authorization',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    remove: true,
  },
})

/** A child logger tagged with a module/component name. */
export function childLogger(name: string) {
  return logger.child({ name })
}
