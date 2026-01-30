import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

interface SuccessNotificationProps {
	message: string;
	isExiting: boolean;
}

export function SuccessNotification({
	message,
	isExiting,
}: SuccessNotificationProps) {
	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0, scale: 0.8 }}
				animate={{
					opacity: isExiting ? 0 : 1,
					scale: isExiting ? 0.8 : 1,
				}}
				exit={{ opacity: 0, scale: 0.8 }}
				transition={{
					duration: 0.3,
					ease: "easeOut",
				}}
				className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
			>
				<div className="flex flex-col items-center gap-8 rounded-3xl bg-card p-16 shadow-2xl">
					<motion.div
						initial={{ scale: 0 }}
						animate={{ scale: 1 }}
						transition={{
							delay: 0.1,
							type: "spring",
							stiffness: 200,
							damping: 15,
						}}
					>
						<CheckCircle
							className="h-32 w-32 text-green-500"
							strokeWidth={1.5}
						/>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
						className="text-center"
					>
						<p className="text-5xl font-bold text-foreground">{message}</p>
					</motion.div>
				</div>
			</motion.div>
		</AnimatePresence>
	);
}
