import { env } from "@ecehive/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client";

const adapter = new PrismaPg({
	connectionString: env.DATABASE_URL,
});
export const prisma = new PrismaClient({ adapter });

export * from "../generated/client";
export { Prisma } from "../generated/client";
