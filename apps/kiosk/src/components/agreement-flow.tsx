import { trpc } from "@ecehive/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatLog, getLogger } from "@/lib/logging";
import { Button } from "./ui/button";

const log = getLogger("agreement-flow");

interface Agreement {
	id: number;
	title: string;
	content: string;
	confirmationText: string;
}

interface AgreementFlowProps {
	agreements: Agreement[];
	userName: string;
	cardNumber: string;
	onComplete: () => void;
	onCancel: () => void;
	onError?: (message: string) => void;
	onAgreementProgress?: () => void;
}

export function AgreementFlow({
	agreements,
	userName,
	cardNumber,
	onComplete,
	onCancel,
	onError,
	onAgreementProgress,
}: AgreementFlowProps) {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isProcessing, setIsProcessing] = useState(false);
	const [countdown, setCountdown] = useState(3);
	const [isCountdownComplete, setIsCountdownComplete] = useState(false);

	const currentAgreement = agreements[currentIndex];
	const isLastAgreement = currentIndex === agreements.length - 1;

	// Countdown timer effect
	useEffect(() => {
		if (countdown > 0) {
			const timer = setTimeout(() => {
				setCountdown(countdown - 1);
			}, 1000);
			return () => clearTimeout(timer);
		}
		setIsCountdownComplete(true);
	}, [countdown]);

	// Reset countdown when changing agreements
	useEffect(() => {
		setCountdown(3);
		setIsCountdownComplete(false);
	}, [currentIndex]);

	const agreeMutation = useMutation({
		mutationFn: (agreementId: number) => {
			return trpc.agreements.kioskAgree.mutate({ cardNumber, agreementId });
		},
	});

	const handleAgree = async () => {
		setIsProcessing(true);
		try {
			await agreeMutation.mutateAsync(currentAgreement.id);

			if (isLastAgreement) {
				// All agreements completed, trigger tap-in
				onComplete();
			} else {
				// Move to next agreement
				setCurrentIndex(currentIndex + 1);
				// Reset the parent timeout for the next agreement
				onAgreementProgress?.();
			}
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to accept agreement. Please try again.";
			log.error(
				formatLog("Agreement acceptance failed", {
					agreementId: currentAgreement.id,
					agreementTitle: currentAgreement.title,
					error: message,
				}),
			);
			if (onError) {
				onError(message);
			}
			// Close the agreement flow on error
			onCancel();
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
			<div className="w-full max-w-3xl max-h-full flex flex-col">
				<div className="bg-card rounded-md border-primary shadow-2xl flex-1 flex flex-col min-h-0 p-8">
					<div className="gap-4 flex flex-col flex-1 min-h-0">
						<div className="text-center gap-2 flex flex-col ">
							<h2 className="text-3xl font-bold">Welcome, {userName}</h2>
							<p className="text-lg text-muted-foreground">
								Please review and accept the following agreement
								{agreements.length > 1 &&
									` (${currentIndex + 1} of ${agreements.length})`}
							</p>
						</div>

						<div className="gap-4 flex flex-col flex-1 min-h-0">
							<h3 className="text-2xl font-semibold text-center">
								{currentAgreement.title}
							</h3>

							<div className="flex-1 w-full rounded-md p-4 bg-muted/30 overflow-y-auto min-h-0">
								<div className="whitespace-pre-wrap text-base">
									{currentAgreement.content}
								</div>
							</div>
						</div>

						<div className="flex gap-4 justify-center">
							<Button
								variant="outline"
								onClick={onCancel}
								disabled={isProcessing}
								size="lg"
							>
								<X />
								Cancel
							</Button>
							<Button
								onClick={handleAgree}
								disabled={isProcessing || !isCountdownComplete}
								size="lg"
							>
								<Check />
								{isCountdownComplete
									? currentAgreement.confirmationText
									: `${currentAgreement.confirmationText} (${countdown})`}
							</Button>
						</div>
						{agreements.length > 1 && (
							<div className="flex justify-center gap-2">
								{agreements.map((_, idx) => (
									<div
										key={idx}
										className="rounded-xl"
										style={{
											backgroundColor:
												idx === currentIndex
													? "hsl(var(--primary))"
													: idx < currentIndex
														? "hsl(var(--primary) / 0.5)"
														: "hsl(var(--muted))",
										}}
									/>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
