import type { FastifyRequest } from "fastify";

/**
 * Extracts the client IP address from request headers with proper priority and format handling.
 *
 * Priority order:
 * 1. x-forwarded-for
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
		// Handle comma-separated list
		return ip.split(",")[0].trim();
	}

	// Priority 2: x-real-ip
	const xRealIp = req.headers["x-real-ip"];
	if (xRealIp) {
		const ip = Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
		// Handle comma-separated list
		return ip.split(",")[0].trim();
	}

	// Priority 3: Socket remote address
	const remoteAddress = req.socket.remoteAddress;
	if (remoteAddress) {
		// Remote address shouldn't be an array or comma-separated, but handle it just in case
		return remoteAddress.split(",")[0].trim();
	}

	return "unknown";
}
