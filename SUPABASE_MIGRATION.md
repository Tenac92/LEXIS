# Supabase Migration Guide

This document provides an overview of the migration from our previous PostgreSQL database (Neon DB) to Supabase for all database operations. The migration includes changes to connection handling, error recovery, session management, and authentication systems.

## Migration Overview

The application has been fully migrated to use Supabase as the primary database provider. This includes:

1. Removing all direct PostgreSQL (Neon DB) dependencies
2. Implementing Supabase-specific error handling and recovery
3. Migrating session management to use MemoryStore instead of PostgreSQL
4. Revising the authentication system to work with Supabase's user schema

## Key Changes

### Database Connection

- Removed `DATABASE_URL` dependency in favor of `SUPABASE_URL` and `SUPABASE_KEY`
- Implemented connection pooling and health checks for Supabase
- Added robust error handling middleware with specialized handlers for Supabase database errors

### Session Management

- Migrated from PostgreSQL session store to in-memory session store to resolve session pruning errors in production
- Enhanced session cookie settings for cross-domain support with sdegdaefk.gr

### Authentication System

- Revised the authentication system in `server/authentication.ts` to work with Supabase's user schema
- Created diagnostic tools for authentication verification with Supabase:
  - `test-auth.js`: Tests user authentication against Supabase
  - `list-users.js`: Lists all users in the Supabase database
  - `fix-password.js`: Updates user passwords in Supabase

### Error Handling

- Implemented specialized middleware for Supabase error detection and recovery
- Enhanced error responses for authentication failures

## Testing Tools

The repository includes several tools to verify the Supabase setup:

1. `check-supabase-connection.js`: Performs a comprehensive test of Supabase connectivity
2. `test-supabase.js`: Simple test for Supabase connection
3. `test-supabase-network.js`: Diagnoses network connectivity issues for Supabase
4. `test-api-health.js`: Tests API health after Supabase migration

## User Schema

The user schema in Supabase includes the following fields:

```typescript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  units: text("units").array(),
  department: text("department"),
  telephone: text("telephone"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at")
});
```

## Authentication Flow

1. User provides email and password
2. Server queries Supabase for user with matching email
3. Password is verified using bcrypt against the stored password hash
4. On successful authentication, a session is created with user information
5. JWT tokens are not used; instead, session cookies manage user state

## Troubleshooting

### Common Issues

1. **Invalid email or password error**: This can occur if the password in Supabase doesn't match the expected format. Use the `fix-password.js` script to update the password.

2. **Session pruning errors**: If you see errors related to session pruning, it indicates that the in-memory session store is working as expected, but may require server restart if memory usage becomes excessive.

3. **Connection issues**: Use the `check-supabase-connection.js` script to diagnose connection problems.

### Diagnostics

The application includes extensive logging, especially for authentication:

- Authentication attempts and failures are logged with the `[Auth]` prefix
- Database operations and errors are logged with the `[Database]` prefix
- Network and connection issues are logged with the `[Network]` prefix

## Future Improvements

1. **Row Level Security (RLS)**: Implement Supabase RLS policies for enhanced data security
2. **Real-time Subscriptions**: Leverage Supabase's real-time capabilities for live updates
3. **Edge Functions**: Consider migrating specific functionality to Supabase Edge Functions