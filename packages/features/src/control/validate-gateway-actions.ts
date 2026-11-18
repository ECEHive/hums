import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

export interface GatewayActionInput {
	controlPointId: string;
	action: "TURN_ON" | "TURN_OFF" | "UNLOCK";
}

function badRequest(message: string): never {
	throw new TRPCError({ code: "BAD_REQUEST", message });
}

/** Throws BAD_REQUEST unless every action can be saved on a gateway. */
export async function validateGatewayActions(
	actions: GatewayActionInput[],
): Promise<void> {
	if (actions.length === 0) return;

	const ids = actions.map((a) => a.controlPointId);
	const uniqueIds = Array.from(new Set(ids));
	const points = await prisma.controlPoint.findMany({
		where: { id: { in: uniqueIds } },
		select: { id: true, name: true, controlClass: true },
	});
	const pointsById = new Map(points.map((p) => [p.id, p]));

	const missingIds = uniqueIds.filter((id) => !pointsById.has(id));
	if (missingIds.length > 0) {
		badRequest(`Control points not found: ${missingIds.join(", ")}`);
	}

	// One action per point: two would either repeat or contradict each other
	// (TURN_ON and TURN_OFF in the same scan).
	const seen = new Set<string>();
	for (const id of ids) {
		if (seen.has(id)) {
			badRequest(
				`${pointsById.get(id)?.name} is used more than once; each control point can have only one action`,
			);
		}
		seen.add(id);
	}

	for (const action of actions) {
		const point = pointsById.get(action.controlPointId);
		if (!point) continue;

		if (point.controlClass === "DOOR" && action.action !== "UNLOCK") {
			badRequest(
				`Door control points can only use the UNLOCK action (point: ${point.name})`,
			);
		}

		if (point.controlClass === "SWITCH" && action.action === "UNLOCK") {
			badRequest(
				`Switch control points can only use TURN_ON or TURN_OFF actions (point: ${point.name})`,
			);
		}
	}
}
