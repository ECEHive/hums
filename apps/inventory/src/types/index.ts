export type ConnectionStatus =
	| "disconnected"
	| "connecting"
	| "connected"
	| "error";

export type KioskStatus = {
	isKiosk: boolean;
	ip?: string;
	checking: boolean;
};

export type UserInfo = {
	id: number;
	name: string;
	email: string;
	username: string;
};

export type ScanEvent = {
	user: UserInfo;
	id: string;
	timestamp: Date;
};
