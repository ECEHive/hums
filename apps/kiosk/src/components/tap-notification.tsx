import { LogIn, LogOut, RefreshCw } from "lucide-react";
import { KioskCard } from "@/components/kiosk-ui";
import type { TapEvent } from "@/types";

interface TapNotificationProps {
	event: TapEvent;
	isExiting: boolean;
}

export function TapNotification({ event, isExiting }: TapNotificationProps) {
	const isTapIn = event.status === "tapped_in";
	const isSwitchToStaffing = event.status === "switched_to_staffing";
	const isSwitchToRegular = event.status === "switched_to_regular";
	const isSwitch = isSwitchToStaffing || isSwitchToRegular;

	return (
		<div
			className={`absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md transition-opacity duration-300 ${
				isExiting ? "opacity-0" : "opacity-100 animate-in fade-in"
			}`}
		>
			<div
				key={event.id}
				className={`kiosk-max-w-2xl mx-auto transition-all duration-500 ${
					isExiting
						? "scale-95 opacity-0 translate-y-4"
						: "scale-100 opacity-100 translate-y-0 animate-in zoom-in-95 slide-in-from-bottom-4"
				}`}
				style={{ padding: "calc(1rem * var(--kiosk-scale))" }}
			>
				<KioskCard
					className={`shadow-2xl transition-colors duration-300 ${
						isTapIn
							? "border-green-500"
							: isSwitchToStaffing
								? "border-purple-500"
								: isSwitchToRegular
									? "border-orange-500"
									: "border-blue-500"
					}`}
					style={{
						borderWidth: "calc(8px * var(--kiosk-scale))",
						padding: "calc(4rem * var(--kiosk-scale))",
					}}
				>
					<div className="flex flex-col items-center kiosk-gap-8">
						{isTapIn ? (
							<>
								<div className="relative">
									<LogIn className="kiosk-icon-3xl text-green-500 animate-in zoom-in-50 duration-700" />
									<div className="absolute inset-0 animate-ping">
										<LogIn className="kiosk-icon-3xl text-green-500 opacity-40" />
									</div>
								</div>
								<div className="text-center kiosk-gap-3 flex flex-col animate-in slide-in-from-bottom-2 duration-500 delay-200">
									<h2 className="kiosk-text-6xl font-bold text-green-500">
										Welcome!
									</h2>
									<p className="kiosk-text-4xl font-semibold">
										{event.user.name}
									</p>
								</div>
							</>
						) : isSwitch ? (
							<>
								<div className="relative">
									<RefreshCw
										className={`kiosk-icon-3xl animate-in zoom-in-50 duration-700 ${
											isSwitchToStaffing ? "text-purple-500" : "text-orange-500"
										}`}
									/>
									<div className="absolute inset-0 animate-ping">
										<RefreshCw
											className={`kiosk-icon-3xl opacity-40 ${
												isSwitchToStaffing
													? "text-purple-500"
													: "text-orange-500"
											}`}
										/>
									</div>
								</div>
								<div className="text-center kiosk-gap-3 flex flex-col animate-in slide-in-from-bottom-2 duration-500 delay-200">
									<h2
										className={`kiosk-text-6xl font-bold ${
											isSwitchToStaffing ? "text-purple-500" : "text-orange-500"
										}`}
									>
										{isSwitchToStaffing
											? "Switched to Staffing!"
											: "Switched to Regular!"}
									</h2>
									<p className="kiosk-text-4xl font-semibold">
										{event.user.name}
									</p>
								</div>
							</>
						) : (
							<>
								<div className="relative">
									<LogOut className="kiosk-icon-3xl text-blue-500 animate-in zoom-in-50 duration-700" />
									<div className="absolute inset-0 animate-ping">
										<LogOut className="kiosk-icon-3xl text-blue-500 opacity-40" />
									</div>
								</div>
								<div className="text-center kiosk-gap-3 flex flex-col animate-in slide-in-from-bottom-2 duration-500 delay-200">
									<h2 className="kiosk-text-6xl font-bold text-blue-500">
										Goodbye!
									</h2>
									<p className="kiosk-text-4xl font-semibold">
										{event.user.name}
									</p>
								</div>
							</>
						)}
					</div>
				</KioskCard>
			</div>
		</div>
	);
}
