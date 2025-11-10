export type ConnectionStatus =
	| "disconnected"
	| "connecting"
	| "connected"
	| "error";

export type TapResponse =
	| {
			status: "tapped_in" | "tapped_out";
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
	  }
	| {
			status: "agreements_required";
			user: {
				id: number;
				name: string;
				email: string;
				username: string;
			};
			missingAgreements: {
				id: number;
				title: string;
				content: string;
				confirmationText: string;
			}[];
	  };

export type TapEvent = Extract<
	TapResponse,
	{ status: "tapped_in" | "tapped_out" }
> & {
	id: string;
	timestamp: Date;
};

export type KioskStatus = {
	isKiosk: boolean;
	ip?: string;
	checking: boolean;
};
