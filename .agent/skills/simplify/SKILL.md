---
name: simplify
description: Simplify code and architecture. Remove unnecessary complexity, reduce abstractions, prefer clarity over cleverness.
---
# Simplify

## Use this skill when
- Refactoring overly complex code
- Reducing unnecessary abstractions
- Deciding between simple vs clever solutions
- Reviewing code for readability
- Removing dead code and unused features

## Instructions

### Core Principles
1. **YAGNI** — You Aren't Gonna Need It. Don't build features "just in case"
2. **KISS** — Keep It Simple, Stupid. Choose the simplest solution that works
3. **DRY with caution** — Don't Repeat Yourself, but prefer duplication over wrong abstraction
4. **Premature optimization is the root of all evil** — make it work first, optimize later

### Code Simplification
1. Remove unused imports, variables, functions, and files
2. Flatten deeply nested if/else with early returns
3. Replace complex switch statements with lookup objects (Record maps)
4. Prefer `const` arrow functions for simple helpers, named functions for complex logic
5. Use array methods (`.map`, `.filter`, `.reduce`) instead of manual loops
6. Inline one-use helper functions unless they improve readability

### Architecture Simplification
1. Don't over-engineer: monolith is fine for small teams
2. Avoid premature microservices — start with modules in a monorepo
3. Use a single database until you have a proven need for multiple
4. Prefer server-side rendering over complex client-side state management
5. Use built-in language features before reaching for libraries

### Abstraction Guidelines
1. The Rule of Three: don't abstract until the pattern appears 3 times
2. If an abstraction makes code harder to follow, remove it
3. Prefer composition over inheritance
4. Flat is better than nested — avoid deep component trees
5. Name things clearly — good names reduce the need for comments

### When to Simplify
1. When you explain code and say "it's complicated because..."
2. When a bug fix requires understanding 5+ layers of abstraction
3. When new team members take > 30 min to understand a module
4. When test setup is more complex than the code being tested
5. When you add a wrapper that just forwards arguments
