export type WebhookEndpointRow = {
	id: number;
	name: string;
	url: string;
	secret: string | null;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	sendActions: string[];
	sendTickets: boolean;
};
