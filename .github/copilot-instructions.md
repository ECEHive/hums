---
applyTo: "**"
excludeAgent: "code-review"
---

# AI Agent Engineering Guidelines

These instructions apply to all tasks unless explicitly overridden.

## Runtime & Package Manager: Bun

This project uses **Bun** as the JavaScript runtime and package manager.

You must use `bun` in place of `npm`, `node`, or `npx`.

### Common Commands

```bash
bun install
bun run dev
bun run check
bun run typecheck
bun ./src/index.ts
```

Never suggest `npm`, `pnpm`, `yarn`, or `node`.

## Project Structure

The repository is organized as a monorepo.

### `/apps`

Contains main application packages, such as:

* Backend servers
* Web clients
* Other deployable applications

Each app should:

* Own its runtime configuration
* Depend on shared logic from `/packages`
* Avoid duplicating shared functionality

Business logic that may be reused across apps should live in `/packages`, not directly inside an app.

For web clients, base reusable components are managed by Schadcn/UI and are not to be extracted into a shared package.

### `/packages`

Contains shared modules and reusable libraries.

Examples include:

* Shared utilities
* Shared types
* API clients
* UI component libraries
* Database helpers

Guidelines:

* Keep packages focused and cohesive.
* Avoid circular dependencies.
* Keep public APIs clean and well-typed.
* Do not leak internal implementation details across packages.

If functionality may be reused by multiple apps, it belongs here.

### `/packages/prisma`

It is the **single source of truth** for the database schema. It is managed by Prisma.

#### Making Schema Changes

1. Modify `schema.prisma`.
2. Create a migration; from the prisma package, run:

```bash
bun prisma migrate dev --name descriptive_migration_name
```

Generally, manually editing migration files is discouraged, except when creating specialty migration behaviors or adding seeding data (e.g. creating or updating permissions).

#### Generating the Prisma Client

After schema changes, from the prisma package, run:

```bash
bun prisma generate
```

The generated Prisma client must always stay in sync with the schema if you make changes.

#### Rules

* Do not modify the database without updating Prisma schema.
* Do not bypass Prisma with raw SQL unless absolutely necessary.
* If raw SQL is required, document why and explain the query in comments.
* Keep migrations small and descriptive.
* Never delete or rewrite historical migrations.

## Code Quality & Project Standards

### Follow Existing Conventions

All implemented code must:

* Match the existing naming conventions
* Follow the established file structure
* Respect the project’s architectural patterns

Before writing new code:

* Review nearby files.
* Mirror patterns already in use.
* Do not introduce new architectural styles without strong justification.

Consistency and functionality are the top priorities.

### Reuse Before Creating

Avoid duplication.

If similar logic already exists:

* Reuse it.
* Extract shared utilities if appropriate.
* Refactor responsibly rather than duplicating logic.

When reusing code, extract it into the nearest common module. If the code is only used in one place, create a utility function in that module rather than a new shared module. If the code is used in multiple places, extract it to a shared module.

Prioritize:

* Small, composable functions
* Clear separation of concerns
* Minimal surface area changes

Do not introduce unnecessary abstractions.

### Minimal, Safe Changes

When modifying code:

* Change only what is necessary.
* Avoid unrelated refactors.
* Preserve existing behavior unless the task explicitly requires changes.
* Maintain backward compatibility when possible.

Do not rewrite working systems without a clear reason.

## Formatting & Linting

All code must pass project checks.

From the root directory:

```bash
bun run check
```

Before completing a task:

* Ensure formatting is correct.
* Ensure linting passes.
* Fix violations rather than ignoring them.

Do not disable lint rules unless absolutely necessary and justified.

## Type Safety

Type correctness is mandatory.

Run:

```bash
bun run typecheck
```

Rules:

* No `any` unless explicitly justified.
* Prefer strict typing.
* Use existing project types when available.
* Avoid unsafe casts.
* Maintain full type integrity across boundaries.

If a type change is required, propagate it correctly rather than bypassing the type system.

## Dependency Management

When adding dependencies:

* Only add them if absolutely necessary.
* Prefer built-in APIs or existing dependencies.
* Use native Bun features when possible.
* Choose well-maintained, minimal libraries.
* Do not introduce large frameworks for small tasks.

Always justify new dependencies.

## Error Handling

* Follow existing error-handling patterns.
* Use typed errors where appropriate.
* Avoid swallowing errors.
* Provide meaningful error messages.
* Fail explicitly and safely.

## Logging & Debugging

* Use the project’s existing logging utilities.
* Do not introduce `console.log` unless consistent with the project.
* Remove temporary debugging output before completion.
* Maintain consistent logging levels and formats.

## Performance & Security

* Avoid unnecessary allocations.
* Avoid blocking patterns in async code.
* Validate external input.
* Sanitize user-provided data.
* Do not introduce obvious security risks.

## Communication Standards

When proposing changes:

* Be concise.
* Explain tradeoffs if architectural decisions are involved.
* Highlight potential risks.
* Avoid speculative rewrites.

When uncertain:

* Make the safest reasonable assumption.
* State assumptions clearly.

## Definition of Done

A task is complete only when:

* Code compiles
* Type checks pass
* Lint/format checks pass
* No duplicated logic introduced
* Code matches project style
* Changes are minimal and well-contained
