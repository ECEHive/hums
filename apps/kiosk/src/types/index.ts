export type ConnectionStatus =
	| "disconnected"
	| "connecting"
	| "connected"
	| "error";

export type TapResponse = {
	status: string;
	user: {
		id: number;
		name: string;
		email: string;
		username: string;
	};
	session: {
		id: number;
		userId: number;
		startedAt: Date;
		endedAt: Date | null;
	};
};

export type TapEvent = TapResponse & {
	id: string;
	timestamp: Date;
};

export type KioskStatus = {
	isKiosk: boolean;
	ip?: string;
	checking: boolean;
};
