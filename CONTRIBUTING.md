# Contributing to DentalERP

Thank you for your interest in contributing to DentalERP! This guide will help you get started.

## How to Contribute

### Reporting Bugs

1. Check the [existing issues](https://github.com/abinauv/dental-erp/issues) to avoid duplicates
2. Use the **Bug Report** issue template
3. Include steps to reproduce, expected behavior, and actual behavior
4. Include screenshots if applicable

### Suggesting Features

1. Open a **Feature Request** issue
2. Describe the use case and why it would benefit dental clinics
3. Be as specific as possible about the expected behavior

### Submitting Code

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following the coding standards below
4. **Write tests** for new functionality
5. **Run the test suite** to ensure nothing is broken:
   ```bash
   npm test
   npm run lint
   npx tsc --noEmit
   ```
6. **Commit** with a clear message (see commit conventions below)
7. **Push** to your fork and open a **Pull Request**

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/dental-erp.git
cd dental-erp

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your local MySQL credentials

# Set up the database
npx prisma db push
npx prisma db seed

# Start development server
npm run dev
```

## Coding Standards

### General
- Write TypeScript — avoid `any` unless absolutely necessary
- Use functional components with hooks (no class components)
- Follow the existing code patterns and directory structure

### Naming Conventions
- **Files**: `kebab-case.ts` / `kebab-case.tsx`
- **Components**: `PascalCase`
- **Functions/variables**: `camelCase`
- **Database models**: `PascalCase` (Prisma convention)
- **API routes**: `app/api/resource-name/route.ts`

### Code Style
- ESLint config is provided — run `npm run lint` before committing
- Use Zod for input validation on all API routes
- Use `requireAuthAndRole()` from `lib/api-helpers.ts` for auth checks
- All database queries should be scoped to `hospitalId` for multi-tenancy

### Testing
- Place unit tests in `__tests__/unit/`
- Place integration tests in `__tests__/integration/`
- Place component tests in `__tests__/components/`
- Name test files to match source: `foo.test.ts` for `foo.ts`
- Mock Prisma client — don't hit a real database in unit/integration tests

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

**Examples**:
```
feat(appointments): add drag-and-drop rescheduling
fix(billing): correct GST calculation for exempt items
docs(readme): add deployment instructions
test(api): add integration tests for patient routes
```

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Fill out the PR template completely
- Ensure CI passes (lint, type check, tests)
- Add screenshots for UI changes
- Update documentation if adding new features
- Request review from maintainers

## Architecture Notes

- **App Router**: All pages use Next.js App Router (`app/` directory)
- **Auth**: NextAuth v5 with credentials provider, hospital-scoped sessions
- **API Pattern**: Route handlers in `app/api/`, use `requireAuthAndRole()` for auth
- **Database**: Prisma ORM with MySQL, all queries scoped by `hospitalId`
- **AI Skills**: Defined in `lib/ai/`, use OpenRouter for model access
- **UI**: shadcn/ui components in `components/ui/`, Tailwind CSS for styling

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions?

Open a [Discussion](https://github.com/abinauv/dental-erp/discussions) for general questions.
