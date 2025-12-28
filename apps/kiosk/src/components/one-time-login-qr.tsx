import { QrCode } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import QRCodeLib from "qrcode";
import { useEffect, useRef, useState } from "react";
import { KioskCard } from "@/components/kiosk-ui";
import { Button } from "@/components/ui/button";

interface OneTimeLoginQRProps {
	code: string | null;
	clientUrl: string;
	expiresAt: Date | null;
	onShow: () => void;
	onHide: () => void;
}

const AUTO_CLOSE_SECONDS = 15;

export function OneTimeLoginQR({
	code,
	clientUrl,
	expiresAt,
	onShow,
	onHide,
}: OneTimeLoginQRProps) {
	// Construct the full URL with the code as a query parameter
	const loginUrl = code ? `${clientUrl}/ota-session-login?code=${code}` : "";

	const [isVisible, setIsVisible] = useState(false);
	const [secondsRemaining, setSecondsRemaining] = useState(0);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// Generate QR code when code is available and visible
	useEffect(() => {
		if (canvasRef.current && loginUrl && isVisible) {
			QRCodeLib.toCanvas(
				canvasRef.current,
				loginUrl,
				{
					width: 200,
					margin: 2,
					errorCorrectionLevel: "H",
				},
				(error) => {
					if (error) {
						console.error("Error generating QR code:", error);
					}
				},
			);
		}
	}, [loginUrl, isVisible]);

	// Timer countdown
	useEffect(() => {
		if (!expiresAt || !isVisible) return;

		const updateTimer = () => {
			const now = Date.now();
			const expiresAtMs = new Date(expiresAt).getTime();
			const remaining = Math.max(0, Math.floor((expiresAtMs - now) / 1000));
			setSecondsRemaining(remaining);

			// Auto-close when expired
			if (remaining === 0) {
				setIsVisible(false);
				onHide();
			}
		};

		// Update immediately
		updateTimer();

		// Update every second
		const interval = setInterval(updateTimer, 1000);

		return () => clearInterval(interval);
	}, [expiresAt, isVisible, onHide]);

	// Auto-close after 15 seconds
	useEffect(() => {
		if (!isVisible) return;

		const timeout = setTimeout(() => {
			setIsVisible(false);
			onHide();
		}, AUTO_CLOSE_SECONDS * 1000);

		return () => clearTimeout(timeout);
	}, [isVisible, onHide]);

	// Show QR when code is generated
	useEffect(() => {
		if (code && !isVisible) {
			setIsVisible(true);
		}
	}, [code, isVisible]);

	// Copy to clipboard on click (debug feature)
	const handleQRClick = () => {
		navigator.clipboard.writeText(loginUrl).catch(() => {
			// Silently fail
		});
	};

	const handleButtonClick = () => {
		if (isVisible) {
			setIsVisible(false);
			onHide();
		} else {
			setIsVisible(true);
			onShow();
		}
	};

	const minutesRemaining = Math.floor(secondsRemaining / 60);
	const secondsDisplay = secondsRemaining % 60;

	return (
		<div className="fixed bottom-8 right-8 z-40 flex flex-col items-end gap-4">
			<AnimatePresence>
				{isVisible && code && (
					<motion.div
						initial={{ opacity: 0, scale: 0.9, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.9, y: 20 }}
						transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
					>
						<KioskCard className="p-6">
							<div className="flex flex-col items-center gap-4">
								<div className="flex items-center w-full">
									<h3 className="text-xl font-bold">Scan QR Code</h3>
								</div>

								<button
									type="button"
									className="bg-white p-4 rounded-lg cursor-pointer"
									onClick={handleQRClick}
								>
									<canvas ref={canvasRef} />
								</button>

								<div className="text-center space-y-1">
									<p className="text-sm text-muted-foreground">
										Expires in{" "}
										<span className="font-semibold text-foreground">
											{minutesRemaining}:
											{secondsDisplay.toString().padStart(2, "0")}
										</span>
									</p>
									<p className="text-sm text-muted-foreground">
										This code can only be used once.
									</p>
								</div>
							</div>
						</KioskCard>
					</motion.div>
				)}
			</AnimatePresence>

			<Button
				variant="default"
				size="lg"
				onClick={handleButtonClick}
				className="text-lg px-6 py-6 h-auto shadow-lg"
			>
				<QrCode className="w-5 h-5 mr-2" />
				{isVisible ? "Hide Code" : "Forgot your BuzzCard?"}
			</Button>
		</div>
	);
}
