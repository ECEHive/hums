/**
 * Face ID Confirmation Dialog
 * Shows when a face is recognized and asks if the user wants to tap in/out
 */

import { ScanFace } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";

/**
 * Transform raw confidence (0-1) to a more user-friendly "artificial" confidence
 * This makes the displayed confidence feel more natural - low scores appear higher
 * Uses a logarithmic-style curve: 0→0%, 0.4→80%, 0.6→92%, 0.8→98%, 1→100%
 */
function getDisplayConfidence(rawConfidence: number): number {
	if (rawConfidence <= 0) return 0;
	if (rawConfidence >= 1) return 1;

	// Use a power curve that boosts lower values significantly
	// confidence^0.3 gives us: 0.4→0.74, 0.5→0.79, 0.6→0.84, 0.7→0.89, 0.8→0.93
	// Then we scale to make it feel even more confident
	const boosted = rawConfidence ** 0.25;

	// Scale so minimum useful confidence (0.4) shows as ~80%
	// and max (1.0) shows as 100%
	return Math.min(1, boosted * 0.95 + 0.05);
}

interface FaceIdConfirmationProps {
	/** User's name */
	userName: string;
	/** Whether user is currently tapped in */
	isTappedIn: boolean;
	/** Confidence level (0-1) */
	confidence: number;
	/** Time remaining before auto-dismiss (seconds) */
	timeoutSeconds?: number;
	/** Callback when user confirms */
	onConfirm: () => void;
	/** Callback when user cancels or timeout */
	onCancel: () => void;
}

export function FaceIdConfirmation({
	userName,
	confidence,
	timeoutSeconds = 5,
	onConfirm,
	onCancel,
}: FaceIdConfirmationProps) {
	const [remainingTime, setRemainingTime] = useState(timeoutSeconds);
	const onCancelRef = useRef(onCancel);

	// Keep ref up to date
	useEffect(() => {
		onCancelRef.current = onCancel;
	}, [onCancel]);

	// Countdown timer - using ref to avoid stale closure
	useEffect(() => {
		const interval = setInterval(() => {
			setRemainingTime((prev) => {
				if (prev <= 1) {
					// Use ref to get latest onCancel
					onCancelRef.current();
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(interval);
	}, []);

	// Handle keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				onConfirm();
			} else if (e.key === "Escape") {
				e.preventDefault();
				onCancel();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onConfirm, onCancel]);

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
			>
				<motion.div
					initial={{ scale: 0.9, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					exit={{ scale: 0.9, opacity: 0 }}
					className="bg-card rounded-2xl p-8 max-w-md text-center shadow-2xl"
				>
					{/* Face icon */}
					<div className="mb-4 flex justify-center">
						<ScanFace className="w-16 h-16 text-green-500" />
					</div>

					{/* Greeting */}
					<h2 className="text-3xl font-bold mb-2">Hello, {userName}!</h2>

					{/* Confidence indicator - uses artificial/boosted confidence for display */}
					{(() => {
						const displayConf = getDisplayConfidence(confidence);
						return (
							<div className="mb-6">
								<div className="text-sm text-muted-foreground mb-1">
									Match confidence: {Math.round(displayConf * 100)}%
								</div>
								<div className="h-2 bg-muted rounded-full overflow-hidden">
									<motion.div
										className="h-full bg-green-500"
										initial={{ width: 0 }}
										animate={{ width: `${displayConf * 100}%` }}
									/>
								</div>
							</div>
						);
					})()}

					{/* Action buttons */}
					<div className="flex gap-4 justify-center mb-4">
						<Button
							variant="outline"
							size="lg"
							onClick={onCancel}
							className="min-w-[120px]"
						>
							Not Me
						</Button>
						<Button size="lg" onClick={onConfirm} className="min-w-[120px]">
							Yes, continue
						</Button>
					</div>

					{/* Timeout indicator */}
					<div className="text-sm text-muted-foreground">
						Auto-dismissing in {remainingTime}s
					</div>

					{/* Progress bar for timeout */}
					<div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
						<motion.div
							className="h-full bg-muted-foreground"
							initial={{ width: "100%" }}
							animate={{ width: "0%" }}
							transition={{ duration: timeoutSeconds, ease: "linear" }}
						/>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}

export { FaceIdConfirmation as default };
