export type ItemRow = {
	id: string;
	name: string;
	description?: string | null;
	sku?: string | null;
	location?: string | null;
	minQuantity?: number | null;
	isActive: boolean;
	snapshot?: { quantity: number } | null;
	createdAt?: string | null;
	updatedAt?: string | null;
};
