import nextConfig from 'eslint-config-next'

const eslintConfig = [
  ...nextConfig,
  {
    rules: {
      // Downgrade strict React compiler rules to warnings
      // These are new in eslint-plugin-react-hooks v5+ and too strict for existing code
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Allow unescaped entities in JSX (common in prose text)
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    ignores: [
      '.history/**',
      'node_modules/**',
      '.next/**',
      'coverage/**',
      // Generated test artifacts — the Playwright HTML report bundles minified
      // vendor JS that produces ~77 lint errors if it is left in scope.
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
      'prisma/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '__tests__/**',
      'tests/**',
      'vitest.config.*',
      'playwright.config.*',
    ],
  },
]

export default eslintConfig
