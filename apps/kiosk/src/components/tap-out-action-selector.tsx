import { LogOut, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
		<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md">
			<div className="w-full max-w-4xl mx-4 space-y-6 animate-in fade-in zoom-in-95 duration-300">
				<div className="text-center space-y-2">
					<h2 className="text-4xl font-bold">Goodbye, {userName}!</h2>
					<div className="flex items-center justify-center gap-2">
						<p className="text-xl text-muted-foreground">Current session:</p>
						<Badge variant="outline" className="text-lg px-3 py-1">
							{currentSessionType === "regular" ? "Regular" : "Staffing"}
						</Badge>
					</div>
					<p className="text-lg text-muted-foreground">
						What would you like to do?
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<Card
						className="border-4 hover:border-blue-500 transition-all cursor-pointer group"
						onClick={() => onSelectAction("end_session")}
					>
						<CardContent className="flex flex-col items-center gap-6 py-12">
							<div className="relative">
								<LogOut className="h-24 w-24 text-blue-500 group-hover:scale-110 transition-transform" />
							</div>
							<div className="text-center space-y-2">
								<h3 className="text-3xl font-bold text-blue-500">Leave</h3>
								<p className="text-lg text-muted-foreground">
									End your current session
								</p>
							</div>
						</CardContent>
					</Card>

					<Card
						className={`border-4 transition-all cursor-pointer group ${
							currentSessionType === "staffing"
								? "hover:border-orange-500"
								: "hover:border-purple-500"
						}`}
						onClick={() =>
							onSelectAction(
								currentSessionType === "staffing"
									? "switch_to_regular"
									: "switch_to_staffing",
							)
						}
					>
						<CardContent className="flex flex-col items-center gap-6 py-12">
							<div className="relative">
								<RefreshCw
									className={`h-24 w-24 group-hover:scale-110 transition-transform ${
										currentSessionType === "staffing"
											? "text-orange-500"
											: "text-purple-500"
									}`}
								/>
							</div>
							<div className="text-center space-y-2">
								<h3
									className={`text-3xl font-bold ${
										currentSessionType === "staffing"
											? "text-orange-500"
											: "text-purple-500"
									}`}
								>
									{currentSessionType === "staffing"
										? "Switch to Regular"
										: "Switch to Staffing"}
								</h3>
								<p className="text-lg text-muted-foreground">
									{currentSessionType === "staffing"
										? "End session and start regular"
										: "End session and start staffing"}
								</p>
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="flex justify-center">
					<Button variant="outline" size="lg" onClick={onCancel}>
						Cancel
					</Button>
				</div>
			</div>
		</div>
	);
}
