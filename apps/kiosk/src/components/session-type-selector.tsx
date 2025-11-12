import { Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
		<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md">
			<div className="w-full max-w-4xl mx-4 space-y-6 animate-in fade-in zoom-in-95 duration-300">
				<div className="text-center space-y-2">
					<h2 className="text-4xl font-bold">Welcome, {userName}!</h2>
					<p className="text-xl text-muted-foreground">
						Select your session type
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<Card
						className="border-4 hover:border-orange-500 transition-all cursor-pointer group"
						onClick={() => onSelectType("regular")}
					>
						<CardContent className="flex flex-col items-center gap-6 py-12">
							<div className="relative">
								<Clock className="h-24 w-24 text-orange-500 group-hover:scale-110 transition-transform" />
							</div>
							<div className="text-center space-y-2">
								<h3 className="text-3xl font-bold text-orange-500">Regular</h3>
								<p className="text-lg text-muted-foreground">
									Session for utilizing the space
								</p>
							</div>
						</CardContent>
					</Card>

					<Card
						className="border-4 hover:border-purple-500 transition-all cursor-pointer group"
						onClick={() => onSelectType("staffing")}
					>
						<CardContent className="flex flex-col items-center gap-6 py-12">
							<div className="relative">
								<Users className="h-24 w-24 text-purple-500 group-hover:scale-110 transition-transform" />
							</div>
							<div className="text-center space-y-2">
								<h3 className="text-3xl font-bold text-purple-500">Staffing</h3>
								<p className="text-lg text-muted-foreground">
									Session for staffing a shift
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
