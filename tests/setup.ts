import { vi } from 'vitest';

// Use an in-memory SQLite DB for tests so we don't touch the real data file
// NODE_ENV is read-only in strict mode — it's already 'test' when vitest runs
process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';
process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
process.env.CLOUDFLARE_API_TOKEN = 'test-api-token';
process.env.CLOUDFLARE_RTK_APP_ID = 'test-app-id';

// Redirect the DB to an in-memory path that won't persist
process.env.DB_PATH = ':memory:';
