---
name: typescript-best-practices
description: TypeScript best practices for type safety, generics, utility types, and project configuration.
---
# TypeScript Best Practices

## Use this skill when
- Defining types, interfaces, or enums
- Using generics and utility types
- Configuring tsconfig.json
- Fixing type errors or improving type safety
- Working with third-party library types

## Instructions

### Types & Interfaces
1. Prefer `interface` for object shapes that may be extended; use `type` for unions, intersections, tuples
2. Always define explicit return types for exported functions
3. Use `Record<string, T>` for dictionaries instead of `{ [key: string]: T }`
4. Prefer `unknown` over `any` — use type narrowing to refine
5. Use `as const` for literal type inference on arrays and objects
6. Export types from a centralized `types/` directory or `types.ts` barrel file

### Generics
1. Use descriptive generic names: `<TData>`, `<TResponse>` instead of just `<T>`
2. Constrain generics: `<T extends Record<string, unknown>>` instead of `<T>`
3. Use generic defaults: `function fetch<T = unknown>()` for flexibility

### Utility Types
1. Use `Partial<T>` for update DTOs, `Required<T>` for create DTOs
2. Use `Pick<T, 'key1' | 'key2'>` to select specific properties
3. Use `Omit<T, 'key'>` to exclude properties
4. Use `NonNullable<T>` to remove null/undefined from a type

### Null Safety
1. Use optional chaining `?.` and nullish coalescing `??` extensively
2. Prefer `undefined` over `null` in most cases (align with TS conventions)
3. Use non-null assertion `!` sparingly — only when you're 100% sure
4. Always handle optional properties in function signatures

### Enums & Constants
1. Use string enums for API values: `enum Status { ACTIVE = 'ACTIVE' }`
2. For const objects, use `as const` satisfies: `const X = { ... } as const`
3. Derive types from values: `type Status = typeof STATUS_MAP[keyof typeof STATUS_MAP]`

### Best Practices
1. Enable `strict: true` in tsconfig.json
2. Use `noUncheckedIndexedAccess: true` for safer array/object access
3. Avoid type assertions (`as`) — use type guards instead
4. Use discriminated unions for state management patterns
5. Keep `@types/*` packages in devDependencies
