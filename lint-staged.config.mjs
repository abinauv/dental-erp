/**
 * lint-staged configuration.
 *
 * Type checking has to run as a *whole-project* check rather than per-file.
 * lint-staged appends the staged filenames to each command, and `tsc file.ts`
 * makes TypeScript ignore tsconfig.json entirely — so `paths` (the `@/*`
 * alias) is lost and every import resolves to "Cannot find module '@/lib/...'".
 * Returning the command from a function tells lint-staged not to append the
 * filenames, so `tsc -p tsconfig.json` reads the real project config.
 */
const config = {
  // Ignore the file list on purpose — see note above.
  '*.{ts,tsx}': () => 'tsc --noEmit -p tsconfig.json',

  // Call ESLint directly — the Next.js CLI's lint subcommand was removed in v16.
  '*.{js,jsx,ts,tsx,mjs,cjs}': 'eslint --fix --no-warn-ignored',

  '*.{ts,tsx,js,jsx,mjs,cjs,json,css,md}': 'prettier --write --ignore-unknown',
}

export default config
