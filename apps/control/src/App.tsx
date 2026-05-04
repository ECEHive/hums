import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	AlertCircle,
	ArrowLeft,
	CheckCircle2,
	Clock,
	DoorOpen,
	Loader2,
	LogOut,
	RefreshCw,
	Settings,
	Usb,
	Users,
	Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import { ConfirmationDialog } from "./components/confirmation-dialog";
import { AuthenticatedHeader, IdleHeader } from "./components/kiosk-header";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { useCardReader } from "./hooks/use-card-reader";
import { useControlWorkflow } from "./hooks/use-control-workflow";
import { getLogoDataUrl, useBranding, useLogo } from "./hooks/useBranding";
import { logger } from "./lib/logging";
import type { ControlPointWithStatus } from "./types";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60,
			retry: 1,
		},
	},
});

// Auto-logout timeout in milliseconds (30 seconds)
const AUTO_LOGOUT_MS = 30000;

// Control point status card for the idle screen
function ControlPointStatusCard({
	controlPoint,
	index,
}: {
	controlPoint: ControlPointWithStatus;
	index: number;
}) {
	const Icon = controlPoint.controlClass === "DOOR" ? DoorOpen : Zap;
	const isActive = controlPoint.isActive;
	const isOn = controlPoint.currentState;

	const getStatusText = () => {
		if (!isActive) return "Disabled";
		if (controlPoint.controlClass === "DOOR") {
			return isOn ? "Unlocked" : "Locked";
		}
		return isOn ? "In Use" : "Available";
	};

	const getStatusColor = () => {
		if (!isActive) return "bg-gray-500";
		if (controlPoint.controlClass === "DOOR") {
			return isOn ? "bg-yellow-500" : "bg-green-500";
		}
		return isOn ? "bg-yellow-500" : "bg-green-500";
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: index * 0.05, duration: 0.3 }}
		>
			<Card className="p-4 bg-card shadow-sm border hover:border-primary/30 transition-colors">
				<div className="flex flex-col items-center gap-3 text-center">
					<div
						className={`p-3 rounded-full ${isOn && isActive ? "bg-yellow-500/20" : isActive ? "bg-green-500/20" : "bg-muted"}`}
					>
						<Icon
							className={`w-6 h-6 ${isOn && isActive ? "text-yellow-500" : isActive ? "text-green-500" : "text-muted-foreground"}`}
						/>
					</div>
					<div className="min-w-0 w-full">
						<h3 className="font-semibold truncate text-lg">
							{controlPoint.name}
						</h3>
						{controlPoint.location && (
							<p className="text-md text-muted-foreground truncate">
								{controlPoint.location}
							</p>
						)}
					</div>
					<div className="flex items-center gap-2">
						<motion.span
							className={`w-2 h-2 rounded-full ${getStatusColor()}`}
							animate={
								isOn && isActive
									? { scale: [1, 1.2, 1], opacity: [1, 0.8, 1] }
									: {}
							}
							transition={{ duration: 2, repeat: Infinity }}
						/>
						<span className="text-xs font-medium">{getStatusText()}</span>
					</div>
					{isOn && isActive && controlPoint.currentUserName && (
						<p className="text-xs text-muted-foreground truncate">
							{controlPoint.currentUserName}
						</p>
					)}
				</div>
			</Card>
		</motion.div>
	);
}

// Session action card for the authenticated view
interface SessionActionCardProps {
	title: string;
	description: string;
	icon: React.ReactNode;
	colorClass: string;
	onClick: () => void;
	disabled?: boolean;
}

function SessionActionCard({
	title,
	description,
	icon,
	colorClass,
	onClick,
	disabled,
}: SessionActionCardProps) {
	return (
		<motion.button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className={`w-full bg-card text-card-foreground rounded-xl shadow-sm cursor-pointer transition-all hover:scale-[1.02] p-4 md:p-6 border ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
			whileHover={!disabled ? { scale: 1.02 } : undefined}
			whileTap={!disabled ? { scale: 0.98 } : undefined}
		>
			<div className="flex flex-col items-center gap-3">
				{icon}
				<div className="text-center gap-1 flex flex-col">
					<h3 className={`text-lg md:text-xl font-bold ${colorClass}`}>
						{title}
					</h3>
					<p className="text-xs md:text-sm text-muted-foreground">
						{description}
					</p>
				</div>
			</div>
		</motion.button>
	);
}

// Control point button for the authenticated view
function ControlPointButton({
	point,
	onManage,
	onOperate,
	isOperating,
	canManage,
	disabled,
	index,
}: {
	point: ControlPointWithStatus;
	onManage: (point: ControlPointWithStatus) => void;
	onOperate: (point: ControlPointWithStatus) => void;
	isOperating: boolean;
	canManage: boolean;
	disabled: boolean;
	index: number;
}) {
	const Icon = point.controlClass === "DOOR" ? DoorOpen : Zap;
	const isOn = point.currentState;
	const actionText = point.isActive
		? point.controlClass === "DOOR"
			? "Unlock"
			: isOn
				? "Turn Off"
				: "Turn On"
		: "Disabled";

	const handleOperate = () => {
		if (disabled || !point.isActive) return;
		onOperate(point);
	};

	const handleManage = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		onManage(point);
	};

	return (
		<motion.div
			key={point.id}
			role="button"
			tabIndex={disabled ? -1 : 0}
			aria-disabled={disabled || !point.isActive}
			onClick={handleOperate}
			onKeyDown={(event) => {
				if (disabled || !point.isActive) return;
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					handleOperate();
				}
			}}
			className={`relative bg-card text-card-foreground rounded-xl shadow-sm cursor-pointer transition-all p-4 md:p-6 border ${
				isOn ? "border-green-500/50" : "border-border hover:border-primary/50"
			} ${disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02]"} ${isOperating ? "!opacity-100" : ""}`}
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ delay: index * 0.05 }}
			whileHover={!disabled ? { scale: 1.02 } : undefined}
			whileTap={!disabled ? { scale: 0.98 } : undefined}
		>
			{/* Loading overlay for operating point */}
			{isOperating && (
				<div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl z-10">
					<motion.div
						className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full"
						animate={{ rotate: 360 }}
						transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
					/>
				</div>
			)}
			{canManage && (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					disabled={disabled}
					aria-label={`Manage ${point.name}`}
					onClick={handleManage}
					className="absolute right-2 top-2 h-12 w-12"
				>
					<Settings className="size-10" />
				</Button>
			)}
			<div className="flex flex-col items-center gap-2">
				<div
					className={`p-3 rounded-full ${isOn ? "bg-green-500/20" : "bg-muted"}`}
				>
					<Icon
						className={`w-6 h-6 ${isOn ? "text-green-500" : "text-muted-foreground"}`}
					/>
				</div>
				<div className="text-center">
					<h3 className="font-semibold truncate max-w-full text-lg">
						{point.name}
					</h3>
					{point.location && (
						<p className="text-md text-muted-foreground truncate">
							{point.location}
						</p>
					)}
				</div>
				<Badge variant={point.isActive ? (isOn ? "success" : "secondary") : "destructive"} className="text-xs">
					{actionText}
				</Badge>
				{isOn && point.currentUserName && (
					<p className="text-xs text-muted-foreground truncate max-w-full">
						{point.currentUserName}
					</p>
				)}
			</div>
		</motion.div>
	);
}

function ControlKioskApp() {
	useBranding();
	const logo = useLogo("dark");

	const {
		state,
		controlPoints,
		isLoading: controlPointsLoading,
		controlLogs,
		isControlLogsLoading,
		handleCardScan,
		handleTrainingCardScan,
		operateControlPoint,
		logout,
		handleSessionAction,
		cancelConfirmation,
		confirmAction,
		selectedControlPoint,
		startManagingControlPoint,
		stopManagingControlPoint,
		toggleControlPointActive,
		isUpdatingControlPoint,
		trainingControlPoint,
		trainingStatusMessage,
		trainingStatusType,
		lastTrainedUserName,
		openTrainingDialog,
		closeTrainingDialog,
		isTrainingUser,
		controlLogsPoint,
		openControlLogsDialog,
		closeControlLogsDialog,
	} = useControlWorkflow({
		onSuccess: (message) => {
			logger.info("Control operation success:", message);
		},
		onError: (message) => {
			logger.error("Control operation error:", message);
		},
	});

	// Set up card reader
	const { connectionStatus, connect } = useCardReader({
		onScan: (cardNumber) => {
			if (trainingControlPoint) {
				handleTrainingCardScan(cardNumber);
				return;
			}
			handleCardScan(cardNumber);
		},
		onFatalError: (message) => {
			logger.error("Card reader fatal error:", message);
		},
		onInvalidScan: () => {
			logger.warn("Invalid card scan");
		},
	});

	const isConnected = connectionStatus === "connected";
	const isConnecting = connectionStatus === "connecting";
	const hasError = connectionStatus === "error";
	const isAuthenticated = state.mode === "authenticated";

	// Auto-logout timer
	const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const resetActivityTimer = useCallback(() => {
		if (activityTimeoutRef.current) {
			clearTimeout(activityTimeoutRef.current);
		}
		if (isAuthenticated) {
			activityTimeoutRef.current = setTimeout(() => {
				logger.info("Auto-logout due to inactivity");
				logout();
			}, AUTO_LOGOUT_MS);
		}
	}, [isAuthenticated, logout]);

	// Track user activity
	useEffect(() => {
		if (!isAuthenticated) {
			if (activityTimeoutRef.current) {
				clearTimeout(activityTimeoutRef.current);
			}
			return;
		}

		resetActivityTimer();

		const handleActivity = () => resetActivityTimer();
		window.addEventListener("click", handleActivity);
		window.addEventListener("keydown", handleActivity);
		window.addEventListener("touchstart", handleActivity);

		return () => {
			window.removeEventListener("click", handleActivity);
			window.removeEventListener("keydown", handleActivity);
			window.removeEventListener("touchstart", handleActivity);
			if (activityTimeoutRef.current) {
				clearTimeout(activityTimeoutRef.current);
			}
		};
	}, [isAuthenticated, resetActivityTimer]);

	// Loading state
	if (controlPointsLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<motion.div
					className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full"
					animate={{ rotate: 360 }}
					transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
				/>
			</div>
		);
	}

	// Setup view - need to connect card reader
	if (!isConnected) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="max-w-lg mx-auto">
					<Card
						className={`shadow-xl p-8 ${hasError ? "border-destructive" : isConnecting ? "border-primary" : ""}`}
					>
						<div className="flex flex-col items-center gap-6">
							<div className="relative w-16 h-16">
								{isConnecting ? (
									<motion.span
										className="inline-flex"
										animate={{ rotate: 360 }}
										transition={{
											repeat: Infinity,
											duration: 1,
											ease: "linear",
										}}
									>
										<Loader2 className="w-full h-full text-primary" />
									</motion.span>
								) : hasError ? (
									<AlertCircle className="w-full h-full text-destructive" />
								) : (
									<Usb className="w-full h-full text-muted-foreground" />
								)}
							</div>

							<div className="text-center space-y-2">
								<h2
									className={`text-2xl font-bold ${isConnecting ? "text-primary" : hasError ? "text-destructive" : ""}`}
								>
									{isConnecting
										? "Connecting..."
										: hasError
											? "Connection Failed"
											: "Control Kiosk Setup"}
								</h2>
								<p className="text-muted-foreground">
									{isConnecting
										? "Connecting to card reader. Please wait..."
										: hasError
											? "Failed to connect to card reader. Please try again."
											: "Connect a USB card reader to this device, then press Start."}
								</p>
							</div>

							<Button
								onClick={() => void connect()}
								variant={hasError ? "destructive" : "default"}
								disabled={isConnecting}
								size="lg"
								className="gap-2"
							>
								{isConnecting ? (
									<>
										<Loader2 className="w-4 h-4 animate-spin" />
										Connecting...
									</>
								) : hasError ? (
									<>
										<AlertCircle className="w-4 h-4" />
										Retry Connection
									</>
								) : (
									<>
										<CheckCircle2 className="w-4 h-4" />
										Start Kiosk
									</>
								)}
							</Button>
						</div>
					</Card>
				</div>
			</div>
		);
	}

	if (isAuthenticated && state.authenticatedUser && selectedControlPoint) {
		const point = selectedControlPoint;
		const Icon = point.controlClass === "DOOR" ? DoorOpen : Zap;
		const statusText = !point.isActive
			? "Disabled"
			: point.controlClass === "DOOR"
				? point.currentState
					? "Unlocked"
					: "Locked"
				: point.currentState
					? "In Use"
					: "Available";
		const statusVariant = !point.isActive
			? "secondary"
			: point.currentState
				? "warning"
				: "success";
		const trainingStatusText = trainingStatusMessage
			? trainingStatusMessage
			: lastTrainedUserName
				? `Last trained: ${lastTrainedUserName}`
				: "Waiting for card scan...";
		const trainingStatusClass =
			trainingStatusType === "error"
				? "text-destructive"
				: "text-muted-foreground";
		const hasControlLogs = controlLogs.length > 0;

		return (
			<>
				<div className="h-svh bg-background flex flex-col overflow-hidden">
					<AuthenticatedHeader
						logo={logo}
						getLogoDataUrl={getLogoDataUrl}
						userName={state.authenticatedUser.name}
						onCancel={logout}
					/>

					<main className="flex-1 overflow-auto p-4 px-8">
						<div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
							<div>
								<p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
									Manage Control Point
								</p>
								<h1 className="text-3xl font-bold">{point.name}</h1>
								{point.location && (
									<p className="text-sm text-muted-foreground mt-2">
										{point.location}
									</p>
								)}
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={stopManagingControlPoint}
								className="gap-2"
							>
								<ArrowLeft className="w-4 h-4" />
								Back
							</Button>
						</div>

						<div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
							<Card className="p-6 space-y-6">
								<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
									<div className="flex items-center gap-4">
										<div
											className={`p-4 rounded-full ${point.currentState ? "bg-green-500/10" : "bg-muted"}`}
										>
											<Icon
												className={`w-6 h-6 ${point.currentState ? "text-green-500" : "text-muted-foreground"}`}
											/>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">
												Control type
											</p>
											<h2 className="text-xl font-semibold">
												{point.controlClass === "DOOR" ? "Door" : "Switch"}
											</h2>
										</div>
									</div>
									<Badge
										variant={statusVariant}
										className="uppercase text-lg font-semibold py-2 px-3"
									>
										{statusText}
									</Badge>
								</div>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="rounded-xl border border-border p-4 bg-background">
										<p className="text-sm text-muted-foreground">Active</p>
										<p className="mt-2 font-semibold">
											{point.isActive ? "Yes" : "No"}
										</p>
									</div>
									<button
										type="button"
										onClick={() => openControlLogsDialog(point)}
										className="rounded-xl border border-border p-4 bg-background text-left transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
									>
										<p className="text-sm text-muted-foreground">Control Logs</p>
										<p className="mt-2 font-semibold">Tap to view logs</p>
									</button>
								</div>
								<div className="rounded-xl border border-border p-4 bg-background space-y-2">
									<p className="text-sm text-muted-foreground">Current state</p>
									<p className="font-semibold">
										{statusText}
										{point.isActive &&
											point.currentUserName &&
											` by ${point.currentUserName}`}
									</p>
								</div>
								<div className="flex flex-col gap-3 sm:flex-row">
									<Button
										onClick={() => toggleControlPointActive(point)}
										disabled={isUpdatingControlPoint}
										className="flex-1 text-lg font-semibold"
										variant={point.isActive ? "destructive" : "success"}
									>
										{point.isActive ? "Deactivate" : "Activate"}
									</Button>
									<Button
										variant="outline"
										onClick={stopManagingControlPoint}
										className="flex-1 text-lg font-semibold"
									>
										Close
									</Button>
								</div>
							</Card>
							<div className="space-y-4">
								<Card className="p-6 space-y-4">
									<h3 className="text-lg font-semibold">Training</h3>
									{point.trainedRole ? (
										<div className="space-y-4">
											<div>
												<p className="text-sm text-muted-foreground">
													Trained role
												</p>
												<Badge variant="outline" className="text-xs">
													{point.trainedRole.name}
												</Badge>
											</div>
											<Button
												className="w-full text-lg font-semibold"
												onClick={() => openTrainingDialog(point)}
											>
												Train Users
											</Button>
										</div>
									) : (
										<p className="text-sm text-muted-foreground">
											No trained role is configured for this point.
										</p>
									)}
								</Card>
								<Card className="p-6 space-y-4">
									<h3 className="text-lg font-semibold">Authorized access</h3>
									<div className="space-y-4">
										<div>
											<p className="text-sm text-muted-foreground">
												Authorized roles
											</p>
											{point.authorizedRoles.length > 0 ? (
												<div className="mt-2 flex flex-wrap gap-2">
													{point.authorizedRoles.map((role) => (
														<Badge
															key={role.id}
															variant="outline"
															className="text-xs"
														>
															{role.name}
														</Badge>
													))}
												</div>
											) : (
												<p className="mt-2 text-sm text-muted-foreground">
													No role restrictions.
												</p>
											)}
										</div>
										<div>
											<p className="text-sm text-muted-foreground">
												Authorized users
											</p>
											{point.authorizedUsers.length > 0 ? (
												<div className="mt-2 space-y-2">
													{point.authorizedUsers.map((user) => (
														<p key={user.id} className="text-sm">
															{user.name}
														</p>
													))}
												</div>
											) : (
												<p className="mt-2 text-sm text-muted-foreground">
													No users are explicitly authorized.
												</p>
											)}
										</div>
									</div>
								</Card>
							</div>
						</div>
					</main>
				</div>

				<AnimatePresence>
					{trainingControlPoint && (
						<motion.div
							className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={closeTrainingDialog}
						>
							<motion.div
								className="w-full max-w-2xl rounded-3xl bg-card p-8 shadow-xl border border-border"
								initial={{ opacity: 0, scale: 0.95, y: 16 }}
								animate={{ opacity: 1, scale: 1, y: 0 }}
								exit={{ opacity: 0, scale: 0.95, y: 16 }}
								transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
								onClick={(event) => event.stopPropagation()}
							>
								<div className="flex flex-col gap-6">
									<div className="flex items-center justify-between">
										<div>
											<p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
												Training Mode
											</p>
											<h2 className="text-3xl font-bold">
												Train Users for {trainingControlPoint.name}
											</h2>
											{trainingControlPoint.trainedRole && (
												<div>
													<p className="text-sm text-muted-foreground mt-2">
														Granting Role
													</p>
													<Badge variant="outline" className="text-xs">
														{trainingControlPoint.trainedRole.name}
													</Badge>
												</div>
											)}
										</div>
										<Button variant="outline" onClick={closeTrainingDialog}>
											Done
										</Button>
									</div>

									<div className="flex items-center gap-4 rounded-2xl border border-border bg-background p-6">
										<div className="relative flex items-center justify-center">
											<motion.div
												className="absolute h-4 w-4 rounded-full bg-primary/20"
												animate={{ scale: [1, 3], opacity: [0.6, 0.2] }}
												transition={{
													duration: 1.6,
													repeat: Infinity,
													ease: "easeOut",
												}}
											/>
											<motion.div
												className="h-4 w-4 rounded-full bg-primary"
												animate={{ opacity: [0.3, 1, 0.3] }}
												transition={{ duration: 1.6, repeat: Infinity }}
											/>
										</div>
										<div>
											<p className="text-lg font-semibold">
												Scan card to train user
											</p>
											<p className="text-sm text-muted-foreground">
												You can scan multiple cards quickly without closing this
												dialog.
											</p>
										</div>
									</div>

									<div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
										<div
											className={`text-sm font-medium ${trainingStatusClass}`}
										>
											{trainingStatusText}
										</div>
										{isTrainingUser && (
											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<Loader2 className="h-4 w-4 animate-spin" />
												Saving
											</div>
										)}
									</div>
								</div>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>

				<AnimatePresence>
					{controlLogsPoint && (
						<motion.div
							className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={closeControlLogsDialog}
						>
							<motion.div
								className="w-full max-w-3xl rounded-3xl bg-card p-8 shadow-xl border border-border"
								initial={{ opacity: 0, scale: 0.95, y: 16 }}
								animate={{ opacity: 1, scale: 1, y: 0 }}
								exit={{ opacity: 0, scale: 0.95, y: 16 }}
								transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
								onClick={(event) => event.stopPropagation()}
							>
								<div className="flex flex-col gap-6">
									<div className="flex items-center justify-between">
										<div>
											<p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
												Control Logs
											</p>
											<h2 className="text-3xl font-bold">
												{controlLogsPoint.name}
											</h2>
										</div>
										<Button variant="outline" onClick={closeControlLogsDialog}>
											Done
										</Button>
									</div>

									<div className="rounded-2xl border border-border bg-background p-4">
										<div className="mb-3 flex items-center justify-between">
											<p className="text-sm font-semibold">Recent activity</p>
											{isControlLogsLoading && (
												<div className="flex items-center gap-2 text-xs text-muted-foreground">
													<Loader2 className="h-4 w-4 animate-spin" />
													Loading
												</div>
											)}
										</div>
										<div className="max-h-[320px] space-y-3 overflow-y-auto pr-2">
											{hasControlLogs ? (
												controlLogs.map((log) => (
													<div
														key={log.id}
														className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
													>
														<div>
															<p className="text-sm font-semibold capitalize">
																{log.action}
															</p>
															<p className="text-xs text-muted-foreground">
																{log.userName}
															</p>
														</div>
														<p className="text-xs text-muted-foreground">
															{new Date(log.createdAt).toLocaleString()}
														</p>
													</div>
												))
											) : (
												<p className="text-sm text-muted-foreground">
													No log entries yet.
												</p>
											)}
										</div>
									</div>
								</div>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>
			</>
		);
	}

	// Authenticated view - new design with session controls and control points
	if (isAuthenticated && state.authenticatedUser) {
		const authorizedPoints = controlPoints.filter(
			(p) =>
				(state.authenticatedUser?.authorizedControlPointIds.includes(p.id) &&
					p.isActive) ||
				state.authenticatedUser?.managedControlPointIds.includes(p.id),
		);
		const managedPoints = controlPoints.filter((p) =>
			state.authenticatedUser?.managedControlPointIds.includes(p.id),
		);
		const isInSession = !!state.authenticatedUser.currentSession;
		const isStaffing =
			state.authenticatedUser.currentSession?.sessionType === "staffing";
		const isRegular =
			state.authenticatedUser.currentSession?.sessionType === "regular";
		const hasStaffingPermission = state.authenticatedUser.hasStaffingPermission;

		return (
			<div className="h-svh bg-background flex flex-col overflow-hidden">
				{/* Header with logo, user name (centered), and cancel */}
				<AuthenticatedHeader
					logo={logo}
					getLogoDataUrl={getLogoDataUrl}
					userName={state.authenticatedUser.name}
					onCancel={logout}
				/>

				{/* Main content */}
				<main className="flex-1 overflow-auto p-4 px-8">
					{/* Session Controls */}
					<section className="mb-6">
						<h2 className="text-lg font-bold mb-3">
							{isInSession ? "Session Controls" : "Start a Session"}
						</h2>
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
							{!isInSession && (
								<SessionActionCard
									title="Start Session"
									description="Begin a regular session"
									icon={
										<Clock className="w-8 h-8 md:w-10 md:h-10 text-orange-500" />
									}
									colorClass="text-orange-500"
									onClick={() => handleSessionAction("start_regular")}
								/>
							)}
							{!isInSession && hasStaffingPermission && (
								<SessionActionCard
									title="Start Staffing"
									description="Begin your staffing shift"
									icon={
										<Users className="w-8 h-8 md:w-10 md:h-10 text-purple-500" />
									}
									colorClass="text-purple-500"
									onClick={() => handleSessionAction("start_staffing")}
								/>
							)}
							{isInSession && (
								<SessionActionCard
									title="End Session"
									description="End your current session"
									icon={
										<LogOut className="w-8 h-8 md:w-10 md:h-10 text-blue-500" />
									}
									colorClass="text-blue-500"
									onClick={() => handleSessionAction("end_session")}
								/>
							)}
							{isRegular && hasStaffingPermission && (
								<SessionActionCard
									title="Switch to Staffing"
									description="End regular and start staffing"
									icon={
										<RefreshCw className="w-8 h-8 md:w-10 md:h-10 text-purple-500" />
									}
									colorClass="text-purple-500"
									onClick={() => handleSessionAction("switch_to_staffing")}
								/>
							)}
							{isStaffing && (
								<SessionActionCard
									title="Switch to Regular"
									description="End staffing and start regular"
									icon={
										<RefreshCw className="w-8 h-8 md:w-10 md:h-10 text-orange-500" />
									}
									colorClass="text-orange-500"
									onClick={() => handleSessionAction("switch_to_regular")}
								/>
							)}
						</div>
						{isInSession && (
							<div className="flex items-center gap-2 mt-3">
								<Badge variant="outline" className="text-xs">
									{isStaffing ? "Staffing Session" : "Regular Session"}
								</Badge>
							</div>
						)}
					</section>

					{/* Control Points */}
					<section>
						<h2 className="text-lg font-bold mb-3">Equipment Controls</h2>
						{authorizedPoints.length === 0 ? (
							<div className="text-center py-8">
								<AlertCircle className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
								<p className="text-muted-foreground text-sm">
									No equipment controls available for your account
								</p>
							</div>
						) : (
							<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
								{authorizedPoints.map((point, index) => (
									<ControlPointButton
										key={point.id}
										point={point}
										onManage={startManagingControlPoint}
										onOperate={operateControlPoint}
										canManage={managedPoints.some((p) => p.id === point.id)}
										isOperating={state.operatingPointId === point.id}
										disabled={!!state.operatingPointId}
										index={index}
									/>
								))}
							</div>
						)}
					</section>
				</main>

				{/* Confirmation Dialog */}
				<AnimatePresence>
					{state.pendingConfirmation && (
						<ConfirmationDialog
							title={state.pendingConfirmation.title}
							message={state.pendingConfirmation.message}
							confirmText={state.pendingConfirmation.confirmText}
							variant={state.pendingConfirmation.variant}
							onConfirm={confirmAction}
							onCancel={cancelConfirmation}
						/>
					)}
				</AnimatePresence>

				{/* Processing/Success/Error Overlays */}
				<AnimatePresence>
					{state.mode === "processing" && (
						<motion.div
							className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							<motion.div
								className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full"
								animate={{ rotate: 360 }}
								transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
							/>
						</motion.div>
					)}

					{state.mode === "success" && (
						<motion.div
							className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							<motion.div
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								transition={{ type: "spring", duration: 0.5 }}
							>
								<CheckCircle2 className="w-32 h-32 text-green-500" />
							</motion.div>
						</motion.div>
					)}

					{state.mode === "error" && state.error && (
						<motion.div
							className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							<div className="text-center max-w-lg px-6">
								<AlertCircle className="w-24 h-24 mx-auto text-destructive mb-4" />
								<p className="text-2xl text-destructive text-balance">
									{state.error}
								</p>
							</div>
						</motion.div>
					)}

					{state.mode === "authenticated" && state.error && (
						<motion.div
							className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							<div className="text-center max-w-lg px-6">
								<AlertCircle className="w-24 h-24 mx-auto text-destructive mb-4" />
								<p className="text-2xl text-destructive text-balance">
									{state.error}
								</p>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		);
	}

	// Default view - New idle screen design
	return (
		<div className="h-svh bg-background flex flex-col overflow-hidden">
			{/* Header bar with logo and time */}
			<IdleHeader logo={logo} getLogoDataUrl={getLogoDataUrl} />

			{/* Main content */}
			<main className="flex-1 flex flex-col px-8 py-4 overflow-hidden">
				<AnimatePresence mode="wait">
					{state.mode === "processing" ? (
						<motion.div
							key="processing"
							className="flex-1 flex items-center justify-center"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							<div className="text-center">
								<motion.div
									className="w-20 h-20 mx-auto border-4 border-primary border-t-transparent rounded-full"
									animate={{ rotate: 360 }}
									transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
								/>
								<p className="text-2xl text-muted-foreground mt-6">
									Processing...
								</p>
							</div>
						</motion.div>
					) : state.mode === "error" ? (
						<motion.div
							key="error"
							className="flex-1 flex items-center justify-center"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							<div className="text-center max-w-lg px-6">
								<AlertCircle className="w-20 h-20 mx-auto text-destructive" />
								<p className="text-2xl text-destructive mt-6 text-balance">
									{state.error}
								</p>
							</div>
						</motion.div>
					) : state.mode === "success" ? (
						<motion.div
							key="success"
							className="flex-1 flex items-center justify-center"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							<div className="text-center">
								<CheckCircle2 className="w-20 h-20 mx-auto text-green-500" />
								<p className="text-2xl text-green-500 mt-6">Success!</p>
							</div>
						</motion.div>
					) : (
						<motion.div
							key="idle"
							className="flex-1 flex flex-col overflow-hidden"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							{/* Action prompt */}
							<div className="text-center mb-4 shrink-0">
								<h2 className="text-2xl font-bold">Scan your BuzzCard</h2>
								<p className="text-muted-foreground">
									Use your BuzzCard to control equipment
								</p>
							</div>

							{/* Control points status grid */}
							<div className="flex-1 overflow-auto">
								<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
									{controlPoints.map((point, index) => (
										<ControlPointStatusCard
											key={point.id}
											controlPoint={point}
											index={index}
										/>
									))}
								</div>
								{controlPoints.length === 0 && (
									<div className="text-center py-8 text-muted-foreground">
										<p>No control points configured</p>
									</div>
								)}
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</main>
		</div>
	);
}

export default function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<ControlKioskApp />
		</QueryClientProvider>
	);
}
