import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { KioskCard } from "@/components/kiosk-ui";
import { Button } from "./ui/button";

interface SelectionOverlayOption {
	id: string;
	icon: LucideIcon;
	colorClass: string;
	borderClass: string;
	title: string;
	description: string;
	onSelect: () => void;
}

interface SelectionOverlayProps {
	header: ReactNode;
	options: SelectionOverlayOption[];
	onCancel: () => void;
}

export function SelectionOverlay({
	header,
	options,
	onCancel,
}: SelectionOverlayProps) {
	return (
		<motion.div
			className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.3 }}
		>
			<motion.div
				className=" mx-auto gap-6 flex flex-col"
				initial={{ opacity: 0, scale: 0.95, y: 16 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.95, y: 16 }}
				transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
			>
				<motion.div
					className="text-center gap-2 flex flex-col"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1, duration: 0.35 }}
				>
					{header}
				</motion.div>

				<div className="grid grid-cols-2 gap-6">
					{options.map((option, index) => {
						const Icon = option.icon;
						return (
							<motion.div
								key={option.id}
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.15 + index * 0.05, duration: 0.4 }}
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}
							>
								<KioskCard
									className={`${option.borderClass} p-8`}
									onClick={option.onSelect}
								>
									<div className="flex flex-col items-center gap-6">
										<motion.div
											className="relative"
											initial={{ scale: 0.9, opacity: 0 }}
											animate={{ scale: 1, opacity: 1 }}
											transition={{ duration: 0.4, delay: 0.2 + index * 0.05 }}
										>
											<Icon className={`w-24 h-24 ${option.colorClass}`} />
										</motion.div>
										<motion.div
											className="text-center gap-2 flex flex-col"
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{
												duration: 0.35,
												delay: 0.25 + index * 0.05,
											}}
										>
											<h3 className={`text-4xl font-bold ${option.colorClass}`}>
												{option.title}
											</h3>
											<p className="text-xl text-muted-foreground">
												{option.description}
											</p>
										</motion.div>
									</div>
								</KioskCard>
							</motion.div>
						);
					})}
				</div>

				<motion.div
					className="flex justify-center"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.25, duration: 0.35 }}
				>
					<Button variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
				</motion.div>
			</motion.div>
		</motion.div>
	);
}

export type { SelectionOverlayOption, SelectionOverlayProps };
