import * as path from "node:path";
import { env } from "@ecehive/env";
import { TRPCError } from "@trpc/server";

/**
 * Get the resolved absolute path for security storage.
 * Validates the configured path to prevent path traversal attacks.
 *
 * @returns The absolute path to the security storage directory
 * @throws TRPCError if the configured path is invalid
 */
export function getSecurityStoragePath(): string {
	const configuredPath = env.SECURITY_STORAGE_PATH;

	// Resolve to absolute path
	const absolutePath = path.resolve(configuredPath);

	// Security validation: ensure the path doesn't contain suspicious patterns
	// that could indicate path traversal attempts in environment configuration
	if (
		configuredPath.includes("..") ||
		absolutePath.includes("..") ||
		// Check for null bytes (path injection)
		configuredPath.includes("\0")
	) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Invalid security storage path configuration",
		});
	}

	return absolutePath;
}

/**
 * Validate that a file path is within the security storage directory.
 * Prevents path traversal attacks when reading/writing files.
 *
 * @param filePath The file path to validate (relative or absolute)
 * @returns The validated absolute file path
 * @throws TRPCError if the path is outside the storage directory
 */
export function validateSecurityFilePath(filePath: string): string {
	const storagePath = getSecurityStoragePath();

	// If the filePath is relative, join it with storage path
	const absoluteFilePath = path.isAbsolute(filePath)
		? filePath
		: path.join(storagePath, filePath);

	// Resolve to canonical path (removes . and ..)
	const resolvedPath = path.resolve(absoluteFilePath);

	// Ensure the resolved path is within the storage directory
	if (
		!resolvedPath.startsWith(storagePath + path.sep) &&
		resolvedPath !== storagePath
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Invalid file path - outside security storage directory",
		});
	}

	return resolvedPath;
}
