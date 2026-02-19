export type ApiTokenRow = {
	id: number;
	name: string;
	description: string | null;
	prefix: string;
	preview: string;
	createdById: number | null;
	expiresAt: Date | null;
	lastUsedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	isExpired: boolean;
	permissions: { id: number; name: string }[];
};
