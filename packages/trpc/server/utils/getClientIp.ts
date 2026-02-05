import { getLogger } from "@ecehive/logger";
import type { FastifyRequest } from "fastify";

const logger = getLogger("trpc:ip");

/**
 * Extracts the client IP address from request headers with proper priority and format handling.
 *
 * This function trusts the X-Forwarded-For and X-Real-IP headers.
 * These headers can be spoofed by clients unless you:
 * 1. Have a trusted reverse proxy (nginx, etc.) that sets these headers
 * 2. Configure Fastify with trustProxy: true
 * 3. Ensure your proxy strips/overwrites any client-provided X-Forwarded-For headers
 *
 * For device-based authentication, ensure your network infrastructure:
 * - Has devices on a trusted network segment
 * - Uses a properly configured reverse proxy
 * - Strips client-provided forwarding headers before adding the real IP
 *
 * Priority order:
 * 1. x-forwarded-for (first IP in the list)
 * 2. x-real-ip
 * 3. Socket remote address
 *
 * Handles various formats:
 * - String or array of strings (takes first if array)
 * - Comma-separated lists (takes first IP)
 * - Trims whitespace
 *
 * @param req - The incoming HTTP request
 * @returns The client IP address or "unknown" if not found
 */
export function getClientIp(req: FastifyRequest): string {
	// Priority 1: x-forwarded-for
	const xForwardedFor = req.headers["x-forwarded-for"];
	if (xForwardedFor) {
		const ip = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
		const clientIp = ip.split(",")[0].trim();

		// Validate IP format (basic check)
		if (isValidIpAddress(clientIp)) {
			return clientIp;
		}
		logger.warn("Invalid IP format in X-Forwarded-For header", {
			value: clientIp,
		});
	}

	// Priority 2: x-real-ip
	const xRealIp = req.headers["x-real-ip"];
	if (xRealIp) {
		const ip = Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
		const clientIp = ip.split(",")[0].trim();

		// Validate IP format (basic check)
		if (isValidIpAddress(clientIp)) {
			return clientIp;
		}
		logger.warn("Invalid IP format in X-Real-IP header", { value: clientIp });
	}

	// Priority 3: Socket remote address
	const remoteAddress = req.socket.remoteAddress;
	if (remoteAddress) {
		// Remote address shouldn't be an array or comma-separated, but handle it just in case
		const clientIp = remoteAddress.split(",")[0].trim();
		if (isValidIpAddress(clientIp)) {
			return clientIp;
		}
	}

	logger.warn("Could not determine client IP address");
	return "unknown";
}

/**
 * Basic validation for IP address format (IPv4 or IPv6)
 * This is not exhaustive but catches obvious invalid values
 */
function isValidIpAddress(ip: string): boolean {
	if (!ip || ip.length === 0 || ip.length > 45) {
		return false;
	}

	// IPv4 pattern (basic)
	const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;

	// IPv6 pattern (basic - allows shortened forms)
	const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

	// IPv4-mapped IPv6 (e.g., ::ffff:192.168.1.1)
	const ipv4MappedPattern = /^::ffff:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/i;

	return (
		ipv4Pattern.test(ip) || ipv6Pattern.test(ip) || ipv4MappedPattern.test(ip)
	);
}
