import { AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./ui/button";

interface EarlyLeaveConfirmationProps {
	userName: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export function EarlyLeaveConfirmation({
	userName,
	onConfirm,
	onCancel,
}: EarlyLeaveConfirmationProps) {
	return (
		<motion.div
			className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.3 }}
		>
			<motion.div
				className="max-w-3xl mx-auto gap-8 flex flex-col"
				initial={{ opacity: 0, scale: 0.95, y: 16 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.95, y: 16 }}
				transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
			>
				<motion.div
					className="flex flex-col items-center gap-6"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1, duration: 0.35 }}
				>
					<motion.div
						className="relative flex items-center justify-center"
						initial={{ scale: 0.85, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ duration: 0.6, ease: "easeOut" }}
					>
						<AlertTriangle className="w-24 h-24 text-yellow-500" />
					</motion.div>

					<div className="text-center gap-4 flex flex-col">
						<h2 className="text-5xl font-bold">{userName}</h2>
						<p className="text-2xl text-muted-foreground max-w-xl">
							You recently started a session. Are you sure you want to leave so
							soon?
						</p>
					</div>
				</motion.div>

				<motion.div
					className="flex justify-center gap-6"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2, duration: 0.35 }}
				>
					<Button
						variant="outline"
						className="text-xl px-8 py-6 h-auto"
						onClick={onCancel}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						className="text-xl px-8 py-6 h-auto"
						onClick={onConfirm}
					>
						Yes, Leave
					</Button>
				</motion.div>
			</motion.div>
		</motion.div>
	);
}
