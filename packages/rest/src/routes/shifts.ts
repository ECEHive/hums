import { type Prisma, prisma } from "@ecehive/prisma";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePermission } from "../shared/permissions";
import { validationError } from "../shared/validation";

function dateQueryWithBoundary(boundary: "start" | "end") {
	const time = boundary === "start" ? "00:00:00.000" : "23:59:59.999";

	return z.preprocess(
		(value) =>
			typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
				? `${value}T${time}Z`
				: value,
		z.coerce.date(),
	);
}

const ListShiftsQuerySchema = z.object({
	from: dateQueryWithBoundary("start").optional(),
	to: dateQueryWithBoundary("end").optional(),
	name: z.string().optional(),
	location: z.string().optional(),
	registeredOnly: z
		.enum(["true", "false"])
		.transform((value) => value === "true")
		.optional(),
});

// ===== Helper Types =====

type SerializedShiftOccurrence = {
	id: number;
	timestamp: Date;
	createdAt: Date;
	updatedAt: Date;
	shiftSchedule: {
		id: number;
		startTime: string;
		endTime: string;
		shiftType: {
			id: number;
			name: string;
			location: string;
		};
	};
	assignedUsers: Array<{
		id: number;
		name: string;
	}>;
};

// ===== Helper Functions =====

function serializeShiftOccurrence(
	shiftOccurrence: Prisma.ShiftOccurrenceGetPayload<{
		include: {
			users: true;
			shiftSchedule: {
				include: {
					shiftType: true;
				};
			};
		};
	}>,
): SerializedShiftOccurrence {
	const serialized: SerializedShiftOccurrence = {
		id: shiftOccurrence.id,
		timestamp: shiftOccurrence.timestamp,
		createdAt: shiftOccurrence.createdAt,
		updatedAt: shiftOccurrence.updatedAt,
		shiftSchedule: {
			id: shiftOccurrence.shiftSchedule.id,
			startTime: shiftOccurrence.shiftSchedule.startTime,
			endTime: shiftOccurrence.shiftSchedule.endTime,
			shiftType: {
				id: shiftOccurrence.shiftSchedule.shiftType.id,
				name: shiftOccurrence.shiftSchedule.shiftType.name,
				location: shiftOccurrence.shiftSchedule.shiftType.location,
			},
		},
		assignedUsers: shiftOccurrence.users.map((user) => ({
			id: user.id,
			name: user.name,
		})),
	};
	return serialized;
}

function combineShiftOccurrences(
	shiftOccurrences: Prisma.ShiftOccurrenceGetPayload<{
		include: {
			users: true;
			shiftSchedule: {
				include: {
					shiftType: true;
				};
			};
		};
	}>[],
) {
	const combined = new Map<string, SerializedShiftOccurrence>();

	for (const shiftOccurrence of shiftOccurrences) {
		const serialized = serializeShiftOccurrence(shiftOccurrence);
		const key = `${serialized.shiftSchedule.id}:${serialized.timestamp.toISOString()}`;
		const existing = combined.get(key);

		if (!existing) {
			combined.set(key, serialized);
			continue;
		}

		const usersById = new Map(
			existing.assignedUsers.map((user) => [user.id, user]),
		);
		for (const user of serialized.assignedUsers) {
			usersById.set(user.id, user);
		}
		existing.assignedUsers = Array.from(usersById.values());
	}

	return Array.from(combined.values());
}

// ===== Routes =====

export const shiftOccurrencesRoutes: FastifyPluginAsync = async (fastify) => {
	// List matching shifts
	fastify.get("/", async (request, reply) => {
		if (await requirePermission(request, reply, "shift_occurrences.list"))
			return;

		const parsed = ListShiftsQuerySchema.safeParse(request.query);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const { from, to, name, location, registeredOnly } = parsed.data;

		let where: Prisma.ShiftOccurrenceWhereInput | undefined;
		const conditions: Prisma.ShiftOccurrenceWhereInput[] = [];

		if (from) {
			conditions.push({
				timestamp: { gte: from },
			});
		}

		if (to) {
			conditions.push({
				timestamp: { lte: to },
			});
		}

		if (name) {
			conditions.push({
				shiftSchedule: {
					shiftType: {
						name: { equals: name, mode: "insensitive" },
					},
				},
			});
		}

		if (location) {
			conditions.push({
				shiftSchedule: {
					shiftType: {
						location: { equals: location, mode: "insensitive" },
					},
				},
			});
		}

		if (registeredOnly) {
			conditions.push({
				users: { some: {} },
			});
		}

		if (conditions.length > 0) {
			where = { AND: conditions };
		}

		const shiftOccurrences = await prisma.shiftOccurrence.findMany({
			where,
			include: {
				users: true,
				shiftSchedule: {
					include: {
						shiftType: true,
					},
				},
			},
			orderBy: { timestamp: "asc" },
		});

		return combineShiftOccurrences(shiftOccurrences);
	});
};
