process.env.DATABASE_URL ??= "postgresql://localhost:5432/test";
process.env.AUTH_PROVIDER ??= "CAS";
process.env.AUTH_CAS_SERVER ??= "https://example.com";
// Test secrets must meet minimum length requirement (32 chars)
process.env.AUTH_SECRET ??= "test-secret-value-for-testing-only-32chars";
process.env.ICAL_SECRET ??= "test-ical-secret-for-testing-only-32chars";
process.env.CLIENT_BASE_URL ??= "http://localhost:3000";
process.env.EMAIL_PROVIDER ??= "NONE";
process.env.TZ ??= "America/Chicago";
