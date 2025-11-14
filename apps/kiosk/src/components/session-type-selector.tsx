import { Clock, Users } from "lucide-react";
import { KioskButton, KioskCard } from "@/components/kiosk-ui";

interface SessionTypeSelectorProps {
	userName: string;
	onSelectType: (type: "regular" | "staffing") => void;
	onCancel: () => void;
}

export function SessionTypeSelector({
	userName,
	onSelectType,
	onCancel,
}: SessionTypeSelectorProps) {
	return (
		<div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
			<div
				className="kiosk-max-w-4xl mx-auto kiosk-gap-6 flex flex-col animate-in fade-in zoom-in-95 duration-300"
				style={{ padding: "calc(1rem * var(--kiosk-scale))" }}
			>
				<div className="text-center kiosk-gap-2 flex flex-col">
					<h2 className="kiosk-text-5xl font-bold">Welcome, {userName}!</h2>
					<p className="kiosk-text-2xl text-muted-foreground">
						Select your session type
					</p>
				</div>

				<div className="grid grid-cols-2 kiosk-gap-6">
					<KioskCard
						className="hover:border-orange-500 transition-all group"
						style={{
							borderWidth: "calc(4px * var(--kiosk-scale))",
							padding: "calc(3rem * var(--kiosk-scale))",
						}}
						onClick={() => onSelectType("regular")}
					>
						<div className="flex flex-col items-center kiosk-gap-6">
							<div className="relative">
								<Clock className="kiosk-icon-2xl text-orange-500 group-hover:scale-110 transition-transform" />
							</div>
							<div className="text-center kiosk-gap-2 flex flex-col">
								<h3 className="kiosk-text-4xl font-bold text-orange-500">
									Regular
								</h3>
								<p className="kiosk-text-xl text-muted-foreground">
									Session for utilizing the space
								</p>
							</div>
						</div>
					</KioskCard>

					<KioskCard
						className="hover:border-purple-500 transition-all group"
						style={{
							borderWidth: "calc(4px * var(--kiosk-scale))",
							padding: "calc(3rem * var(--kiosk-scale))",
						}}
						onClick={() => onSelectType("staffing")}
					>
						<div className="flex flex-col items-center kiosk-gap-6">
							<div className="relative">
								<Users className="kiosk-icon-2xl text-purple-500 group-hover:scale-110 transition-transform" />
							</div>
							<div className="text-center kiosk-gap-2 flex flex-col">
								<h3 className="kiosk-text-4xl font-bold text-purple-500">
									Staffing
								</h3>
								<p className="kiosk-text-xl text-muted-foreground">
									Session for staffing a shift
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
