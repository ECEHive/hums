/**
 * Standard success response for single resource operations
 */
export function successResponse<T>(data: T) {
	return {
		success: true as const,
		data,
	};
}

/**
 * Standard success response for list operations with pagination
 */
export function listResponse<T>(
	items: T[],
	meta?: {
		total?: number;
		skip?: number;
		take?: number;
		hasMore?: boolean;
	},
) {
	return {
		success: true as const,
		data: items,
		meta: {
			count: items.length,
			...meta,
		},
	};
}

/**
 * Standard success response for bulk operations
 */
export function bulkResponse<T>(
	created: T[],
	updated: T[],
	failed: Array<{ item: unknown; error: string }>,
) {
	return {
		success: true as const,
		data: {
			created,
			updated,
			failed,
		},
		meta: {
			createdCount: created.length,
			updatedCount: updated.length,
			failedCount: failed.length,
			totalProcessed: created.length + updated.length + failed.length,
		},
	};
}
