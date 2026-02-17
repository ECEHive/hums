export type { ConnectionStatus } from "@ecehive/card-scanner";

export type KioskStatus = {
	isKiosk: boolean;
	ip?: string;
	checking: boolean;
	controlPoints?: ControlPointInfo[];
};

export type ControlPointInfo = {
	id: string;
	name: string;
	description: string | null;
	location: string | null;
	controlClass: "SWITCH" | "DOOR";
	currentState: boolean;
	isActive: boolean;
};

export type UserInfo = {
	id: number;
	name: string;
	email: string;
	username: string;
};

export type TapResponse =
	| {
			status: "tapped_in" | "tapped_out";
			user: UserInfo;
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
			user: UserInfo;
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
			user: UserInfo;
	  }
	| {
			status: "choose_tap_out_action";
			user: UserInfo;
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
			user: UserInfo;
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
			user: UserInfo;
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
			user: UserInfo;
			missingAgreements: {
				id: number;
				title: string;
				content: string;
				confirmationText: string;
			}[];
	  }
	| {
			status: "suspended";
			user: UserInfo;
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

// Control Kiosk Types
export type ControlPointWithStatus = {
	id: string;
	name: string;
	description: string | null;
	location: string | null;
	controlClass: "SWITCH" | "DOOR";
	currentState: boolean;
	isActive: boolean;
	canControlOnline: boolean;
	authorizedRoles: { id: number; name: string }[];
	authorizedUsers: { id: number; name: string }[];
};

export type AuthenticatedUser = {
	id: string;
	name: string;
	cardNumber: string;
	authorizedControlPointIds: string[];
};

export type ControlKioskState = {
	mode:
		| "idle"
		| "processing"
		| "authenticated"
		| "control-pending"
		| "success"
		| "error";
	authenticatedUser: AuthenticatedUser | null;
	selectedControlPoint: ControlPointWithStatus | null;
	error: string | null;
};
