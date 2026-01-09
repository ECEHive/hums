import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AlertCircle, CheckCircle, LogIn, LogOut } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/shared/logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/ota-session-login")({
	component: OneTimeLogin,
});

function OneTimeLogin() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const checkboxId = useId();
	const [currentSessionType, setCurrentSessionType] = useState<
		"regular" | "staffing" | null
	>(null);
	const [actionCompleted, setActionCompleted] = useState(false);
	const [hasStaffingPermission, setHasStaffingPermission] = useState(false);
	const [selectedAgreement, setSelectedAgreement] = useState<{
		id: number;
		title: string;
		content: string;
		confirmationText: string;
	} | null>(null);
	const [agreed, setAgreed] = useState(false);

	// Check if user has staffing permission from their current permissions
	const userHasStaffingPermission =
		user?.isSystemUser ||
		user?.permissions?.includes("sessions.staffing") ||
		false;

	// Get code from URL params
	const searchParams = new URLSearchParams(window.location.search);
	const code = searchParams.get("code");

	// Fetch all enabled agreements
	const { data: allAgreements, isLoading: isLoadingAgreements } = useQuery({
		queryKey: ["agreementsAll"],
		queryFn: async () => {
			return await trpc.agreements.listAll.query({ onlyEnabled: true });
		},
		enabled: !!user,
	});

	// Fetch agreement status
	const { data: agreementStatus, refetch: refetchAgreementStatus } = useQuery({
		queryKey: ["agreementsStatus"],
		queryFn: async () => {
			return await trpc.agreements.getStatus.query({});
		},
		enabled: !!user,
	});

	// Fetch current session status
	const { data: sessionStats, isLoading: isLoadingSession } = useQuery({
		queryKey: ["mySessionStats"],
		queryFn: async () => {
			return trpc.sessions.myStats.query({});
		},
		enabled: !!user,
	});

	useEffect(() => {
		if (sessionStats) {
			if (sessionStats.currentlyActive) {
				setCurrentSessionType(sessionStats.activeSessionType);
			} else {
				setCurrentSessionType(null);
			}
		}
	}, [sessionStats]);

	// Agreement mutation
	const agreeMutation = useMutation({
		mutationFn: (agreementId: number) => {
			return trpc.agreements.agree.mutate({ agreementId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agreementsStatus"] });
			refetchAgreementStatus();
			setSelectedAgreement(null);
			setAgreed(false);
		},
	});

	const useCodeMutation = useMutation({
		mutationFn: async (action: "login" | "logout") => {
			if (!code) throw new Error("No code provided");
			return trpc.oneTimeLoginCodes.use.mutate({ code, action });
		},
		onSuccess: (data) => {
			setActionCompleted(true);
			setHasStaffingPermission(data.hasStaffingPermission);
			// Redirect after showing success message
			setTimeout(() => {
				router.navigate({ to: "/app" });
			}, 3000);
		},
		onError: (error: Error & { data?: { code?: string } }) => {
			// Check if error is due to missing agreements
			if (error?.data?.code === "PRECONDITION_FAILED") {
				// Refetch agreement status to show which agreements are missing
				refetchAgreementStatus();
			}
		},
	});

	// Helper to open agreement dialog
	const handleOpenAgreementDialog = (agreement: {
		id: number;
		title: string;
		content: string;
		confirmationText: string;
	}) => {
		setSelectedAgreement(agreement);
		setAgreed(false);
	};

	// Helper to agree to an agreement
	const handleAgreeToAgreement = async () => {
		if (!selectedAgreement || !agreed) return;
		await agreeMutation.mutateAsync(selectedAgreement.id);
	};

	// Compute missing agreements
	const agreedIds = new Set(
		agreementStatus?.userAgreements.map((ua) => ua.agreementId) || [],
	);
	const missingAgreements =
		allAgreements?.agreements.filter((a) => !agreedIds.has(a.id)) || [];
	const hasAllAgreements = missingAgreements.length === 0;

	// Redirect to login if not authenticated
	if (!user) {
		const redirectUrl = `/login?redirect=${encodeURIComponent(
			window.location.pathname + window.location.search,
		)}`;
		window.location.href = redirectUrl;
		return null;
	}

	if (!code) {
		return (
			<div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
				<Card className="w-full max-w-md">
					<CardHeader>
						<div className="flex items-center justify-center mb-4">
							<Logo className="h-8" />
						</div>
						<CardTitle className="text-center">Invalid Request</CardTitle>
					</CardHeader>
					<CardContent className="text-center space-y-4">
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								No one-time login code provided. Please scan a valid QR code
								from the kiosk.
							</AlertDescription>
						</Alert>
						<Button
							onClick={() => router.navigate({ to: "/app" })}
							className="w-full"
						>
							Go to Dashboard
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (actionCompleted) {
		return (
			<div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
				<Card className="w-full max-w-md">
					<CardHeader>
						<div className="flex items-center justify-center mb-4">
							<Logo className="h-8" />
						</div>
						<CardTitle className="text-center">Success!</CardTitle>
					</CardHeader>
					<CardContent className="text-center space-y-4">
						<Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
							<CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
							<AlertDescription className="text-green-800 dark:text-green-200">
								{useCodeMutation.data?.action === "login"
									? "You have successfully started your session!"
									: "You have successfully ended your session!"}
							</AlertDescription>
						</Alert>

						{hasStaffingPermission && (
							<Alert>
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>
									If you need to start or end a staffing session, please contact
									a staff member.
								</AlertDescription>
							</Alert>
						)}

						<div className="flex flex-col items-center gap-2">
							<p className="text-sm text-muted-foreground">
								Redirecting you to the dashboard...
							</p>
							<Spinner />
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (isLoadingSession || isLoadingAgreements) {
		return (
			<div className="min-h-screen w-full flex items-center justify-center bg-background">
				<Spinner />
			</div>
		);
	}

	const isInSession = currentSessionType !== null;
	const action = isInSession ? "logout" : "login";
	const isStaffingSession = currentSessionType === "staffing";

	// Show error if trying to end a staffing session
	if (isStaffingSession) {
		return (
			<div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
				<Card className="w-full max-w-md">
					<CardHeader>
						<div className="flex items-center justify-center mb-4">
							<Logo className="h-8" />
						</div>
						<CardTitle className="text-center">
							Cannot End Staffing Session
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								You are currently in a staffing session. Staffing sessions
								cannot be ended using this method. Please use a kiosk or contact
								a staff member.
							</AlertDescription>
						</Alert>
						<Button
							onClick={() => router.navigate({ to: "/app" })}
							className="w-full"
						>
							Go to Dashboard
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<div className="flex items-center justify-center mb-4">
						<Logo className="h-8" />
					</div>
					<CardTitle className="text-center">
						{isInSession ? "End Your Session" : "Start Your Session"}
					</CardTitle>
					<CardDescription className="text-center">
						{isInSession
							? `You are currently in a ${currentSessionType} session`
							: "You are not currently in a session"}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{useCodeMutation.error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								{useCodeMutation.error.message ||
									"Failed to process your request. The code may have expired or already been used."}
							</AlertDescription>
						</Alert>
					)}

					{/* Show warning if user has missing agreements and trying to log in */}
					{!isInSession && !hasAllAgreements && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								You must agree to all required agreements before starting a
								session. Please review and accept the agreements below.
							</AlertDescription>
						</Alert>
					)}

					{/* Show list of missing agreements if any */}
					{!isInSession && missingAgreements.length > 0 && (
						<div className="space-y-2">
							<p className="text-sm font-medium">Required Agreements:</p>
							<div className="space-y-2">
								{missingAgreements.map((agreement) => (
									<Card key={agreement.id} className="p-3">
										<div className="flex items-center justify-between">
											<div>
												<p className="font-medium text-sm">{agreement.title}</p>
												<p className="text-xs text-muted-foreground">
													Action required
												</p>
											</div>
											<Button
												size="sm"
												onClick={() => handleOpenAgreementDialog(agreement)}
											>
												Review & Accept
											</Button>
										</div>
									</Card>
								))}
							</div>
						</div>
					)}

					<Button
						onClick={() => useCodeMutation.mutate(action)}
						disabled={
							useCodeMutation.isPending || (!isInSession && !hasAllAgreements)
						}
						className="w-full"
						size="lg"
					>
						{useCodeMutation.isPending ? (
							<Spinner className="mr-2" />
						) : isInSession ? (
							<LogOut className="mr-2 h-5 w-5" />
						) : (
							<LogIn className="mr-2 h-5 w-5" />
						)}
						{isInSession ? "End Session" : "Start Session"}
					</Button>

					{userHasStaffingPermission && (
						<Alert>
							<AlertCircle className="h-4 w-4" />
							<AlertDescription className="text-sm">
								<p>
									This action will only start or end a{" "}
									<strong>general session</strong>. If you need to start or end
									a staffing session, please contact a staff member at the
									kiosk.
								</p>
							</AlertDescription>
						</Alert>
					)}

					<div className="text-center">
						<Button
							variant="ghost"
							onClick={() => router.navigate({ to: "/app" })}
							disabled={useCodeMutation.isPending}
						>
							Cancel
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Agreement Dialog */}
			<Dialog
				open={!!selectedAgreement}
				onOpenChange={(open) => {
					if (!open) {
						setSelectedAgreement(null);
						setAgreed(false);
					}
				}}
			>
				<DialogContent className="sm:max-w-[600px]">
					<DialogHeader>
						<DialogTitle>{selectedAgreement?.title}</DialogTitle>
						<DialogDescription>
							Please review and accept this agreement to continue
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="max-h-[400px] overflow-y-auto border rounded-md p-4 bg-muted/30">
							<div className="whitespace-pre-wrap text-sm">
								{selectedAgreement?.content}
							</div>
						</div>
						<div className="flex items-center space-x-2">
							<Checkbox
								id={checkboxId}
								checked={agreed}
								onCheckedChange={(e) => setAgreed(!!e)}
							/>
							<Label
								htmlFor={checkboxId}
								className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
							>
								{selectedAgreement?.confirmationText || "I agree"}
							</Label>
						</div>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							onClick={handleAgreeToAgreement}
							disabled={!agreed || agreeMutation.isPending}
						>
							{agreeMutation.isPending ? <Spinner /> : "Accept"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
