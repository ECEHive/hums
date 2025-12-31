import z from "zod";

const BaseEnvSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	PORT: z.coerce.number().default(44830),
	DATABASE_URL: z.url(),
	AUTH_SECRET: z.string().transform((val) => {
		const buffer = Buffer.from(val);
		return new Uint8Array(buffer);
	}),
	AUTH_PROVIDER: z.enum(["CAS", "CAS_PROXIED"]).default("CAS_PROXIED"),
	AUTH_CAS_SERVER: z.url(),
	AUTH_CAS_LOGIN_URL: z.string().url().optional(),
	AUTH_CAS_VALIDATE_URL: z.string().url().optional(),
	AUTH_CAS_LOGOUT_URL: z.string().url().optional(),
	AUTH_CAS_PROXY_URL: z.string().url().optional(),
	SYSTEM_USERS: z
		.string()
		.default("")
		.describe("Comma-separated list of usernames"),
	DATA_PROVIDER: z.string().default("legacy"),
	FALLBACK_EMAIL_DOMAIN: z.string().default("gatech.edu"),
	TZ: z.string().default("America/New_York"),
	EMAIL_PROVIDER: z.enum(["SES", "SMTP", "NONE"]).default("NONE"),
	EMAIL_FROM_ADDRESS: z.email().optional(),
	EMAIL_FROM_NAME: z.string().default("HUMS"),
	CLIENT_BASE_URL: z.url(),
});

const LegacyProviderSchema = z
	.object({
		DATA_PROVIDER: z.literal("legacy").default("legacy"),
	})
	.and(
		z.object({
			LDAP_HOST: z.string().default("whitepages.gatech.edu"),
			LDAP_BASE_DN: z.string().default("dc=whitepages,dc=gatech,dc=edu"),
		}),
	);

const BuzzApiProviderSchema = z
	.object({
		DATA_PROVIDER: z.literal("buzzapi"),
	})
	.and(
		z.object({
			BUZZAPI_BASE_URL: z.url(),
			BUZZAPI_USER: z.string(),
			BUZZAPI_PASSWORD: z.string(),
		}),
	);

const SESEmailProviderSchema = z
	.object({
		EMAIL_PROVIDER: z.literal("SES"),
	})
	.and(
		z.object({
			EMAIL_SES_REGION: z.string().default("us-east-1"),
			EMAIL_SES_ACCESS_KEY_ID: z.string().optional(),
			EMAIL_SES_SECRET_ACCESS_KEY: z.string().optional(),
		}),
	);

const SMTPEmailProviderSchema = z
	.object({
		EMAIL_PROVIDER: z.literal("SMTP"),
	})
	.and(
		z.object({
			EMAIL_SMTP_HOST: z.string(),
			EMAIL_SMTP_PORT: z.coerce.number().default(587),
			EMAIL_SMTP_SECURE: z.coerce.boolean().default(false),
			EMAIL_SMTP_USER: z.string().optional(),
			EMAIL_SMTP_PASSWORD: z.string().optional(),
		}),
	);

const NoneEmailProviderSchema = z.object({
	EMAIL_PROVIDER: z.literal("NONE"),
});

export const ZEnvSchema = z.intersection(
	BaseEnvSchema,
	z.intersection(
		z.union([LegacyProviderSchema, BuzzApiProviderSchema]),
		z.union([
			SESEmailProviderSchema,
			SMTPEmailProviderSchema,
			NoneEmailProviderSchema,
		]),
	),
);

export type TEnvSchema = z.infer<typeof ZEnvSchema>;
