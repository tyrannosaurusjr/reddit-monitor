# Prisma 7.5.0 + Turso `db push` Configuration Research

## TL;DR

Prisma 7.5.0 with Turso requires a `prisma.config.ts` file with `engine: 'js'` and adapter configuration to make `db push` work with remote libsql:// URLs. The core issue is that Prisma's CLI tools don't natively recognize libsql:// schemes without proper adapter setup in the config file.

## Findings

### Current Issue Analysis
Your setup shows a working runtime configuration but missing CLI configuration. The error "The scheme is not recognized in database URL" occurs because:

1. **Schema Definition Gap**: Your `prisma/schema.prisma` has `provider = "sqlite"` but no URL specified
2. **Missing CLI Configuration**: Prisma CLI tools require `prisma.config.ts` for adapter-based databases
3. **Version-Specific Requirements**: Prisma 6.18.0+ introduced breaking changes requiring `engine: 'js'`

### Required Configuration

**Create `prisma.config.ts` in project root:**

```typescript
import { defineConfig } from 'prisma/config'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import 'dotenv/config'

export default defineConfig({
  engine: 'js', // Required for Prisma 6.18.0+, likely still needed in 7.5.0
  experimental: {
    adapter: true,
  },
  schema: './prisma/schema.prisma',
  async adapter() {
    return new PrismaLibSQL({
      url: process.env.DATABASE_URL!,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    })
  }
})
```

**Update `prisma/schema.prisma`:**

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"  // Local fallback for introspection
}
```

### Alternative Workflows

Since libSQL uses HTTP connections, direct Prisma Migrate compatibility remains limited:

1. **Schema Diff Approach**: Use `prisma migrate diff` to generate SQL, then apply via Turso CLI
2. **Local-First Development**: Develop against local SQLite, sync schema to Turso manually
3. **Turso CLI Integration**: Use `turso db shell` for direct schema modifications

## Implications

### For Your Current Setup
- Your runtime configuration (`src/lib/prisma.ts`) is correct and should continue working
- CLI commands (`db push`, `db pull`, `generate`) need the config file approach
- This explains why your app works but CLI fails

### Technical Limitations
- Prisma Migrate workflows still have limited Turso support
- `db push` may work inconsistently across Prisma versions
- HTTP-based libSQL connections don't map cleanly to traditional SQLite tooling

### Version Compatibility
- Prisma 7.5.0 likely inherits the same adapter patterns from 6.x series
- The `engine: 'js'` requirement from 6.18.0+ probably still applies
- Turso support remains in "Early Access" status

## Recommended Next Branches

### Immediate Testing
1. **Create prisma.config.ts** with the exact configuration above
2. **Test `npx prisma db push`** with your current Turso credentials
3. **Verify `npx prisma generate`** still works correctly

### Fallback Strategies
1. **Schema Management via Turso CLI**: Use `turso db shell <database>` for direct SQL execution
2. **Migration Diff Workflow**: Generate SQL with `prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma`
3. **Local Development Sync**: Maintain local SQLite for development, sync to Turso in deployment

### Long-term Architecture
1. **Monitor Prisma Release Notes**: Track when Turso support moves out of Early Access
2. **Consider PlanetScale**: If migration workflows are critical, evaluate alternatives
3. **Hybrid Approach**: Use Turso for production, local SQLite for development

## Open Questions

1. **Prisma 7.5.0 Compatibility**: Does `engine: 'js'` requirement still apply in 7.x series?
2. **URL Scheme Support**: Can `prisma.config.ts` override datasource URL completely?
3. **Migration State**: How does Prisma track migration state with adapter-based databases?
4. **Performance Impact**: Does JavaScript engine have runtime performance implications?
5. **Development Workflow**: Best practices for local development with remote Turso production?

---

**Research Date**: March 30, 2026
**Sources**: Current Prisma and Turso documentation, GitHub issues, and community discussions