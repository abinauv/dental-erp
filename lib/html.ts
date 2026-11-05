/**
 * Escape a value for interpolation into HTML text or a quoted attribute.
 * Use it on every string that did not come from our own template literals —
 * request parameters and database text alike.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
