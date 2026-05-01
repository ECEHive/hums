export type ItemRow = {
	id: string;
	name: string;
	description?: string | null;
	sku?: string | null;
	location?: string | null;
	minQuantity?: number | null;
	link?: string | null;
	isActive: boolean;
	itemType: "multiple" | "single" | "consumable";
	transactionRateLimit?: number | null;
	transactionRateLimitPeriod?: "day" | "week" | "month" | "semester" | null;
	snapshot?: { quantity: number } | null;
	currentQuantity?: number | null;
	createdAt?: string | null;
	updatedAt?: string | null;
	approvalRoles?: { id: number; name: string }[];
};
