process.env.DATABASE_URL ??= "postgresql://localhost:5432/test";
process.env.AUTH_PROVIDER ??= "CAS";
process.env.AUTH_CAS_SERVER ??= "https://example.com";
process.env.AUTH_SECRET ??= "test-secret-value";
process.env.ICAL_SECRET ??= "test-ical-secret";
process.env.CLIENT_BASE_URL ??= "http://localhost:3000";
process.env.EMAIL_PROVIDER ??= "NONE";
process.env.TZ ??= "America/Chicago";
