---
name: nestjs-best-practices
description: NestJS best practices for building scalable, maintainable APIs. Modules, services, guards, interceptors, pipes, and exception handling.
---
# NestJS Best Practices

## Use this skill when
- Creating or modifying NestJS modules, controllers, services
- Implementing authentication/authorization (guards, decorators)
- Handling errors and exceptions
- Designing dependency injection patterns
- Building REST API endpoints

## Instructions

### Architecture
1. Follow the Module → Controller → Service pattern strictly
2. Keep controllers thin — only handle HTTP concerns (status codes, params, responses)
3. Put all business logic in services
4. Use barrel exports (`index.ts`) for DTOs and modules
5. Each feature module should be self-contained with its own controller, service, DTOs

### Dependency Injection
1. Use constructor injection with `private readonly` pattern
2. Always export services that other modules need via `exports: [ServiceName]`
3. Use `@Global()` sparingly — only for truly shared services (PrismaService, ConfigService)

### DTOs & Validation
1. Always use `class-validator` decorators on DTO properties
2. Enable `ValidationPipe` globally with `whitelist: true` and `transform: true`
3. Use `@IsOptional()` for optional fields, `@IsString()` / `@IsEnum()` for required fields
4. Create separate DTOs for Create, Update, and List operations

### Guards & Auth
1. Use `@UseGuards(JwtAuthGuard, RolesGuard)` at controller level
2. Create `@CurrentUser()` param decorator for accessing authenticated user
3. Use `@Public()` decorator for unauthenticated endpoints
4. Implement role-based access with `@Roles(UserRole.ADMIN)`

### Error Handling
1. Use NestJS built-in exceptions: `NotFoundException`, `BadRequestException`, `UnauthorizedException`
2. Create global exception filters for Prisma errors (P2002 = Conflict, P2025 = Not Found)
3. Never expose internal error details in production responses
4. Log errors with `Logger` service, not `console.log`

### Performance
1. Use `@Throttle()` decorator for rate limiting on public/sensitive endpoints
2. Implement pagination on all list endpoints (`page`, `pageSize`, `total`, `totalPages`)
3. Use `Promise.all()` for independent async operations
4. Use `$transaction` for multi-step database operations
