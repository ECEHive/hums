import { trpc } from "@ecehive/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
}

export function AgreementFlow({
	agreements,
	userName,
	cardNumber,
	onComplete,
	onCancel,
	onError,
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
			}
		} catch (error) {
			console.error("Failed to agree:", error);
			const message =
				error instanceof Error
					? error.message
					: "Failed to accept agreement. Please try again.";
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
		<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
			<div className="w-full max-w-3xl max-h-full flex flex-col">
				<Card className="border-4 border-primary shadow-2xl flex-1 flex flex-col min-h-0">
					<CardContent className="p-6 space-y-4 flex-1 flex flex-col min-h-0">
						<div className="text-center space-y-2 flex-shrink-0">
							<h2 className="text-2xl font-bold">Welcome, {userName}!</h2>
							<p className="text-base text-muted-foreground">
								Please review and accept the following agreement
								{agreements.length > 1 &&
									` (${currentIndex + 1} of ${agreements.length})`}
							</p>
						</div>

						<div className="space-y-4 flex-1 flex flex-col min-h-0">
							<h3 className="text-xl font-semibold text-center flex-shrink-0">
								{currentAgreement.title}
							</h3>

							<div className="flex-1 w-full border rounded-md p-4 bg-muted/30 overflow-y-auto min-h-0">
								<div className="whitespace-pre-wrap text-sm">
									{currentAgreement.content}
								</div>
							</div>
						</div>

						<div className="flex gap-4 justify-center flex-shrink-0">
							<Button
								variant="outline"
								size="lg"
								onClick={onCancel}
								disabled={isProcessing}
								className="text-base px-6 py-5"
							>
								<X className="mr-2 h-5 w-5" />
								Cancel
							</Button>
							<Button
								size="lg"
								onClick={handleAgree}
								disabled={isProcessing || !isCountdownComplete}
								className="text-base px-6 py-5"
							>
								<Check className="mr-2 h-5 w-5" />
								{isCountdownComplete
									? currentAgreement.confirmationText
									: `${currentAgreement.confirmationText} (${countdown})`}
							</Button>
						</div>
						{agreements.length > 1 && (
							<div className="flex justify-center gap-2 flex-shrink-0">
								{agreements.map((_, idx) => (
									<div
										key={idx}
										className={`h-2 w-8 rounded-full transition-colors ${
											idx === currentIndex
												? "bg-primary"
												: idx < currentIndex
													? "bg-primary/50"
													: "bg-muted"
										}`}
									/>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
