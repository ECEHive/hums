import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	CheckCircleIcon,
	DoorOpenIcon,
	HomeIcon,
	Loader2Icon,
	LockIcon,
	PowerIcon,
	PowerOffIcon,
	ToggleLeftIcon,
	XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/control/$pointId")({
	component: ControlPage,
});

function ControlPage(): JSX.Element {
	const { pointId } = Route.useParams();
	const { user, status } = useAuth();
	const navigate = useNavigate();
	const [operationResult, setOperationResult] = useState<{
		success: boolean;
		message: string;
	} | null>(null);

	// Fetch the control point
	const {
		data: point,
		isLoading: pointLoading,
		error: pointError,
		refetch,
	} = useQuery({
		queryKey: ["control", "point", pointId],
		queryFn: async () => await trpc.control.points.get.query({ id: pointId }),
		enabled: status === "authenticated" && !!pointId,
		retry: false,
	});

	// Operate mutation
	const [lastAction, setLastAction] = useState<string>("");
	const operateMutation = useMutation({
		mutationFn: async (action: "TURN_ON" | "TURN_OFF" | "UNLOCK") => {
			setLastAction(action);
			return await trpc.control.points.operate.mutate({ id: pointId, action });
		},
		onSuccess: (result) => {
			setOperationResult({
				success: result.success,
				message: getSuccessMessage(lastAction),
			});
			refetch();
		},
		onError: (error) => {
			setOperationResult({
				success: false,
				message: error.message || "Operation failed",
			});
		},
	});

	// If not authenticated, redirect to login with return URL
	if (status === "unauthenticated") {
		const returnTo = encodeURIComponent(`/control/${pointId}`);
		navigate({ to: `/login?redirect=${returnTo}` });
		return (
			<FullScreenWrapper>
				<Spinner className="h-8 w-8" />
				<p className="text-muted-foreground mt-4">Redirecting to login...</p>
			</FullScreenWrapper>
		);
	}

	// Loading state
	if (status === "loading" || pointLoading) {
		return (
			<FullScreenWrapper>
				<Spinner className="h-8 w-8" />
				<p className="text-muted-foreground mt-4">Loading...</p>
			</FullScreenWrapper>
		);
	}

	// Error state - point not found or access denied
	if (pointError || !point) {
		const errorMessage =
			pointError?.message || "Control point not found or access denied";
		return (
			<FullScreenWrapper>
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<XCircleIcon className="h-12 w-12 text-destructive mx-auto mb-2" />
						<CardTitle>Access Denied</CardTitle>
						<CardDescription>{errorMessage}</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild className="w-full">
							<Link to="/app">Return to HUMS</Link>
						</Button>
					</CardContent>
				</Card>
			</FullScreenWrapper>
		);
	}

	// Check if code control is enabled
	if (!point.canControlWithCode) {
		return (
			<FullScreenWrapper>
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<LockIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
						<CardTitle>QR Control Disabled</CardTitle>
						<CardDescription>
							This control point is not enabled for QR code access.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild className="w-full">
							<Link to="/app/control/points">View All Control Points</Link>
						</Button>
					</CardContent>
				</Card>
			</FullScreenWrapper>
		);
	}

	const isDoor = point.controlClass === "DOOR";
	const isOn = point.currentState;

	return (
		<FullScreenWrapper>
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<div className="flex justify-center mb-4">
						{isDoor ? (
							<DoorOpenIcon className="h-16 w-16 text-primary" />
						) : (
							<ToggleLeftIcon className="h-16 w-16 text-primary" />
						)}
					</div>
					<CardTitle className="text-2xl">{point.name}</CardTitle>
					{point.location && (
						<CardDescription className="text-lg">
							{point.location}
						</CardDescription>
					)}
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Current Status */}
					{!isDoor && (
						<div className="flex items-center justify-center gap-3 py-4 bg-muted rounded-lg">
							{isOn ? (
								<>
									<PowerIcon className="h-8 w-8 text-green-500" />
									<span className="text-xl font-semibold text-green-600">
										Currently ON
									</span>
								</>
							) : (
								<>
									<PowerOffIcon className="h-8 w-8 text-muted-foreground" />
									<span className="text-xl font-semibold text-muted-foreground">
										Currently OFF
									</span>
								</>
							)}
						</div>
					)}

					{/* Operation Result Feedback */}
					{operationResult && (
						<div
							className={`flex items-center gap-2 p-4 rounded-lg ${
								operationResult.success
									? "bg-green-50 text-green-800 border border-green-200"
									: "bg-red-50 text-red-800 border border-red-200"
							}`}
						>
							{operationResult.success ? (
								<CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
							) : (
								<XCircleIcon className="h-5 w-5 flex-shrink-0" />
							)}
							<span>{operationResult.message}</span>
						</div>
					)}

					{/* Action Buttons */}
					<div className="space-y-3">
						{isDoor ? (
							<Button
								size="lg"
								className="w-full h-16 text-xl"
								onClick={() => {
									setOperationResult(null);
									operateMutation.mutate("UNLOCK");
								}}
								disabled={operateMutation.isPending}
							>
								{operateMutation.isPending ? (
									<Loader2Icon className="h-6 w-6 animate-spin mr-2" />
								) : (
									<DoorOpenIcon className="h-6 w-6 mr-2" />
								)}
								Unlock Door
							</Button>
						) : isOn ? (
							<Button
								size="lg"
								variant="destructive"
								className="w-full h-16 text-xl"
								onClick={() => {
									setOperationResult(null);
									operateMutation.mutate("TURN_OFF");
								}}
								disabled={operateMutation.isPending}
							>
								{operateMutation.isPending ? (
									<Loader2Icon className="h-6 w-6 animate-spin mr-2" />
								) : (
									<PowerOffIcon className="h-6 w-6 mr-2" />
								)}
								Turn Off
							</Button>
						) : (
							<Button
								size="lg"
								className="w-full h-16 text-xl bg-green-600 hover:bg-green-700"
								onClick={() => {
									setOperationResult(null);
									operateMutation.mutate("TURN_ON");
								}}
								disabled={operateMutation.isPending}
							>
								{operateMutation.isPending ? (
									<Loader2Icon className="h-6 w-6 animate-spin mr-2" />
								) : (
									<PowerIcon className="h-6 w-6 mr-2" />
								)}
								Turn On
							</Button>
						)}
					</div>

					{/* Logged in as */}
					<div className="text-center text-sm text-muted-foreground">
						Logged in as <span className="font-medium">{user?.name}</span>
					</div>

					{/* Return to HUMS button */}
					<Button variant="outline" asChild className="w-full">
						<Link to="/app">
							<HomeIcon className="h-4 w-4 mr-2" />
							Return to HUMS
						</Link>
					</Button>
				</CardContent>
			</Card>
		</FullScreenWrapper>
	);
}

function FullScreenWrapper({
	children,
}: {
	children: React.ReactNode;
}): JSX.Element {
	return (
		<div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
			<div className="mb-8">
				<Logo className="h-20 w-auto" />
			</div>
			{children}
		</div>
	);
}

function getSuccessMessage(action: string): string {
	switch (action) {
		case "TURN_ON":
			return "Equipment turned on successfully";
		case "TURN_OFF":
			return "Equipment turned off successfully";
		case "UNLOCK":
			return "Door unlocked successfully";
		default:
			return "Operation completed successfully";
	}
}
