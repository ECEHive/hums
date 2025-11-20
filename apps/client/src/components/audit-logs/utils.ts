import { formatInAppTimezone } from "@/lib/timezone";
import type {
	AuditLogFilterApiToken,
	AuditLogFilterUser,
	AuditLogRow,
} from "./types";

export function formatDateTime(value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return formatInAppTimezone(date, { includeTimezoneWhenDifferent: true });
}

export function formatActor(actor: AuditLogRow["user"]) {
	if (!actor) return null;
	return actor.name || actor.username || actor.email || `User #${actor.id}`;
}

export function summarizeMetadata(metadata: unknown) {
	if (metadata === null || typeof metadata === "undefined")
		return "No metadata";
	try {
		const text = JSON.stringify(metadata);
		return text.length > 120 ? `${text.slice(0, 117)}…` : text;
	} catch (error) {
		console.error("Failed to stringify metadata", error);
		return "Unable to show metadata";
	}
}

export function stringifyMetadata(metadata: unknown) {
	try {
		return JSON.stringify(metadata, null, 2);
	} catch {
		return "<unable to serialize metadata>";
	}
}

export function formatAuditLogUserLabel(user: AuditLogFilterUser) {
	return user.name || user.username || user.email || `User #${user.id}`;
}

export function formatAuditLogApiTokenPrimary(token: AuditLogFilterApiToken) {
	return token.name || `Token #${token.id}`;
}

export function formatAuditLogApiTokenSecondary(token: AuditLogFilterApiToken) {
	return `Prefix ${token.prefix}`;
}
