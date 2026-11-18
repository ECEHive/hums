/**
 * Control Gateways - Invoke
 *
 * Runs every action on a gateway for the user behind a credential, or none
 * of them:
 * 1. Every action is checked (equipment, authorization, active session)
 *    without contacting a provider. If any action can't run, the invocation
 *    is rejected.
 * 2. The actions run in order, stopping at the first failed write. Providers
 *    have no transactions, so actions that already ran are reported, not
 *    undone.
 */

import type {
	ControlAction,
	ControlProviderType,
	Prisma,
} from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { hashCredential } from "../credentials/hash";
import { getControlProvider } from "./providers";
import type { ControlOperationResult } from "./providers/types";
import { getUserActiveSession } from "./session-control-validation";

export interface InvokeControlGatewayInput {
	accessToken: string;
	credentialValue: string;
}

export type BlockReason =
	| "POINT_INACTIVE"
	| "PROVIDER_INACTIVE"
	| "REQUIRES_BUDDY"
	| "NOT_AUTHORIZED"
	| "NO_ACTIVE_SESSION";

/** Reasons that depend on who scanned, rather than on the equipment. */
const USER_REASONS: ReadonlySet<BlockReason> = new Set([
	"NOT_AUTHORIZED",
	"NO_ACTIVE_SESSION",
]);

export type GatewayActionResult = {
	controlPointId: string;
	controlPointName: string;
	action: ControlAction;
} & (
	| { status: "done"; newState: boolean }
	| { status: "blocked"; reason: BlockReason }
	| { status: "failed"; message: string }
	| { status: "not_run" }
);

export interface InvokeControlGatewayResult {
	gatewayId: number;
	gatewayName: string;
	userId: number;
	username: string;
	results: GatewayActionResult[];
}

export type GatewayErrorCode =
	| "INVALID_TOKEN"
	| "GATEWAY_INACTIVE"
	| "INVALID_CREDENTIAL"
	| "NOT_AUTHORIZED"
	| "ACTION_UNAVAILABLE"
	| "EXECUTION_FAILED";

export class GatewayError extends Error {
	readonly code: GatewayErrorCode;
	/** Every action's outcome, for errors raised after the actions were known. */
	readonly results?: GatewayActionResult[];

	constructor(
		code: GatewayErrorCode,
		message: string,
		results?: GatewayActionResult[],
	) {
		super(message);
		this.name = "GatewayError";
		this.code = code;
		this.results = results;
	}
}

const gatewayInclude = {
	actions: {
		orderBy: { id: "asc" },
		include: {
			controlPoint: {
				include: {
					provider: true,
					authorizedRoles: { select: { id: true } },
					authorizedUsers: { select: { id: true } },
				},
			},
		},
	},
} satisfies Prisma.ControlGatewayInclude;

type GatewayAction = Prisma.ControlGatewayGetPayload<{
	include: typeof gatewayInclude;
}>["actions"][number];

type PlannedAction = {
	gatewayAction: GatewayAction;
	resolvedAction: ControlAction;
	previousState: boolean;
};

/**
 * Returns only when every action succeeded; otherwise throws a GatewayError
 * whose `results` say what happened to each action.
 */
export async function invokeControlGateway(
	input: InvokeControlGatewayInput,
): Promise<InvokeControlGatewayResult> {
	const gateway = await prisma.controlGateway.findUnique({
		where: { accessToken: input.accessToken },
		include: gatewayInclude,
	});
	if (!gateway) {
		throw new GatewayError("INVALID_TOKEN", "Invalid gateway access token");
	}
	if (!gateway.isActive) {
		throw new GatewayError("GATEWAY_INACTIVE", "This gateway is not active");
	}

	const user = await findUserByCredential(input.credentialValue);
	if (!user) {
		throw new GatewayError(
			"INVALID_CREDENTIAL",
			"No user found for the provided credential",
		);
	}

	const { actions } = gateway;
	const roleIds = new Set(user.roles.map((r) => r.id));
	const hasSession =
		user.isSystemUser || (await getUserActiveSession(prisma, user.id)) !== null;
	rejectIfBlocked(
		actions.map((a) => checkAction(a, user, roleIds, hasSession)),
	);

	const planned = actions.map((gatewayAction) => ({
		gatewayAction,
		resolvedAction: gatewayAction.action,
		previousState: gatewayAction.controlPoint.currentState,
	}));
	const results = await runActions(planned, user);

	return {
		gatewayId: gateway.id,
		gatewayName: gateway.name,
		userId: user.id,
		username: user.username,
		results,
	};
}

async function findUserByCredential(value: string) {
	const credential = await prisma.credential.findUnique({
		where: { hash: hashCredential(value) },
		include: {
			user: { include: { roles: { select: { id: true } } } },
		},
	});
	return credential?.user ?? null;
}

type GatewayUser = NonNullable<
	Awaited<ReturnType<typeof findUserByCredential>>
>;

function describe(gatewayAction: GatewayAction) {
	return {
		controlPointId: gatewayAction.controlPoint.id,
		controlPointName: gatewayAction.controlPoint.name,
		action: gatewayAction.action,
	};
}

function notRun(gatewayAction: GatewayAction): GatewayActionResult {
	return { ...describe(gatewayAction), status: "not_run" };
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** The action's result if it is blocked, or not_run if it may run. */
function checkAction(
	gatewayAction: GatewayAction,
	user: GatewayUser,
	roleIds: Set<number>,
	hasSession: boolean,
): GatewayActionResult {
	const point = gatewayAction.controlPoint;
	const blocked = (reason: BlockReason): GatewayActionResult => ({
		...describe(gatewayAction),
		status: "blocked",
		reason,
	});

	if (!point.isActive) return blocked("POINT_INACTIVE");
	if (!point.provider.isActive) return blocked("PROVIDER_INACTIVE");
	// Gateways can't collect a second card. Create and update reject buddy
	// points; this catches points flagged after they were added.
	if (point.requiresBuddy) return blocked("REQUIRES_BUDDY");
	if (!user.isSystemUser) {
		const unrestricted =
			point.authorizedUsers.length === 0 && point.authorizedRoles.length === 0;
		const authorized =
			unrestricted ||
			point.authorizedUsers.some((u) => u.id === user.id) ||
			point.authorizedRoles.some((r) => roleIds.has(r.id));
		if (!authorized) return blocked("NOT_AUTHORIZED");
		// Matches the control kiosk: operating any point requires being signed
		// in to the space.
		if (!hasSession) return blocked("NO_ACTIVE_SESSION");
	}
	return notRun(gatewayAction);
}

function rejectIfBlocked(checked: GatewayActionResult[]): void {
	const reasons = checked.flatMap((r) =>
		r.status === "blocked" ? [r.reason] : [],
	);
	if (reasons.length === 0) return;

	// Equipment problems take precedence: nobody could run this gateway now.
	if (!reasons.every((r) => USER_REASONS.has(r))) {
		throw new GatewayError(
			"ACTION_UNAVAILABLE",
			"Not every action on this gateway can run",
			checked,
		);
	}
	throw new GatewayError(
		"NOT_AUTHORIZED",
		reasons.every((r) => r === "NO_ACTIVE_SESSION")
			? "User must sign in to the space before using this gateway"
			: "User is not authorized for every action on this gateway",
		checked,
	);
}

async function runActions(
	planned: PlannedAction[],
	user: GatewayUser,
): Promise<GatewayActionResult[]> {
	const results: GatewayActionResult[] = [];
	for (const [i, p] of planned.entries()) {
		const { gatewayAction } = p;
		const targetState = isOnState(p.resolvedAction);
		const write = await writeAction(p, targetState, user);
		if (!write.success) {
			const name = gatewayAction.controlPoint.name;
			throw new GatewayError(
				"EXECUTION_FAILED",
				i === 0
					? `${name} failed; nothing was run`
					: `${name} failed after ${i} of ${planned.length} actions ran; those were not undone`,
				[
					...results,
					{
						...describe(gatewayAction),
						status: "failed",
						message: write.errorMessage ?? "The provider reported a failure",
					},
					...planned.slice(i + 1).map((q) => notRun(q.gatewayAction)),
				],
			);
		}
		results.push({
			...describe(gatewayAction),
			status: "done",
			newState: targetState,
		});
	}
	return results;
}

function isOnState(action: ControlAction): boolean {
	return action === "TURN_ON" || action === "UNLOCK";
}

/**
 * Writes the target state and records the outcome. Only the write decides
 * success: a database error afterwards propagates instead of being reported
 * as a failed action, since the equipment has already changed.
 */
async function writeAction(
	planned: PlannedAction,
	targetState: boolean,
	user: GatewayUser,
): Promise<ControlOperationResult> {
	const point = planned.gatewayAction.controlPoint;

	let write: ControlOperationResult;
	try {
		write = await getControlProvider(
			point.provider.providerType as ControlProviderType,
		).writeState(
			point.provider.config,
			point.providerConfig,
			targetState,
			user.username,
		);
	} catch (error) {
		write = { success: false, errorMessage: errorMessage(error) };
	}

	await prisma.controlLog.create({
		data: {
			controlPointId: point.id,
			userId: user.id,
			action: planned.resolvedAction,
			previousState: planned.previousState,
			newState: write.success ? targetState : null,
			success: write.success,
			errorMessage: write.errorMessage,
		},
	});

	if (write.success && point.controlClass === "SWITCH") {
		await prisma.controlPoint.update({
			where: { id: point.id },
			data: { currentState: targetState },
		});
	}

	return write;
}
