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
				sessionType: "regular" | "staffing";
				startedAt: Date;
				endedAt: Date | null;
			};
	  }
	| {
			status: "switched_to_staffing" | "switched_to_regular";
			user: {
				id: number;
				name: string;
				email: string;
				username: string;
			};
			endedSession: {
				id: number;
				userId: number;
				sessionType: "regular" | "staffing";
				startedAt: Date;
				endedAt: Date | null;
			};
			newSession: {
				id: number;
				userId: number;
				sessionType: "regular" | "staffing";
				startedAt: Date;
				endedAt: Date | null;
			};
	  }
	| {
			status: "choose_session_type";
			user: {
				id: number;
				name: string;
				email: string;
				username: string;
			};
	  }
	| {
			status: "choose_tap_out_action";
			user: {
				id: number;
				name: string;
				email: string;
				username: string;
			};
			currentSession: {
				id: number;
				userId: number;
				sessionType: "regular" | "staffing";
				startedAt: Date;
				endedAt: Date | null;
			};
	  }
	| {
			status: "confirm_early_leave";
			user: {
				id: number;
				name: string;
				email: string;
				username: string;
			};
			currentSession: {
				id: number;
				userId: number;
				sessionType: "regular" | "staffing";
				startedAt: Date;
				endedAt: Date | null;
			};
	  }
	| {
			status: "confirm_shift_early_leave";
			user: {
				id: number;
				name: string;
				email: string;
				username: string;
			};
			currentSession: {
				id: number;
				userId: number;
				sessionType: "regular" | "staffing";
				startedAt: Date;
				endedAt: Date | null;
			};
			action: "end_session" | "switch_to_regular";
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
	  }
	| {
			status: "suspended";
			user: {
				id: number;
				name: string;
				email: string;
				username: string;
			};
			suspension: {
				endDate: Date;
				externalNotes: string | null;
			};
	  };

export type TapEvent = Extract<
	TapResponse,
	{
		status:
			| "tapped_in"
			| "tapped_out"
			| "switched_to_staffing"
			| "switched_to_regular";
	}
> & {
	id: string;
	timestamp: Date;
};

export type KioskStatus = {
	isKiosk: boolean;
	ip?: string;
	checking: boolean;
};
