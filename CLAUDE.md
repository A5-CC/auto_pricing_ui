## Frontend Development Best Practices

- Always use TypeScript with strict mode enabled
- Follow existing component patterns in components/ui/ for consistency
- Use shadcn/ui components instead of custom UI implementations
- Handle loading states explicitly with proper UX feedback
- Implement proper error boundaries and error handling
- Use Next.js App Router conventions (app/ directory structure)

## Problem-Solving Principles

- Basic principle: first understand the data flow, then build the UI.
- Start with the API client layer, then build components that consume it
- Use existing patterns from lib/api/client.ts for consistency

## GitHub Tools

- Never use Fetch tool to read Github Issues; The Github Issues are in our private repository and you need to you Bash Tool and `gh issue view` cmd.

## Team Members

- a5-008: Alberto
- a5-628: Jose Maria

## Package Management

- This project uses pnpm for dependency management
- Always use `pnpm install` to install dependencies
- Check package.json for existing dependencies before adding new ones
- Use exact versions for UI libraries to avoid breaking changes

## Next.js & React Best Practices

- Use `next export` compatible patterns - no server-side rendering dependencies
- Store API base URL in NEXT_PUBLIC_API_URL environment variable
- Use React hooks for state management (useState, useEffect, useMemo)
- Follow the existing API client pattern in lib/api/client.ts with fetchWithError helper
- Use the existing component structure: page components in app/, reusable components in components/
- Follow existing TypeScript patterns in lib/api/types.ts for API interfaces

## Git Best Practices

- When branches diverge (local has commits, origin has different commits), use `git pull --rebase` to rebase local commits on top of origin
- NEVER use `git reset --hard` unless you actually want to destroy local changes permanently
- "Diverged branches" is a normal git situation, not an error that requires complex workarounds

## Component Architecture

- Page components go in app/[route]/page.tsx following Next.js App Router
- Reusable components in components/ with logical grouping (e.g., components/pricing/, components/runs/)
- Use existing UI components from components/ui/ - Button, Card, Badge, etc.
- Follow the pattern: fetch data in page component, pass to child components via props
- Handle async operations with proper loading/error states

## API Integration

- Extend lib/api/client.ts following the existing fetchWithError pattern
- Add new interfaces to lib/api/types.ts
- Use the existing ApiError class for error handling
- API calls should return typed responses matching backend endpoint specs