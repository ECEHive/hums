import { prisma } from "@ecehive/prisma";
import type { AuditLogPayload } from "../audit-logs/logger";

function toCamelCase(value: string) {
	const words = value.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g) ?? [value];
	return words
		.map((word, index) => {
			const normalized = word.toLowerCase();
			return index === 0
				? normalized
				: `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
		})
		.join("");
}

export async function sendActions(payload: AuditLogPayload) {
	const webhookEndpoints = await prisma.webhookEndpoint.findMany({
		where: {
			sendActions: {
				has: payload.action,
			},
		},
	});
	for (const endpoint of webhookEndpoints) {
		await fetch(endpoint.url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});
	}
}

export type TicketSendable = {
	ticketTypeId: number;
	ticketTypeName: string;
	ticketUrl: string;
	data: object;
	submitterId: number | null;
	submitterEmail: string | null;
	submitterName: string | null;
};

export async function sendTickets(ticket: TicketSendable) {
	const webhookEndpoints = await prisma.webhookEndpoint.findMany({
		where: {
			sendTickets: true,
		},
	});
	for (const endpoint of webhookEndpoints) {
		await fetch(endpoint.url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				ticketTypeId: ticket.ticketTypeId,
				ticketTypeName: ticket.ticketTypeName,
				ticketUrl: ticket.ticketUrl,
				submitterId: ticket.submitterId,
				submitterEmail: ticket.submitterEmail,
				submitterName: ticket.submitterName,
				...Object.fromEntries(
					Object.entries(ticket.data).map(([key, value]) => [
						toCamelCase(key),
						value,
					]),
				),
			}),
		});
	}
}
