/**
 * Face ID Status Indicator
 *
 * A small visual indicator dot in the bottom-left corner showing
 * the current state of face detection and identification.
 *
 * Colors:
 * - Gray: No face detected / not scanning
 * - Blue: Face detected, stabilizing
 * - Yellow: Face qualified, attempting identification
 * - Green: Face matched (pulse animation)
 * - Orange: Face detected but suppressed (recently tried)
 * - Red: Error state
 */

import { useCameraContext } from "@/components/camera-provider";
import { cn } from "@/lib/utils";

type IndicatorState =
	| "idle" // Gray - not scanning or no face
	| "detected" // Blue - face detected, waiting for stability
	| "qualified" // Yellow - qualified, about to attempt
	| "attempting" // Yellow pulsing - making server request
	| "matched" // Green - successfully matched
	| "suppressed" // Orange - face suppressed (already tried)
	| "error"; // Red - error state

function getIndicatorState(
	isFaceIdScanning: boolean,
	faceIdStatus: string,
	trackerStats: {
		detected: number;
		qualified: number;
		attempted: number;
		suppressed: number;
	},
	pendingMatch: unknown,
	isCooldownActive: boolean,
): IndicatorState {
	// Error state
	if (faceIdStatus === "error") {
		return "error";
	}

	// Not scanning
	if (!isFaceIdScanning || faceIdStatus !== "scanning") {
		return "idle";
	}

	// Check if we just had a match (pending confirmation)
	if (pendingMatch || isCooldownActive) {
		return "matched";
	}

	// Check tracker stats for current state
	if (trackerStats.suppressed > 0) {
		return "suppressed";
	}

	if (trackerStats.attempted > 0) {
		return "attempting";
	}

	if (trackerStats.qualified > 0) {
		return "qualified";
	}

	if (trackerStats.detected > 0) {
		return "detected";
	}

	// Scanning but no face
	return "idle";
}

const indicatorStyles: Record<
	IndicatorState,
	{ bg: string; animate?: string; title: string }
> = {
	idle: {
		bg: "bg-gray-500",
		title: "Face ID: No face detected",
	},
	detected: {
		bg: "bg-blue-500",
		title: "Face ID: Face detected, stabilizing...",
	},
	qualified: {
		bg: "bg-yellow-500",
		animate: "animate-pulse",
		title: "Face ID: Checking identity...",
	},
	attempting: {
		bg: "bg-yellow-500",
		animate: "animate-pulse",
		title: "Face ID: Identifying...",
	},
	matched: {
		bg: "bg-green-500",
		animate: "animate-pulse",
		title: "Face ID: Match found!",
	},
	suppressed: {
		bg: "bg-orange-500",
		title: "Face ID: Recently checked",
	},
	error: {
		bg: "bg-red-500",
		title: "Face ID: Error",
	},
};

export function FaceIdIndicator() {
	const camera = useCameraContext();

	const state = getIndicatorState(
		camera.isFaceIdScanning,
		camera.faceIdStatus,
		camera.faceIdTrackerStats,
		camera.pendingFaceIdMatch,
		camera.isFaceIdCooldownActive,
	);

	const style = indicatorStyles[state];

	// Don't show if Face ID is disabled or initializing
	if (
		camera.faceIdStatus === "disabled" ||
		camera.faceIdStatus === "initializing"
	) {
		return null;
	}

	return (
		<div
			className="fixed bottom-4 left-4 z-50 flex items-center gap-2"
			title={style.title}
		>
			<div
				className={cn(
					"w-3 h-3 rounded-full transition-colors duration-300",
					style.bg,
					style.animate,
				)}
			/>
			{/* Optional: Show text label in development */}
			{import.meta.env.DEV && (
				<span className="text-xs text-muted-foreground opacity-50">
					{state}
				</span>
			)}
		</div>
	);
}
