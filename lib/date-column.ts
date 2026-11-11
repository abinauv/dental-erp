const DAY_MS = 86_400_000

/**
 * The first UTC midnight at or after `date` (the date itself when it already is
 * one).
 *
 * For `gte` / `lt` filters on DATE columns (Appointment.scheduledDate,
 * Attendance.date, Leave.startDate/endDate, Holiday.date) whose value has a
 * time of day, such as `new Date()`. A DATE compares as midnight, so
 * `scheduledDate >= now` has always meant "from tomorrow" — but only while
 * Prisma sent the full timestamp. Prisma 7's MySQL adapter sends just the date
 * part for a DATE column, which would turn it into "from today". A midnight
 * means the same either way, so `{ gte: ceilToUTCDay(now) }` keeps the meaning.
 */
export function ceilToUTCDay(date: Date): Date {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return new Date(midnight === date.getTime() ? midnight : midnight + DAY_MS)
}
