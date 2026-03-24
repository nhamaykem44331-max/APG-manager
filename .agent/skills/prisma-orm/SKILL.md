---
name: prisma-orm
description: Prisma ORM best practices. Schema design, migrations, query optimization, relations, N+1 prevention.
---
# Prisma ORM Best Practices

## Use this skill when
- Designing or modifying Prisma schema (`schema.prisma`)
- Writing database queries (findMany, create, update, delete)
- Fixing N+1 query problems
- Running or debugging migrations
- Optimizing database performance

## Instructions

### Schema Design
1. Use `@id @default(uuid())` for primary keys
2. Add `@map("snake_case")` for column names, `@@map("table_name")` for tables
3. Always include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`
4. Use `Decimal` for monetary values, never `Float`
5. Define enums in schema for type-safe status fields
6. Add `@@index` for fields used in WHERE, ORDER BY, and JOIN clauses
7. Use `@unique` constraint for naturally unique fields (email, phone, booking codes)

### Queries
1. Always use `include` or `select` explicitly — never fetch all fields blindly
2. Use `select` when you only need a few fields (better performance)
3. Use `include` when you need full related records
4. Use `findMany` with `take`/`skip` for pagination
5. Prefer `aggregate` and `groupBy` over fetching all records and reducing in JS
6. Use `Prisma.XWhereInput` types instead of `any` for dynamic filters

### Relations
1. Define both sides of relations explicitly in schema
2. Use `onDelete: Cascade` or `SetNull` as appropriate
3. For optional relations, mark the FK field as `String?` (nullable)
4. Use nested `create`/`connect`/`connectOrCreate` in mutations

### Migrations
1. Run `npx prisma migrate dev --name descriptive_name` after schema changes
2. For production: use `npx prisma migrate deploy` (never `dev`)
3. After changing schema, always run `npx prisma generate` to update the client
4. Review migration SQL before applying — especially `DROP COLUMN` operations
5. For enum-to-string conversions, use `ALTER COLUMN TYPE TEXT USING col::TEXT` instead of DROP+ADD
6. Mark failed migrations as resolved with `npx prisma migrate resolve --applied <name>`

### Transactions
1. Use `$transaction` for atomic multi-step operations
2. Use interactive transactions `prisma.$transaction(async (tx) => {...})` for complex logic
3. Non-critical side effects (webhooks, notifications) should NOT be inside transactions

### Performance
1. Use `count()` instead of `findMany().length` for counting
2. Add composite indexes for multi-column queries: `@@index([field1, field2])`
3. Use `cursor`-based pagination for large datasets
4. Avoid N+1 by using `include` upfront instead of separate queries in loops
