import type { ControlProviderType } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { getControlProvider } from "./providers";

export async function getControlPoint(id: string) {
	const point = await prisma.controlPoint.findUnique({
		where: { id },
		include: {
			provider: {
				select: {
					id: true,
					name: true,
					providerType: true,
					isActive: true,
				},
			},
			authorizedRoles: {
				select: { id: true, name: true },
			},
			authorizedUsers: {
				select: { id: true, name: true, username: true, email: true },
			},
		},
	});

	if (!point) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control point not found",
		});
	}

	return point;
}

export async function findControlPoint(id: string) {
	return prisma.controlPoint.findUnique({
		where: { id },
		include: {
			provider: {
				select: {
					id: true,
					name: true,
					providerType: true,
					isActive: true,
				},
			},
			authorizedRoles: {
				select: { id: true, name: true },
			},
			authorizedUsers: {
				select: { id: true, name: true, username: true, email: true },
			},
		},
	});
}

export type ReadControlPointStateResult = {
	success: boolean;
	state: boolean | null;
	fromCache: boolean;
	error?: string;
};

export async function readControlPointState(
	id: string,
): Promise<ReadControlPointStateResult> {
	const point = await prisma.controlPoint.findUnique({
		where: { id },
		include: {
			provider: true,
		},
	});

	if (!point) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control point not found",
		});
	}

	if (!point.isActive || !point.provider.isActive) {
		return {
			success: true,
			state: point.currentState,
			fromCache: true,
		};
	}

	const provider = getControlProvider(
		point.provider.providerType as ControlProviderType,
	);

	const result = await provider.readState(
		point.provider.config,
		point.providerConfig,
	);

	if (result.success && result.state !== undefined) {
		await prisma.controlPoint.update({
			where: { id: point.id },
			data: { currentState: result.state },
		});

		return {
			success: true,
			state: result.state,
			fromCache: false,
		};
	}

	return {
		success: false,
		state: point.currentState,
		fromCache: true,
		error: result.errorMessage,
	};
}

export type ControlPointWithRelations = NonNullable<
	Awaited<ReturnType<typeof getControlPoint>>
>;
