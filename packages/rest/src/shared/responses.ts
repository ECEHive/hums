/**
 * Standard success response for single resource operations
 * @param data - The resource data to return to the client
 */
export function successResponse<T>(data: T) {
	return {
		success: true as const,
		data,
	};
}

/**
 * Standard success response for list operations with pagination
 * @param items - The array of items to return
 * @param meta - Pagination metadata
 * @param meta.total - The total number of items available
 * @param meta.skip - The number of items skipped
 * @param meta.take - The number of items per page
 * @param meta.hasMore - Whether there are more items available
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
 * @param created - Array of successfully created items
 * @param updated - Array of successfully updated items
 * @param failed - Array of items that failed to process with their error messages
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
