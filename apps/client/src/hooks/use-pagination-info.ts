import { useMemo } from "react";

interface UsePaginationInfoOptions {
	total: number;
	pageSize: number;
	offset: number;
	currentCount: number;
}

interface UsePaginationInfoReturn {
	totalPages: number;
	startIndex: number;
	endIndex: number;
	hasData: boolean;
	isLastPage: boolean;
	isFirstPage: boolean;
}

/**
 * Hook for calculating pagination metadata
 *
 * @example
 * ```tsx
 * const { totalPages, startIndex, endIndex } = usePaginationInfo({
 *   total: 100,
 *   pageSize: 10,
 *   offset: 20,
 *   currentCount: 10,
 * });
 * ```
 */
export function usePaginationInfo({
	total,
	pageSize,
	offset,
	currentCount,
}: UsePaginationInfoOptions): UsePaginationInfoReturn {
	return useMemo(() => {
		const totalPages = Math.max(1, Math.ceil(total / pageSize));
		const startIndex = offset + 1;
		const endIndex = offset + currentCount;
		const hasData = total > 0;
		const currentPage = Math.floor(offset / pageSize) + 1;
		const isLastPage = currentPage >= totalPages;
		const isFirstPage = currentPage === 1;

		return {
			totalPages,
			startIndex,
			endIndex,
			hasData,
			isLastPage,
			isFirstPage,
		};
	}, [total, pageSize, offset, currentCount]);
}
