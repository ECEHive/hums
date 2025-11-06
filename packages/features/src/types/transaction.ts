import type { prisma } from "@ecehive/prisma";

export type Transaction = Omit<
	typeof prisma,
	"$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
