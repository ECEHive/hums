import { LogIn, LogOut, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
			className={`absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md transition-opacity duration-300 ${
				isExiting ? "opacity-0" : "opacity-100 animate-in fade-in"
			}`}
		>
			<div
				key={event.id}
				className={`w-full max-w-2xl mx-4 transition-all duration-500 ${
					isExiting
						? "scale-95 opacity-0 translate-y-4"
						: "scale-100 opacity-100 translate-y-0 animate-in zoom-in-95 slide-in-from-bottom-4"
				}`}
			>
				<Card
					className={`border-8 shadow-2xl transition-colors duration-300 ${
						isTapIn
							? "border-green-500"
							: isSwitchToStaffing
								? "border-purple-500"
								: isSwitchToRegular
									? "border-orange-500"
									: "border-blue-500"
					}`}
				>
					<CardContent className="flex flex-col items-center gap-8 py-16">
						{isTapIn ? (
							<>
								<div className="relative">
									<LogIn className="h-32 w-32 text-green-500 animate-in zoom-in-50 duration-700" />
									<div className="absolute inset-0 animate-ping">
										<LogIn className="h-32 w-32 text-green-500 opacity-40" />
									</div>
								</div>
								<div className="text-center space-y-3 animate-in slide-in-from-bottom-2 duration-500 delay-200">
									<h2 className="text-5xl font-bold text-green-500">
										Welcome!
									</h2>
									<p className="text-3xl font-semibold">{event.user.name}</p>
								</div>
							</>
						) : isSwitch ? (
							<>
								<div className="relative">
									<RefreshCw
										className={`h-32 w-32 animate-in zoom-in-50 duration-700 ${
											isSwitchToStaffing ? "text-purple-500" : "text-orange-500"
										}`}
									/>
									<div className="absolute inset-0 animate-ping">
										<RefreshCw
											className={`h-32 w-32 opacity-40 ${
												isSwitchToStaffing
													? "text-purple-500"
													: "text-orange-500"
											}`}
										/>
									</div>
								</div>
								<div className="text-center space-y-3 animate-in slide-in-from-bottom-2 duration-500 delay-200">
									<h2
										className={`text-5xl font-bold ${
											isSwitchToStaffing ? "text-purple-500" : "text-orange-500"
										}`}
									>
										{isSwitchToStaffing
											? "Switched to Staffing!"
											: "Switched to Regular!"}
									</h2>
									<p className="text-3xl font-semibold">{event.user.name}</p>
								</div>
							</>
						) : (
							<>
								<div className="relative">
									<LogOut className="h-32 w-32 text-blue-500 animate-in zoom-in-50 duration-700" />
									<div className="absolute inset-0 animate-ping">
										<LogOut className="h-32 w-32 text-blue-500 opacity-40" />
									</div>
								</div>
								<div className="text-center space-y-3 animate-in slide-in-from-bottom-2 duration-500 delay-200">
									<h2 className="text-5xl font-bold text-blue-500">Goodbye!</h2>
									<p className="text-3xl font-semibold">{event.user.name}</p>
								</div>
							</>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
