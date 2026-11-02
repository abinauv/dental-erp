/**
 * lint-staged configuration.
 *
 * Type checking has to run as a *whole-project* check rather than per-file.
 * lint-staged appends the staged filenames to each command, and `tsc file.ts`
 * makes TypeScript ignore tsconfig.json entirely — so `paths` (the `@/*`
 * alias) is lost and every import resolves to "Cannot find module '@/lib/...'".
 * Returning the command from a function tells lint-staged not to append the
 * filenames, so the `npm run typecheck` script reads the real project config.
 * The checks are kept as npm scripts (`npm run typecheck`, `npm run lint`) so
 * they can also be run by hand.
 */
const config = {
  // Ignore the file list on purpose — see note above.
  '*.{ts,tsx}': () => 'npm run typecheck',

  // Lint the staged files only (fast); do NOT auto-fix. Auto-fixing on commit
  // rewrites code without the author seeing it and, after any rule change,
  // churns every subsequent diff. `npm run lint` / CI cover the whole repo, and
  // `npm run lint:fix` is the one-off to run after changing the ESLint config.
  '*.{js,jsx,ts,tsx,mjs,cjs}': 'eslint --no-warn-ignored',

  '*.{ts,tsx,js,jsx,mjs,cjs,json,css,md}': 'prettier --write --ignore-unknown',
}

export default config
