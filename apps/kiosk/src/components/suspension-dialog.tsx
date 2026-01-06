import { format } from "date-fns";
import { BanIcon } from "lucide-react";
import { motion } from "motion/react";

interface SuspensionDialogProps {
	userName: string;
	endDate: Date;
	isExiting: boolean;
}

export function SuspensionDialog({
	userName,
	endDate,
	isExiting,
}: SuspensionDialogProps) {
	const formattedEndDate = format(endDate, "MMMM d, yyyy 'at' h:mm a");

	return (
		<motion.div
			className="absolute inset-0 z-50 p-8 flex items-center justify-center bg-black/95 backdrop-blur-md"
			initial={{ opacity: 0 }}
			animate={{ opacity: isExiting ? 0 : 1 }}
			transition={{ duration: 0.3 }}
		>
			<motion.div
				className="p-4 max-w-3xl mx-auto"
				initial={{ opacity: 0, scale: 0.95, y: 16 }}
				animate={{
					opacity: isExiting ? 0 : 1,
					scale: isExiting ? 0.95 : 1,
					y: isExiting ? 16 : 0,
				}}
				transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
			>
				<div className="border-destructive border-4 shadow-2xl transition-colors duration-300 p-8 bg-background rounded-lg">
					<div className="flex flex-col items-center gap-8">
						<div className="relative flex items-center justify-center">
							<motion.div
								initial={{ scale: 0.85, opacity: 0 }}
								animate={{
									scale: isExiting ? 0.85 : 1,
									opacity: isExiting ? 0 : 1,
								}}
								transition={{ duration: 0.6, ease: "easeOut" }}
							>
								<BanIcon className="w-32 h-32 text-destructive" />
							</motion.div>
							<motion.div
								className="absolute inset-0"
								initial={{ scale: 0.9, opacity: 0.4 }}
								animate={
									isExiting
										? { scale: 0.9, opacity: 0 }
										: { scale: [0.9, 1.4], opacity: [0.4, 0] }
								}
								transition={
									isExiting
										? { duration: 0.3, ease: "easeInOut" }
										: { duration: 1.2, repeat: Infinity, ease: "easeOut" }
								}
							>
								<BanIcon className="w-32 h-32 text-destructive opacity-40" />
							</motion.div>
						</div>

						<motion.div
							className="text-center gap-4 flex flex-col"
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: isExiting ? 0 : 1, y: isExiting ? 12 : 0 }}
							transition={{ duration: 0.5, delay: 0.2 }}
						>
							<h2 className="text-5xl font-bold text-destructive">
								ACCESS SUSPENDED
							</h2>
							<p className="text-3xl font-semibold">
								{userName}, you are not permitted to enter.
							</p>
							<div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mt-2">
								<p className="text-xl text-muted-foreground">
									Your suspension ends on:
								</p>
								<p className="text-2xl font-medium mt-1">{formattedEndDate}</p>
							</div>
						</motion.div>
					</div>
				</div>
			</motion.div>
		</motion.div>
	);
}
