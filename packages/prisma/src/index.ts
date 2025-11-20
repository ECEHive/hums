import { PrismaClient } from "../generated/prisma/client";

export const prisma = new PrismaClient();

export type * from "../generated/prisma/client";
export { Prisma } from "../generated/prisma/client";
