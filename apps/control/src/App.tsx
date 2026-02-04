import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle2,
	Clock,
	DoorOpen,
	Loader2,
	LogOut,
	Power,
	RefreshCw,
	Usb,
	Users,
	Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { ScrollArea } from "./components/ui/scroll-area";
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

function LiveClock() {
	const [time, setTime] = useState(new Date());

	useEffect(() => {
		const interval = setInterval(() => setTime(new Date()), 1000);
		return () => clearInterval(interval);
	}, []);

	return (
		<div className="text-center">
			<div className="text-8xl font-bold tabular-nums tracking-tight">
				{time.toLocaleTimeString("en-US", {
					hour: "2-digit",
					minute: "2-digit",
					hour12: true,
				})}
			</div>
			<div className="text-2xl text-muted-foreground mt-2">
				{time.toLocaleDateString("en-US", {
					weekday: "long",
					month: "long",
					day: "numeric",
				})}
			</div>
		</div>
	);
}

function StatusSidebar({
	controlPoints,
}: {
	controlPoints: ControlPointWithStatus[];
}) {
	function getStateColor(
		_controlClass: ControlPointWithStatus["controlClass"],
		currentState: boolean,
		isActive: boolean,
	) {
		if (!isActive) return "bg-gray-400";
		return currentState ? "bg-green-500" : "bg-gray-400";
	}

	function getStateLabel(
		controlClass: ControlPointWithStatus["controlClass"],
		currentState: boolean,
	) {
		if (controlClass === "DOOR") {
			return currentState ? "Unlocked" : "Locked";
		}
		return currentState ? "On" : "Off";
	}

	return (
		<aside className="w-80 border-l bg-card flex flex-col h-full">
			<div className="p-4 border-b">
				<h2 className="text-lg font-semibold">Control Points Status</h2>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-4 space-y-2">
					<AnimatePresence mode="popLayout">
						{controlPoints.map((controlPoint) => (
							<motion.div
								key={controlPoint.id}
								layout
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: 10 }}
								className={`flex items-center justify-between p-3 rounded-lg border ${
									!controlPoint.isActive ? "bg-muted/30" : ""
								}`}
							>
								<div className="flex items-center gap-3 min-w-0">
									<motion.span
										className={`w-3 h-3 rounded-full shrink-0 ${getStateColor(
											controlPoint.controlClass,
											controlPoint.currentState,
											controlPoint.isActive,
										)}`}
										animate={{
											scale:
												controlPoint.currentState && controlPoint.isActive
													? [1, 1.2, 1]
													: 1,
										}}
										transition={{
											duration: 2,
											repeat:
												controlPoint.currentState && controlPoint.isActive
													? Infinity
													: 0,
											ease: "easeInOut",
										}}
									/>
									<div className="min-w-0">
										<p className="font-medium truncate text-sm">
											{controlPoint.name}
										</p>
										{controlPoint.location && (
											<p className="text-xs text-muted-foreground truncate">
												📍 {controlPoint.location}
											</p>
										)}
									</div>
								</div>
								<Badge
									variant={
										controlPoint.currentState && controlPoint.isActive
											? "success"
											: "secondary"
									}
									className="shrink-0"
								>
									{getStateLabel(
										controlPoint.controlClass,
										controlPoint.currentState,
									)}
								</Badge>
							</motion.div>
						))}
					</AnimatePresence>

					{controlPoints.length === 0 && (
						<div className="text-center py-8 text-muted-foreground">
							<p>No control points configured</p>
						</div>
					)}
				</div>
			</ScrollArea>
		</aside>
	);
}

interface SessionSelectionProps {
	userName: string;
	hasStaffingPermission: boolean;
	currentSession: { sessionType: "regular" | "staffing" } | null;
	onStartRegular: () => void;
	onStartStaffing: () => void;
	onEndSession: () => void;
	onSwitchToRegular: () => void;
	onSwitchToStaffing: () => void;
	onCancel: () => void;
}

function SessionSelection({
	userName,
	hasStaffingPermission,
	currentSession,
	onStartRegular,
	onStartStaffing,
	onEndSession,
	onSwitchToRegular,
	onSwitchToStaffing,
	onCancel,
}: SessionSelectionProps) {
	const isInSession = !!currentSession;
	const isStaffingSession = currentSession?.sessionType === "staffing";

	return (
		<motion.div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.3 }}
		>
			<motion.div
				className="mx-auto gap-6 flex flex-col max-w-2xl"
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
					<h2 className="text-5xl font-bold">
						{isInSession ? `Goodbye, ${userName}!` : `Welcome, ${userName}!`}
					</h2>
					{isInSession && (
						<div className="flex items-center justify-center gap-2">
							<p className="text-2xl text-muted-foreground">Current session:</p>
							<Badge variant="outline" className="text-lg">
								{isStaffingSession ? "Staffing" : "Regular"}
							</Badge>
						</div>
					)}
					{!isInSession && (
						<p className="text-2xl text-muted-foreground">
							Select your session type
						</p>
					)}
				</motion.div>

				<div
					className={`grid gap-6 ${hasStaffingPermission ? "grid-cols-2" : "grid-cols-1"}`}
				>
					{!isInSession ? (
						<>
							{/* Start Session Options */}
							<motion.div
								className="h-full"
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.15, duration: 0.4 }}
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}
							>
								<button
									type="button"
									onClick={onStartRegular}
									className="w-full h-full bg-card text-card-foreground rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-[1.02] hover:border-orange-500 p-8 border"
								>
									<div className="flex flex-col items-center gap-6">
										<Clock className="w-24 h-24 text-orange-500" />
										<div className="text-center gap-2 flex flex-col">
											<h3 className="text-4xl font-bold text-orange-500">
												Regular
											</h3>
											<p className="text-xl text-muted-foreground">
												Session for utilizing the space
											</p>
										</div>
									</div>
								</button>
							</motion.div>

							{hasStaffingPermission && (
								<motion.div
									className="h-full"
									initial={{ opacity: 0, y: 12 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.2, duration: 0.4 }}
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}
								>
									<button
										type="button"
										onClick={onStartStaffing}
										className="w-full h-full bg-card text-card-foreground rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-[1.02] hover:border-purple-500 p-8 border"
									>
										<div className="flex flex-col items-center gap-6">
											<Users className="w-24 h-24 text-purple-500" />
											<div className="text-center gap-2 flex flex-col">
												<h3 className="text-4xl font-bold text-purple-500">
													Staffing
												</h3>
												<p className="text-xl text-muted-foreground">
													Session for staffing a shift
												</p>
											</div>
										</div>
									</button>
								</motion.div>
							)}
						</>
					) : (
						<>
							{/* End Session Options */}
							<motion.div
								className="h-full"
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.15, duration: 0.4 }}
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}
							>
								<button
									type="button"
									onClick={onEndSession}
									className="w-full h-full bg-card text-card-foreground rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-[1.02] hover:border-blue-500 p-8 border"
								>
									<div className="flex flex-col items-center gap-6">
										<LogOut className="w-24 h-24 text-blue-500" />
										<div className="text-center gap-2 flex flex-col">
											<h3 className="text-4xl font-bold text-blue-500">
												Leave
											</h3>
											<p className="text-xl text-muted-foreground">
												End your current session
											</p>
										</div>
									</div>
								</button>
							</motion.div>

							{hasStaffingPermission && (
								<motion.div
									className="h-full"
									initial={{ opacity: 0, y: 12 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.2, duration: 0.4 }}
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}
								>
									<button
										type="button"
										onClick={
											isStaffingSession ? onSwitchToRegular : onSwitchToStaffing
										}
										className={`w-full h-full bg-card text-card-foreground rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-[1.02] ${
											isStaffingSession
												? "hover:border-orange-500"
												: "hover:border-purple-500"
										} p-8 border`}
									>
										<div className="flex flex-col items-center gap-6">
											<RefreshCw
												className={`w-24 h-24 ${isStaffingSession ? "text-orange-500" : "text-purple-500"}`}
											/>
											<div className="text-center gap-2 flex flex-col">
												<h3
													className={`text-4xl font-bold ${isStaffingSession ? "text-orange-500" : "text-purple-500"}`}
												>
													{isStaffingSession
														? "Switch to Regular"
														: "Switch to Staffing"}
												</h3>
												<p className="text-xl text-muted-foreground">
													{isStaffingSession
														? "End session and start regular"
														: "End session and start staffing"}
												</p>
											</div>
										</div>
									</button>
								</motion.div>
							)}
						</>
					)}
				</div>

				<motion.div
					className="flex justify-center"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.25, duration: 0.35 }}
				>
					<Button variant="ghost" size="lg" onClick={onCancel}>
						Cancel
					</Button>
				</motion.div>
			</motion.div>
		</motion.div>
	);
}

interface ControlGridProps {
	controlPoints: ControlPointWithStatus[];
	authorizedIds: string[];
	onOperate: (point: ControlPointWithStatus) => void;
	operatingPointId: string | null;
}

function ControlGrid({
	controlPoints,
	authorizedIds,
	onOperate,
	operatingPointId,
}: ControlGridProps) {
	// Only show control points the user is authorized to control
	const authorizedPoints = controlPoints.filter((p) =>
		authorizedIds.includes(p.id),
	);

	if (authorizedPoints.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center">
					<AlertCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
					<p className="text-xl text-muted-foreground">
						No control points available
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
			{authorizedPoints.map((point, index) => {
				const Icon = point.controlClass === "DOOR" ? DoorOpen : Zap;
				const isOn = point.currentState;
				const isOperating = operatingPointId === point.id;
				const actionText =
					point.controlClass === "DOOR"
						? "Unlock"
						: isOn
							? "Turn Off"
							: "Turn On";

				return (
					<motion.button
						key={point.id}
						type="button"
						disabled={!!operatingPointId}
						onClick={() => onOperate(point)}
						className={`relative p-6 rounded-xl border-2 transition-all ${
							isOn
								? "border-green-500 bg-green-500/10"
								: "border-muted hover:border-primary"
						} ${operatingPointId ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-[1.02]"} ${isOperating ? "!opacity-100" : ""}`}
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: index * 0.05 }}
						whileHover={!operatingPointId ? { scale: 1.02 } : undefined}
						whileTap={!operatingPointId ? { scale: 0.98 } : undefined}
					>
						{/* Loading overlay for operating point */}
						{isOperating && (
							<div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl z-10">
								<motion.div
									className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full"
									animate={{ rotate: 360 }}
									transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
								/>
							</div>
						)}
						<div className="flex flex-col items-center gap-3">
							<div
								className={`p-4 rounded-full ${isOn ? "bg-green-500/20" : "bg-muted"}`}
							>
								<Icon
									className={`w-8 h-8 ${isOn ? "text-green-500" : "text-muted-foreground"}`}
								/>
							</div>
							<div className="text-center">
								<h3 className="font-semibold truncate max-w-full">
									{point.name}
								</h3>
								{point.location && (
									<p className="text-xs text-muted-foreground truncate">
										{point.location}
									</p>
								)}
							</div>
							<Badge variant={isOn ? "success" : "secondary"}>
								{actionText}
							</Badge>
						</div>
					</motion.button>
				);
			})}
		</div>
	);
}

function ControlKioskApp() {
	useBranding();
	const logo = useLogo("dark");

	const {
		state,
		controlPoints,
		isLoading: controlPointsLoading,
		handleCardScan,
		operateControlPoint,
		logout,
		showSessionSelection,
		handleSessionAction,
		hideSessionSelection,
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
		onScan: handleCardScan,
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

	// Authenticated view - show control grid
	if (isAuthenticated && state.authenticatedUser) {
		return (
			<div className="min-h-screen bg-background flex flex-col">
				{/* Header with logout */}
				<header className="border-b px-6 py-4 flex items-center justify-between">
					<Button
						variant="ghost"
						size="lg"
						onClick={logout}
						className="gap-2 text-lg"
					>
						<LogOut className="w-5 h-5" />
						Cancel
					</Button>

					<div className="flex items-center gap-4">
						{logo && (
							<img
								src={getLogoDataUrl(logo)}
								alt="Logo"
								className="h-8 w-auto"
							/>
						)}
						<div className="text-right">
							<p className="font-semibold">{state.authenticatedUser.name}</p>
							{state.authenticatedUser.currentSession && (
								<Badge variant="outline" className="text-xs">
									{state.authenticatedUser.currentSession.sessionType ===
									"staffing"
										? "Staffing"
										: "Regular"}{" "}
									Session
								</Badge>
							)}
						</div>
					</div>

					<Button
						variant="outline"
						size="lg"
						onClick={showSessionSelection}
						className="gap-2"
					>
						<Power className="w-5 h-5" />
						{state.authenticatedUser.currentSession
							? "End Session"
							: "Start Session"}
					</Button>
				</header>

				{/* Control Grid */}
				<main className="flex-1 overflow-auto">
					<ControlGrid
						controlPoints={controlPoints}
						authorizedIds={state.authenticatedUser.authorizedControlPointIds}
						onOperate={operateControlPoint}
						operatingPointId={state.operatingPointId}
					/>
				</main>

				{/* Feedback overlay */}
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
							<div className="text-center">
								<AlertCircle className="w-24 h-24 mx-auto text-destructive mb-4" />
								<p className="text-2xl text-destructive">{state.error}</p>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Session Selection Modal */}
				<AnimatePresence>
					{state.showSessionSelection && state.authenticatedUser && (
						<SessionSelection
							userName={state.authenticatedUser.name}
							hasStaffingPermission={
								state.authenticatedUser.hasStaffingPermission
							}
							currentSession={state.authenticatedUser.currentSession}
							onStartRegular={() => handleSessionAction("start_regular")}
							onStartStaffing={() => handleSessionAction("start_staffing")}
							onEndSession={() => handleSessionAction("end_session")}
							onSwitchToRegular={() => handleSessionAction("switch_to_regular")}
							onSwitchToStaffing={() =>
								handleSessionAction("switch_to_staffing")
							}
							onCancel={hideSessionSelection}
						/>
					)}
				</AnimatePresence>
			</div>
		);
	}

	// Default view - Clock and Tap your card (with status sidebar)
	return (
		<div className="h-screen bg-background flex">
			{/* Main content - Clock and tap prompt */}
			<main className="flex-1 flex flex-col items-center justify-center">
				<AnimatePresence mode="wait">
					{state.mode === "processing" ? (
						<motion.div
							key="processing"
							className="text-center"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							<motion.div
								className="w-20 h-20 mx-auto border-4 border-primary border-t-transparent rounded-full"
								animate={{ rotate: 360 }}
								transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
							/>
							<p className="text-2xl text-muted-foreground mt-6">
								Processing...
							</p>
						</motion.div>
					) : state.mode === "error" ? (
						<motion.div
							key="error"
							className="text-center"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							<AlertCircle className="w-20 h-20 mx-auto text-destructive" />
							<p className="text-2xl text-destructive mt-6">{state.error}</p>
						</motion.div>
					) : state.mode === "success" ? (
						<motion.div
							key="success"
							className="text-center"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							<CheckCircle2 className="w-20 h-20 mx-auto text-green-500" />
							<p className="text-2xl text-green-500 mt-6">Success!</p>
						</motion.div>
					) : (
						<motion.div
							key="idle"
							className="text-center space-y-12"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							{logo && (
								<img
									src={getLogoDataUrl(logo)}
									alt="Logo"
									className="h-16 w-auto mx-auto"
								/>
							)}
							<LiveClock />
							<div className="space-y-2">
								<p className="text-4xl font-semibold">Tap your BuzzCard</p>
								<p className="text-xl text-muted-foreground">
									to access equipment controls
								</p>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</main>

			{/* Status sidebar - only show in idle mode */}
			{state.mode === "idle" && <StatusSidebar controlPoints={controlPoints} />}
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
