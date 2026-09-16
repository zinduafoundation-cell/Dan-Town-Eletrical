# Supabase Migration Guide

## Setup

### 1. Install Dependencies
```bash
npm install
```

This installs the `pg` package needed for database migrations.

### 2. Configure Database Connection

Create a `.env.local` file in the root directory with your Supabase database connection string:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@vldccdtuwwyumqdkyxde.supabase.co:5432/postgres?sslmode=require
```

**Important:** 
- Replace `YOUR_PASSWORD` with your actual Supabase database password
- Get this from Supabase Dashboard → Project Settings → Database
- Never commit `.env.local` to version control

### 3. Run Migrations

Execute all migrations in order:

```bash
npm run migrate
```

This will:
- Connect to your Supabase PostgreSQL database
- Read all `.sql` files from `supabase/migrations/` in alphabetical order
- Execute each migration sequentially
- Display a summary of applied migrations

## Migration Files

Migration files are stored in `supabase/migrations/` and are numbered:

- `001_extensions.sql` - Database extensions (pgvector, etc.)
- `002_profiles.sql` - User profiles table
- `003_roles_permissions.sql` - Role-based access control
- `004_categories_brands.sql` - Product categories and brands
- `005_products.sql` - Products table
- ... and so on

**Important:** Each migration should be idempotent (safe to run multiple times). Use `IF NOT EXISTS` and `IF EXISTS` clauses.

## Troubleshooting

### Connection Error
If you see "Failed to connect to database":
1. Check your `DATABASE_URL` is correct
2. Verify the password is set in your `.env.local`
3. Ensure your IP is whitelisted in Supabase (if using IP restrictions)

### Migration Errors
- Errors are logged but don't stop the process
- Check the SQL syntax in individual migration files
- Review Supabase PostgreSQL documentation for supported features

## Best Practices

1. **Always backup your database** before running migrations
2. **Test migrations locally** first
3. **Keep migrations small** - one logical change per file
4. **Use transactions** within migrations when possible
5. **Document complex migrations** with comments

## Environment Variables

Required for migrations:
- `DATABASE_URL` - PostgreSQL connection string

Optional (for API testing):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key
