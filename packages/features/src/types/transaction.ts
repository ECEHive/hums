import type { db } from "@ecehive/drizzle";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
