import { LogOut, RefreshCw } from "lucide-react";
import { KioskBadge, KioskButton, KioskCard } from "@/components/kiosk-ui";

interface TapOutActionSelectorProps {
	userName: string;
	currentSessionType: "regular" | "staffing";
	onSelectAction: (
		action: "end_session" | "switch_to_staffing" | "switch_to_regular",
	) => void;
	onCancel: () => void;
}

export function TapOutActionSelector({
	userName,
	currentSessionType,
	onSelectAction,
	onCancel,
}: TapOutActionSelectorProps) {
	return (
		<div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
			<div
				className="kiosk-max-w-4xl mx-auto kiosk-gap-6 flex flex-col animate-in fade-in zoom-in-95 duration-300"
				style={{ padding: "calc(1rem * var(--kiosk-scale))" }}
			>
				<div className="text-center kiosk-gap-2 flex flex-col">
					<h2 className="kiosk-text-5xl font-bold">Goodbye, {userName}!</h2>
					<div className="flex items-center justify-center kiosk-gap-2">
						<p className="kiosk-text-2xl text-muted-foreground">
							Current session:
						</p>
						<KioskBadge
							variant="outline"
							style={{
								fontSize: "calc(1.25rem * var(--kiosk-scale))",
								padding:
									"calc(0.25rem * var(--kiosk-scale)) calc(0.75rem * var(--kiosk-scale))",
							}}
						>
							{currentSessionType === "regular" ? "Regular" : "Staffing"}
						</KioskBadge>
					</div>
					<p className="kiosk-text-xl text-muted-foreground">
						What would you like to do?
					</p>
				</div>

				<div className="grid grid-cols-2 kiosk-gap-6">
					<KioskCard
						className="hover:border-blue-500 transition-all group"
						style={{
							borderWidth: "calc(4px * var(--kiosk-scale))",
							padding: "calc(3rem * var(--kiosk-scale))",
						}}
						onClick={() => onSelectAction("end_session")}
					>
						<div className="flex flex-col items-center kiosk-gap-6">
							<div className="relative">
								<LogOut className="kiosk-icon-2xl text-blue-500 group-hover:scale-110 transition-transform" />
							</div>
							<div className="text-center kiosk-gap-2 flex flex-col">
								<h3 className="kiosk-text-4xl font-bold text-blue-500">
									Leave
								</h3>
								<p className="kiosk-text-xl text-muted-foreground">
									End your current session
								</p>
							</div>
						</div>
					</KioskCard>

					<KioskCard
						className={`transition-all group ${
							currentSessionType === "staffing"
								? "hover:border-orange-500"
								: "hover:border-purple-500"
						}`}
						style={{
							borderWidth: "calc(4px * var(--kiosk-scale))",
							padding: "calc(3rem * var(--kiosk-scale))",
						}}
						onClick={() =>
							onSelectAction(
								currentSessionType === "staffing"
									? "switch_to_regular"
									: "switch_to_staffing",
							)
						}
					>
						<div className="flex flex-col items-center kiosk-gap-6">
							<div className="relative">
								<RefreshCw
									className={`kiosk-icon-2xl group-hover:scale-110 transition-transform ${
										currentSessionType === "staffing"
											? "text-orange-500"
											: "text-purple-500"
									}`}
								/>
							</div>
							<div className="text-center kiosk-gap-2 flex flex-col">
								<h3
									className={`kiosk-text-4xl font-bold ${
										currentSessionType === "staffing"
											? "text-orange-500"
											: "text-purple-500"
									}`}
								>
									{currentSessionType === "staffing"
										? "Switch to Regular"
										: "Switch to Staffing"}
								</h3>
								<p className="kiosk-text-xl text-muted-foreground">
									{currentSessionType === "staffing"
										? "End session and start regular"
										: "End session and start staffing"}
								</p>
							</div>
						</div>
					</KioskCard>
				</div>

				<div className="flex justify-center">
					<KioskButton
						variant="outline"
						onClick={onCancel}
						style={{
							fontSize: "calc(1.125rem * var(--kiosk-scale))",
							padding:
								"calc(0.75rem * var(--kiosk-scale)) calc(1.5rem * var(--kiosk-scale))",
						}}
					>
						Cancel
					</KioskButton>
				</div>
			</div>
		</div>
	);
}
