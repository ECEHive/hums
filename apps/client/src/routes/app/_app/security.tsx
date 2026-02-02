import { trpc } from "@ecehive/trpc/client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
	Camera,
	ChevronLeft,
	ChevronRight,
	Clock,
	Download,
	Eye,
	History,
	Loader2Icon,
	Maximize2,
	Radio,
	RefreshCcwIcon,
	Search,
	Trash2,
	User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RequirePermissions, useAuth } from "@/auth";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/layout";
import { DataTable, TablePaginationFooter } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
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
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogPortal,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { checkPermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/_app/security")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <SecuritySnapshotsPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["security.list"];

type SecuritySnapshot = {
	id: string;
	eventType: string;
	capturedAt: Date;
	faceDetected: boolean;
	faceConfidence: number | null;
	device: {
		id: number;
		name: string;
	} | null;
	user: {
		id: number;
		name: string;
		username: string;
	} | null;
};

const eventTypeColors: Record<string, string> = {
	TAP: "bg-green-500",
	FACE_ID: "bg-purple-500",
	FACE_ID_ENROLLMENT: "bg-orange-500",
};

const eventTypeLabels: Record<string, string> = {
	TAP: "Tap",
	FACE_ID: "Face ID",
	FACE_ID_ENROLLMENT: "Face ID Enrollment",
};

// ============================================================================
// Live Snapshots View
// ============================================================================

type DeviceSnapshot = {
	device: {
		id: number;
		name: string;
	};
	snapshot: {
		id: string;
		eventType: string;
		capturedAt: Date;
		faceDetected: boolean;
		faceConfidence: number | null;
		user: {
			id: number;
			name: string;
			username: string;
		} | null;
	} | null;
};

function LiveSnapshotsView() {
	const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
	const [imageDialogOpen, setImageDialogOpen] = useState(false);
	// Track loaded images - using state so updates trigger re-renders
	const [imageCache, setImageCache] = useState<Map<string, string>>(new Map());

	const {
		data: liveData,
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["securitySnapshotsLive"],
		queryFn: async () => {
			return trpc.security.getLatestByDevice.query({});
		},
		refetchInterval: 5000, // Refresh every 5 seconds
	});

	const deviceSnapshots = (liveData?.deviceSnapshots ?? []).filter(
		(ds) => ds.snapshot !== null,
	);

	// Collect all snapshot IDs that need images (not in cache)
	const snapshotsNeedingImages = deviceSnapshots
		.filter((ds) => ds.snapshot && !imageCache.has(ds.snapshot.id))
		.map((ds) => ds.snapshot?.id)
		.filter((id): id is string => id !== undefined);

	// Batch load images for snapshots that need them
	const { data: newImages } = useQuery({
		queryKey: ["securitySnapshotImagesLive", ...snapshotsNeedingImages],
		queryFn: async () => {
			const results: Record<string, string> = {};
			// Load images in parallel
			await Promise.all(
				snapshotsNeedingImages.map(async (snapshotId) => {
					try {
						const imageData = await trpc.security.getImage.query({
							snapshotId,
						});
						if (imageData?.imageData) {
							results[snapshotId] = imageData.imageData;
						}
					} catch (err) {
						console.error(`Failed to load image for ${snapshotId}:`, err);
					}
				}),
			);
			return results;
		},
		enabled: snapshotsNeedingImages.length > 0,
		staleTime: Number.POSITIVE_INFINITY, // Never consider stale - we manage freshness ourselves
	});

	// Update cache with new images - triggers re-render
	useEffect(() => {
		if (newImages && Object.keys(newImages).length > 0) {
			setImageCache((prev) => {
				const next = new Map(prev);
				for (const [id, data] of Object.entries(newImages)) {
					next.set(id, data);
				}
				return next;
			});
		}
	}, [newImages]);

	// Get cached image for a snapshot
	const getImage = (snapshotId: string | undefined): string | null => {
		if (!snapshotId) return null;
		return imageCache.get(snapshotId) ?? null;
	};

	// Image preview dialog
	const { data: selectedImageData, isLoading: selectedImageLoading } = useQuery(
		{
			queryKey: ["securitySnapshotImage", selectedSnapshot],
			queryFn: async () => {
				if (!selectedSnapshot) return null;
				return trpc.security.getImage.query({ snapshotId: selectedSnapshot });
			},
			enabled: !!selectedSnapshot && imageDialogOpen,
		},
	);

	const handleViewImage = (snapshotId: string) => {
		setSelectedSnapshot(snapshotId);
		setImageDialogOpen(true);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (deviceSnapshots.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
				<Camera className="h-12 w-12 mb-4" />
				<p>No active devices found</p>
			</div>
		);
	}

	return (
		<>
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Radio
						className={`h-4 w-4 ${isFetching ? "text-green-500 animate-pulse" : ""}`}
					/>
					<span>
						Live view • Refreshing every 5 seconds
						{isFetching && " • Updating..."}
					</span>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => refetch()}
					disabled={isFetching}
				>
					{isFetching ? (
						<Loader2Icon className="size-4 animate-spin" />
					) : (
						<RefreshCcwIcon className="size-4" />
					)}
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{deviceSnapshots.map((ds: DeviceSnapshot) => (
					<Card key={ds.device.id} className="overflow-hidden">
						<CardHeader className="pb-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Camera className="h-4 w-4 text-muted-foreground" />
									<CardTitle className="text-base">{ds.device.name}</CardTitle>
								</div>
								{ds.snapshot && (
									<Badge
										className={
											eventTypeColors[ds.snapshot.eventType] ?? "bg-gray-500"
										}
									>
										{eventTypeLabels[ds.snapshot.eventType] ??
											ds.snapshot.eventType}
									</Badge>
								)}
							</div>
							{ds.snapshot && (
								<CardDescription>
									{new Date(ds.snapshot.capturedAt).toLocaleString()}
								</CardDescription>
							)}
						</CardHeader>
						<CardContent className="p-0">
							{ds.snapshot ? (
								<>
									<button
										type="button"
										className="relative aspect-video bg-muted cursor-pointer group w-full"
										onClick={() =>
											ds.snapshot && handleViewImage(ds.snapshot.id)
										}
									>
										{getImage(ds.snapshot.id) ? (
											<img
												src={getImage(ds.snapshot.id) ?? undefined}
												alt={`Latest from ${ds.device.name}`}
												className="w-full h-full object-cover"
											/>
										) : (
											<div className="flex items-center justify-center h-full">
												<Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
											</div>
										)}
										<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
											<Eye className="h-8 w-8 text-white" />
										</div>
									</button>
									<div className="p-4 pt-2">
										{ds.snapshot.user ? (
											<div className="flex items-center gap-2">
												<User className="h-4 w-4 text-muted-foreground" />
												<div className="flex flex-col">
													<span className="font-medium text-sm">
														{ds.snapshot.user.name}
													</span>
													<span className="text-xs text-muted-foreground">
														@{ds.snapshot.user.username}
													</span>
												</div>
											</div>
										) : (
											<span className="text-sm text-muted-foreground">
												Anonymous
											</span>
										)}
									</div>
								</>
							) : (
								<div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
									<Camera className="h-8 w-8 mb-2 opacity-50" />
									<p className="text-sm">No snapshots yet</p>
								</div>
							)}
						</CardContent>
					</Card>
				))}
			</div>

			{/* Image Preview Dialog */}
			<Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>Security Snapshot</DialogTitle>
						<DialogDescription>
							{selectedImageData && (
								<>
									{eventTypeLabels[selectedImageData.eventType] ??
										selectedImageData.eventType}{" "}
									at {new Date(selectedImageData.capturedAt).toLocaleString()}
								</>
							)}
						</DialogDescription>
					</DialogHeader>

					<div className="flex items-center justify-center min-h-[400px] bg-muted rounded-lg">
						{selectedImageLoading ? (
							<Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
						) : selectedImageData?.imageData ? (
							<img
								src={selectedImageData.imageData}
								alt="Security snapshot"
								className="max-w-full max-h-[500px] object-contain rounded-lg"
							/>
						) : (
							<span className="text-muted-foreground">
								Failed to load image
							</span>
						)}
					</div>

					{selectedImageData?.imageData && (
						<div className="flex justify-end">
							<Button
								variant="outline"
								onClick={() => {
									const link = document.createElement("a");
									link.href = selectedImageData.imageData;
									link.download = `snapshot-${selectedSnapshot}.jpg`;
									link.click();
								}}
							>
								<Download className="h-4 w-4 mr-2" />
								Download
							</Button>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

// ============================================================================
// Timeline View
// ============================================================================

type TimelineSnapshot = {
	id: string;
	eventType: string;
	capturedAt: Date;
	faceDetected: boolean;
	faceConfidence: number | null;
	deviceId: number;
	device: {
		id: number;
		name: string;
	} | null;
	user: {
		id: number;
		name: string;
		username: string;
	} | null;
};

// Constants for timeline
const MS_PER_HOUR = 60 * 60 * 1000;
const ZOOM_LEVELS = [
	{ label: "15m", hours: 0.25, value: 0.25 },
	{ label: "30m", hours: 0.5, value: 0.5 },
	{ label: "1h", hours: 1, value: 1 },
	{ label: "3h", hours: 3, value: 3 },
	{ label: "6h", hours: 6, value: 6 },
	{ label: "12h", hours: 12, value: 12 },
	{ label: "24h", hours: 24, value: 24 },
] as const;
const DEVICE_HEADER_HEIGHT = 36; // Height of device header in pixels
const LOAD_BUFFER_HOURS = 6; // Hours to load beyond visible range

interface FullPageTimelineProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function FullPageTimeline({ open, onOpenChange }: FullPageTimelineProps) {
	const [selectedDevices, setSelectedDevices] = useState<number[]>([]);
	// Center time is the timestamp at the center of the visible timeline
	const [centerTime, setCenterTime] = useState<Date>(() => new Date());
	const [selectedSnapshot, setSelectedSnapshot] =
		useState<TimelineSnapshot | null>(null);
	const [imageCache, setImageCache] = useState<Map<string, string>>(new Map());
	const [visibleHours, setVisibleHours] = useState(6); // Hours visible in the timeline
	const [snapshotCache, setSnapshotCache] = useState<TimelineSnapshot[]>([]);
	const [loadedRange, setLoadedRange] = useState<{
		start: Date;
		end: Date;
	} | null>(null);

	const timelineRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const timelineContainerRef = useRef<HTMLDivElement>(null);
	const isDragging = useRef(false);
	const lastDragY = useRef(0);
	const [timelineHeight, setTimelineHeight] = useState(500);

	// Fetch devices with snapshots
	const { data: devicesData, isLoading: devicesLoading } = useQuery({
		queryKey: ["devicesWithSnapshots"],
		queryFn: async () => {
			return trpc.security.getDevicesWithSnapshots.query({});
		},
	});

	const devices = devicesData?.devices ?? [];

	// Calculate the time range to fetch (with buffer for smooth scrolling)
	const fetchRange = useMemo(() => {
		const bufferMs = LOAD_BUFFER_HOURS * MS_PER_HOUR;
		const visibleMs = visibleHours * MS_PER_HOUR;
		const start = new Date(centerTime.getTime() - visibleMs / 2 - bufferMs);
		const end = new Date(centerTime.getTime() + visibleMs / 2 + bufferMs);
		return { start, end };
	}, [centerTime, visibleHours]);

	// Check if we need to fetch more data
	const needsRefetch = useMemo(() => {
		if (!loadedRange) return true;
		const visibleMs = visibleHours * MS_PER_HOUR;
		const visibleStart = new Date(centerTime.getTime() - visibleMs / 2);
		const visibleEnd = new Date(centerTime.getTime() + visibleMs / 2);
		// Refetch if visible range is close to the edge of loaded range
		const buffer = MS_PER_HOUR * 2;
		return (
			visibleStart.getTime() < loadedRange.start.getTime() + buffer ||
			visibleEnd.getTime() > loadedRange.end.getTime() - buffer
		);
	}, [centerTime, visibleHours, loadedRange]);

	// Fetch timeline snapshots
	const { isFetching } = useQuery({
		queryKey: [
			"timelineSnapshots",
			selectedDevices,
			fetchRange.start.toISOString(),
			fetchRange.end.toISOString(),
		],
		queryFn: async () => {
			const result = await trpc.security.getTimelineSnapshots.query({
				deviceIds: selectedDevices,
				startDate: fetchRange.start,
				endDate: fetchRange.end,
			});
			// Update cache with new snapshots
			setSnapshotCache((prev) => {
				const newSnapshots = result.snapshots as TimelineSnapshot[];
				const existingIds = new Set(prev.map((s) => s.id));
				const uniqueNew = newSnapshots.filter((s) => !existingIds.has(s.id));
				// Merge and sort by time
				const merged = [...prev, ...uniqueNew].sort(
					(a, b) =>
						new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
				);
				// Keep only snapshots within a reasonable range (last 7 days + buffer)
				const cutoff = new Date(Date.now() - 7 * 24 * MS_PER_HOUR);
				return merged.filter(
					(s) => new Date(s.capturedAt).getTime() > cutoff.getTime(),
				);
			});
			setLoadedRange({ start: fetchRange.start, end: fetchRange.end });
			return result;
		},
		enabled: selectedDevices.length > 0 && needsRefetch,
		staleTime: 30000,
	});

	// Get visible snapshots from cache
	const visibleSnapshots = useMemo(() => {
		const visibleMs = visibleHours * MS_PER_HOUR;
		const start = centerTime.getTime() - visibleMs / 2;
		const end = centerTime.getTime() + visibleMs / 2;
		return snapshotCache.filter((s) => {
			const time = new Date(s.capturedAt).getTime();
			return time >= start && time <= end;
		});
	}, [snapshotCache, centerTime, visibleHours]);

	// Get snapshots that need images loaded
	const snapshotsNeedingImages = useMemo(() => {
		if (!selectedSnapshot) return [];
		const ids = [selectedSnapshot.id];
		const idx = visibleSnapshots.findIndex((s) => s.id === selectedSnapshot.id);
		if (idx > 0) ids.push(visibleSnapshots[idx - 1].id);
		if (idx < visibleSnapshots.length - 1)
			ids.push(visibleSnapshots[idx + 1].id);
		return ids.filter((id) => !imageCache.has(id));
	}, [selectedSnapshot, visibleSnapshots, imageCache]);

	// Batch load images
	const { data: newImages } = useQuery({
		queryKey: ["timelineImages", ...snapshotsNeedingImages],
		queryFn: async () => {
			const results: Record<string, string> = {};
			await Promise.all(
				snapshotsNeedingImages.map(async (snapshotId) => {
					try {
						const imageData = await trpc.security.getImage.query({
							snapshotId,
						});
						if (imageData?.imageData) {
							results[snapshotId] = imageData.imageData;
						}
					} catch (err) {
						console.error(`Failed to load image for ${snapshotId}:`, err);
					}
				}),
			);
			return results;
		},
		enabled: snapshotsNeedingImages.length > 0,
		staleTime: Number.POSITIVE_INFINITY,
	});

	// Update cache with new images
	useEffect(() => {
		if (newImages && Object.keys(newImages).length > 0) {
			setImageCache((prev) => {
				const next = new Map(prev);
				for (const [id, data] of Object.entries(newImages)) {
					next.set(id, data);
				}
				return next;
			});
		}
	}, [newImages]);

	// Measure timeline container height directly for accurate sizing
	useEffect(() => {
		if (!timelineContainerRef.current) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const height = entry.contentRect.height;
				if (height > 0) {
					setTimelineHeight(height);
				}
			}
		});

		observer.observe(timelineContainerRef.current);
		return () => observer.disconnect();
	}, []);

	// Group snapshots by device
	const snapshotsByDevice = useMemo(() => {
		const grouped = new Map<number, TimelineSnapshot[]>();
		for (const snapshot of visibleSnapshots) {
			const deviceId = snapshot.deviceId;
			if (!grouped.has(deviceId)) {
				grouped.set(deviceId, []);
			}
			grouped.get(deviceId)?.push(snapshot);
		}
		return grouped;
	}, [visibleSnapshots]);

	// Convert timestamp to Y position in timeline
	const timeToY = useCallback(
		(date: Date) => {
			const visibleMs = visibleHours * MS_PER_HOUR;
			const startTime = centerTime.getTime() - visibleMs / 2;
			const relativeMs = date.getTime() - startTime;
			return (relativeMs / visibleMs) * timelineHeight;
		},
		[centerTime, visibleHours, timelineHeight],
	);

	// Cluster nearby events for performance (group events within N pixels of each other)
	const CLUSTER_THRESHOLD_PX = 6; // Minimum pixels between events before clustering
	const clusteredSnapshotsByDevice = useMemo(() => {
		const clustered = new Map<
			number,
			{ snapshots: TimelineSnapshot[]; y: number; height: number }[]
		>();

		for (const [deviceId, snapshots] of snapshotsByDevice) {
			if (snapshots.length === 0) {
				clustered.set(deviceId, []);
				continue;
			}

			// Sort by time (most recent first based on Y position)
			const sortedSnapshots = [...snapshots].sort(
				(a, b) =>
					new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
			);

			const clusters: {
				snapshots: TimelineSnapshot[];
				y: number;
				height: number;
			}[] = [];
			let currentCluster: TimelineSnapshot[] = [sortedSnapshots[0]];
			let clusterStartY = timeToY(new Date(sortedSnapshots[0].capturedAt));
			let clusterEndY = clusterStartY;

			for (let i = 1; i < sortedSnapshots.length; i++) {
				const snapshot = sortedSnapshots[i];
				const y = timeToY(new Date(snapshot.capturedAt));

				// If this event is close to the current cluster, add it
				if (Math.abs(y - clusterEndY) <= CLUSTER_THRESHOLD_PX) {
					currentCluster.push(snapshot);
					clusterEndY = y;
				} else {
					// Save current cluster and start a new one
					const minY = Math.min(clusterStartY, clusterEndY);
					const maxY = Math.max(clusterStartY, clusterEndY);
					clusters.push({
						snapshots: currentCluster,
						y: minY,
						height: Math.max(8, maxY - minY + 8), // Minimum 8px height
					});
					currentCluster = [snapshot];
					clusterStartY = y;
					clusterEndY = y;
				}
			}

			// Don't forget the last cluster
			const minY = Math.min(clusterStartY, clusterEndY);
			const maxY = Math.max(clusterStartY, clusterEndY);
			clusters.push({
				snapshots: currentCluster,
				y: minY,
				height: Math.max(8, maxY - minY + 8),
			});

			clustered.set(deviceId, clusters);
		}

		return clustered;
	}, [snapshotsByDevice, timeToY]);

	// Convert Y position to timestamp
	const yToTime = useCallback(
		(y: number) => {
			const visibleMs = visibleHours * MS_PER_HOUR;
			const startTime = centerTime.getTime() - visibleMs / 2;
			const relativeMs = (y / timelineHeight) * visibleMs;
			return new Date(startTime + relativeMs);
		},
		[centerTime, visibleHours, timelineHeight],
	);

	// Handle timeline click - find closest snapshot
	const handleTimelineClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>, deviceId: number) => {
			if (isDragging.current) return;

			const rect = e.currentTarget.getBoundingClientRect();
			const y = e.clientY - rect.top;
			const clickedTime = yToTime(y);

			const deviceSnapshots = snapshotsByDevice.get(deviceId) ?? [];
			if (deviceSnapshots.length === 0) return;

			let closest = deviceSnapshots[0];
			let minDiff = Math.abs(
				new Date(closest.capturedAt).getTime() - clickedTime.getTime(),
			);

			for (const snapshot of deviceSnapshots) {
				const diff = Math.abs(
					new Date(snapshot.capturedAt).getTime() - clickedTime.getTime(),
				);
				if (diff < minDiff) {
					minDiff = diff;
					closest = snapshot;
				}
			}

			setSelectedSnapshot(closest);
		},
		[yToTime, snapshotsByDevice],
	);

	// Handle scroll/drag on timeline
	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		isDragging.current = true;
		lastDragY.current = e.clientY;
	}, []);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!isDragging.current) return;

			const deltaY = e.clientY - lastDragY.current;
			lastDragY.current = e.clientY;

			// Convert pixel delta to time delta
			const visibleMs = visibleHours * MS_PER_HOUR;
			const msPerPixel = visibleMs / timelineHeight;
			const deltaMs = deltaY * msPerPixel;

			// Update state directly for real-time responsiveness
			setCenterTime((prev) => {
				const now = Date.now();
				let newTimeMs = prev.getTime() - deltaMs;
				if (newTimeMs > now) newTimeMs = now;
				return new Date(newTimeMs);
			});
		},
		[visibleHours, timelineHeight],
	);

	const handleMouseUp = useCallback(() => {
		setTimeout(() => {
			isDragging.current = false;
		}, 50);
	}, []);

	// Handle wheel scroll
	const handleWheel = useCallback(
		(e: React.WheelEvent) => {
			e.preventDefault();
			const visibleMs = visibleHours * MS_PER_HOUR;
			const msPerPixel = visibleMs / timelineHeight;
			const deltaMs = e.deltaY * msPerPixel * 0.5;

			// Update state directly for real-time responsiveness
			setCenterTime((prev) => {
				const now = Date.now();
				let newTimeMs = prev.getTime() + deltaMs;
				if (newTimeMs > now) newTimeMs = now;
				return new Date(newTimeMs);
			});
		},
		[visibleHours, timelineHeight],
	);

	// Toggle device selection
	const toggleDevice = (deviceId: number) => {
		setSelectedDevices((prev) =>
			prev.includes(deviceId)
				? prev.filter((id) => id !== deviceId)
				: [...prev, deviceId],
		);
	};

	// Select all devices
	const selectAllDevices = () => {
		setSelectedDevices(devices.map((d) => d.id));
	};

	// Get grid class based on number of selected devices
	const getGridClass = () => {
		const count = selectedDevices.length;
		if (count === 1) return "grid-cols-1";
		if (count === 2) return "grid-cols-2";
		if (count <= 4) return "grid-cols-2";
		if (count <= 6) return "grid-cols-3";
		return "grid-cols-4";
	};

	// Generate time markers
	const timeMarkers = useMemo(() => {
		const markers: {
			time: Date;
			label: string;
			y: number;
			isDateBoundary: boolean;
		}[] = [];
		const visibleMs = visibleHours * MS_PER_HOUR;
		const startTime = new Date(centerTime.getTime() - visibleMs / 2);
		const endTime = new Date(centerTime.getTime() + visibleMs / 2);

		// Determine interval based on zoom level (in minutes)
		let intervalMinutes: number;
		if (visibleHours >= 24)
			intervalMinutes = 360; // 6 hours
		else if (visibleHours >= 12)
			intervalMinutes = 180; // 3 hours
		else if (visibleHours >= 6)
			intervalMinutes = 120; // 2 hours
		else if (visibleHours >= 3)
			intervalMinutes = 60; // 1 hour
		else if (visibleHours >= 1)
			intervalMinutes = 30; // 30 min
		else if (visibleHours >= 0.5)
			intervalMinutes = 15; // 15 min
		else intervalMinutes = 5; // 5 min for very zoomed in

		const intervalMs = intervalMinutes * 60 * 1000;

		// Round start time down to nearest interval
		const firstMarkerTime = new Date(
			Math.floor(startTime.getTime() / intervalMs) * intervalMs,
		);

		let currentTime = firstMarkerTime;
		while (currentTime.getTime() <= endTime.getTime()) {
			const y = timeToY(currentTime);
			if (y >= 0 && y <= timelineHeight) {
				const isDateBoundary =
					currentTime.getHours() === 0 && currentTime.getMinutes() === 0;
				const hours = currentTime.getHours();
				const minutes = currentTime.getMinutes();

				let label: string;
				if (isDateBoundary) {
					label = currentTime.toLocaleDateString(undefined, {
						month: "short",
						day: "numeric",
					});
				} else {
					label = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
				}

				markers.push({
					time: new Date(currentTime),
					label,
					y,
					isDateBoundary,
				});
			}
			currentTime = new Date(currentTime.getTime() + intervalMs);
		}
		return markers;
	}, [centerTime, visibleHours, timelineHeight, timeToY]);

	// Handle zoom change
	const handleZoomChange = (newVisibleHours: number) => {
		setVisibleHours(newVisibleHours);
	};

	// Jump to now
	const jumpToNow = () => {
		setCenterTime(new Date());
	};

	// Count loaded snapshots for display
	const loadedCount = snapshotCache.length;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogPortal>
				<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
				<DialogPrimitive.Content
					data-slot="dialog-content"
					className="!fixed !inset-0 !max-w-none !w-screen !h-screen !p-0 !gap-0 !rounded-none !border-0 !translate-x-0 !translate-y-0 !top-0 !left-0 overflow-hidden z-50 bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right duration-300"
					onInteractOutside={(e) => e.preventDefault()}
					onPointerDownOutside={(e) => e.preventDefault()}
				>
					<div
						ref={containerRef}
						className="flex flex-col h-screen w-screen bg-background"
					>
						{/* Fixed Header */}
						<header className="shrink-0 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 z-10">
							<div className="flex items-center justify-between px-4 py-3">
								<div className="flex items-center gap-3">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => onOpenChange(false)}
										className="shrink-0"
									>
										<ChevronLeft className="h-5 w-5" />
									</Button>
									<div>
										<h1 className="text-lg font-semibold">Security Timeline</h1>
										<p className="text-xs text-muted-foreground">
											{visibleSnapshots.length} visible • {loadedCount} loaded
										</p>
									</div>
								</div>

								<div className="flex items-center gap-2">
									{/* Current time indicator */}
									<div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
										<Clock className="h-4 w-4 text-muted-foreground" />
										<span className="font-medium text-sm">
											{centerTime.toLocaleString(undefined, {
												month: "short",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</span>
									</div>
									<Button variant="outline" size="sm" onClick={jumpToNow}>
										Now
									</Button>

									{/* Zoom Controls */}
									<div className="flex items-center gap-1 border rounded-md">
										{ZOOM_LEVELS.map((level) => (
											<Button
												key={level.value}
												variant={
													visibleHours === level.value ? "secondary" : "ghost"
												}
												size="sm"
												className="px-2 rounded-none first:rounded-l-md last:rounded-r-md"
												onClick={() => handleZoomChange(level.value)}
											>
												{level.label}
											</Button>
										))}
									</div>
								</div>
							</div>
						</header>

						{/* Device Checkboxes */}
						<div className="shrink-0 border-b px-4 py-2 bg-muted/30">
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-sm text-muted-foreground mr-2">
									Devices:
								</span>
								<Button
									variant="outline"
									size="sm"
									className="h-7"
									onClick={selectAllDevices}
								>
									All
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="h-7"
									onClick={() => setSelectedDevices([])}
								>
									Clear
								</Button>
								<div className="h-4 w-px bg-border mx-2" />
								{devicesLoading ? (
									<Loader2Icon className="h-4 w-4 animate-spin" />
								) : (
									devices.map((device) => (
										<Label
											key={device.id}
											className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-md hover:bg-muted transition-colors text-sm"
										>
											<Checkbox
												checked={selectedDevices.includes(device.id)}
												onCheckedChange={() => toggleDevice(device.id)}
											/>
											<span className="font-medium">{device.name}</span>
											<Badge
												variant="secondary"
												className="text-xs px-1.5 py-0 h-5"
											>
												{device.snapshotCount}
											</Badge>
										</Label>
									))
								)}
							</div>
						</div>

						{/* Main Content */}
						<div className="flex-1 flex min-h-0">
							{/* Loading state */}
							{isFetching && selectedDevices.length > 0 && (
								<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-background/95 rounded-lg shadow-lg border">
									<Loader2Icon className="h-4 w-4 animate-spin" />
									<span className="text-sm">Loading snapshots...</span>
								</div>
							)}

							{selectedDevices.length === 0 ? (
								<div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
									<Camera className="h-16 w-16 mb-4 opacity-50" />
									<p className="text-lg font-medium">
										Select devices to view timeline
									</p>
									<p className="text-sm">
										Choose one or more devices from the bar above
									</p>
								</div>
							) : devices.length === 0 ? (
								<div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
									<Camera className="h-16 w-16 mb-4 opacity-50" />
									<p className="text-lg font-medium">
										No devices with snapshots
									</p>
								</div>
							) : (
								<div className="flex-1 flex gap-3 p-3 min-h-0 overflow-hidden">
									{/* Timeline Labels */}
									<div className="flex-shrink-0 w-16 flex flex-col min-h-0">
										{/* Spacer for device header alignment */}
										<div
											style={{ height: DEVICE_HEADER_HEIGHT }}
											className="flex-shrink-0"
										/>
										{/* Time labels - fills remaining space */}
										<div
											ref={timelineContainerRef}
											className="relative border-r flex-1 min-h-0"
										>
											{timeMarkers.map((marker, idx) => (
												<div
													key={idx}
													className={cn(
														"absolute right-2 text-xs whitespace-nowrap",
														marker.isDateBoundary
															? "text-foreground font-semibold"
															: "text-muted-foreground",
													)}
													style={{
														top: marker.y,
														transform: "translateY(-50%)",
													}}
												>
													{marker.label}
												</div>
											))}
										</div>
									</div>

									{/* Device Columns with Events */}
									<div
										className={cn(
											"flex-1 grid gap-2 min-w-0 min-h-0",
											getGridClass(),
										)}
									>
										{selectedDevices.map((deviceId) => {
											const device = devices.find((d) => d.id === deviceId);
											const deviceClusters =
												clusteredSnapshotsByDevice.get(deviceId) ?? [];

											return (
												<div key={deviceId} className="flex flex-col min-h-0">
													{/* Device Header */}
													<div
														className="text-sm font-medium text-center py-2 bg-muted rounded-t-lg flex-shrink-0"
														style={{ height: DEVICE_HEADER_HEIGHT }}
													>
														{device?.name ?? `Device ${deviceId}`}
													</div>

													{/* Timeline Column - fills remaining height via flex-1 */}
													{/* biome-ignore lint/a11y/useKeyWithClickEvents: Timeline interaction requires mouse position */}
													{/* biome-ignore lint/a11y/noStaticElementInteractions: Timeline requires click for position-based interaction */}
													<div
														ref={timelineRef}
														className="relative bg-muted/30 rounded-b-lg border cursor-grab active:cursor-grabbing overflow-hidden select-none flex-1 min-h-0"
														onClick={(e) => handleTimelineClick(e, deviceId)}
														onMouseDown={handleMouseDown}
														onMouseMove={handleMouseMove}
														onMouseUp={handleMouseUp}
														onMouseLeave={handleMouseUp}
														onWheel={handleWheel}
													>
														{/* Time grid lines */}
														{timeMarkers.map((marker, idx) => (
															<div
																key={idx}
																className={cn(
																	"absolute left-0 right-0",
																	marker.isDateBoundary
																		? "border-t-2 border-primary/50"
																		: "border-t border-muted",
																)}
																style={{ top: marker.y }}
															/>
														))}

														{/* Event markers (clustered for performance) */}
														{deviceClusters.map((cluster, clusterIdx) => {
															// Skip clusters outside visible area
															if (
																cluster.y + cluster.height < -10 ||
																cluster.y > timelineHeight + 10
															)
																return null;

															const isCluster = cluster.snapshots.length > 1;
															const hasSelectedSnapshot =
																cluster.snapshots.some(
																	(s) => selectedSnapshot?.id === s.id,
																);
															const firstSnapshot = cluster.snapshots[0];

															return (
																<button
																	type="button"
																	key={`cluster-${clusterIdx}-${firstSnapshot.id}`}
																	className={cn(
																		"absolute left-1 right-1 rounded-sm transition-all cursor-pointer",
																		"bg-orange-500 hover:bg-orange-400",
																		hasSelectedSnapshot &&
																			"ring-2 ring-orange-300 bg-orange-600",
																		isCluster &&
																			"bg-gradient-to-b from-orange-400 to-orange-600",
																	)}
																	style={{
																		top: Math.max(
																			0,
																			Math.min(
																				cluster.y - 4,
																				timelineHeight - cluster.height,
																			),
																		),
																		height: cluster.height,
																	}}
																	onClick={(e) => {
																		e.stopPropagation();
																		// Select the most recent snapshot in the cluster
																		const mostRecent = cluster.snapshots.reduce(
																			(a, b) =>
																				new Date(a.capturedAt).getTime() >
																				new Date(b.capturedAt).getTime()
																					? a
																					: b,
																		);
																		setSelectedSnapshot(mostRecent);
																	}}
																	title={
																		isCluster
																			? `${cluster.snapshots.length} events clustered`
																			: `${new Date(firstSnapshot.capturedAt).toLocaleString()} - ${eventTypeLabels[firstSnapshot.eventType] ?? firstSnapshot.eventType}`
																	}
																>
																	{isCluster && cluster.height >= 16 && (
																		<span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
																			{cluster.snapshots.length}
																		</span>
																	)}
																</button>
															);
														})}
													</div>
												</div>
											);
										})}
									</div>

									{/* Preview Panel */}
									<div className="flex-shrink-0 w-80">
										<Card className="h-full overflow-auto">
											<CardHeader className="pb-2">
												<CardTitle className="text-base">Preview</CardTitle>
												{selectedSnapshot && (
													<CardDescription>
														{new Date(
															selectedSnapshot.capturedAt,
														).toLocaleString()}
													</CardDescription>
												)}
											</CardHeader>
											<CardContent>
												{selectedSnapshot ? (
													<div className="flex flex-col gap-4">
														{/* Image */}
														<div className="aspect-video bg-muted rounded-lg overflow-hidden">
															{imageCache.has(selectedSnapshot.id) ? (
																<img
																	src={imageCache.get(selectedSnapshot.id)}
																	alt="Security snapshot"
																	className="w-full h-full object-cover"
																/>
															) : (
																<div className="flex items-center justify-center h-full">
																	<Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
																</div>
															)}
														</div>

														{/* Details */}
														<div className="space-y-2">
															<div className="flex items-center justify-between">
																<span className="text-sm text-muted-foreground">
																	Event
																</span>
																<Badge
																	className={
																		eventTypeColors[
																			selectedSnapshot.eventType
																		] ?? "bg-gray-500"
																	}
																>
																	{eventTypeLabels[
																		selectedSnapshot.eventType
																	] ?? selectedSnapshot.eventType}
																</Badge>
															</div>

															<div className="flex items-center justify-between">
																<span className="text-sm text-muted-foreground">
																	Device
																</span>
																<span className="text-sm font-medium">
																	{selectedSnapshot.device?.name ?? "Unknown"}
																</span>
															</div>

															{selectedSnapshot.user && (
																<div className="flex items-center justify-between">
																	<span className="text-sm text-muted-foreground">
																		User
																	</span>
																	<div className="flex items-center gap-2">
																		<User className="h-4 w-4 text-muted-foreground" />
																		<span className="text-sm font-medium">
																			{selectedSnapshot.user.name}
																		</span>
																	</div>
																</div>
															)}

															<div className="flex items-center justify-between">
																<span className="text-sm text-muted-foreground">
																	Face Detected
																</span>
																<Badge
																	variant="outline"
																	className={
																		selectedSnapshot.faceDetected
																			? "text-green-600 border-green-600"
																			: "text-muted-foreground"
																	}
																>
																	{selectedSnapshot.faceDetected
																		? `Yes ${selectedSnapshot.faceConfidence !== null ? `(${Math.round(selectedSnapshot.faceConfidence * 100)}%)` : ""}`
																		: "No"}
																</Badge>
															</div>
														</div>

														{/* Actions */}
														{imageCache.has(selectedSnapshot.id) && (
															<Button
																variant="outline"
																className="w-full"
																onClick={() => {
																	const link = document.createElement("a");
																	link.href =
																		imageCache.get(selectedSnapshot.id) ?? "";
																	link.download = `snapshot-${selectedSnapshot.id}.jpg`;
																	link.click();
																}}
															>
																<Download className="h-4 w-4 mr-2" />
																Download
															</Button>
														)}

														{/* Navigation */}
														<div className="flex gap-2">
															<Button
																variant="outline"
																size="sm"
																className="flex-1"
																onClick={() => {
																	const idx = snapshotCache.findIndex(
																		(s) => s.id === selectedSnapshot.id,
																	);
																	if (idx < snapshotCache.length - 1) {
																		setSelectedSnapshot(snapshotCache[idx + 1]);
																	}
																}}
																disabled={
																	snapshotCache.findIndex(
																		(s) => s.id === selectedSnapshot.id,
																	) >=
																	snapshotCache.length - 1
																}
															>
																<ChevronLeft className="h-4 w-4 mr-1" />
																Older
															</Button>
															<Button
																variant="outline"
																size="sm"
																className="flex-1"
																onClick={() => {
																	const idx = snapshotCache.findIndex(
																		(s) => s.id === selectedSnapshot.id,
																	);
																	if (idx > 0) {
																		setSelectedSnapshot(snapshotCache[idx - 1]);
																	}
																}}
																disabled={
																	snapshotCache.findIndex(
																		(s) => s.id === selectedSnapshot.id,
																	) <= 0
																}
															>
																Newer
																<ChevronRight className="h-4 w-4 ml-1" />
															</Button>
														</div>
													</div>
												) : (
													<div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
														<Eye className="h-10 w-10 mb-3 opacity-50" />
														<p className="text-xs text-center">
															Drag the timeline or use mouse wheel to scroll.
															Click to select.
														</p>
													</div>
												)}
											</CardContent>
										</Card>
									</div>
								</div>
							)}
						</div>

						{/* Footer with scroll hint */}
						<footer className="shrink-0 border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
							<span>
								Drag timeline to scroll • Use mouse wheel for fine control
							</span>
							<span>
								{visibleSnapshots.length} visible • {snapshotCache.length}{" "}
								loaded
							</span>
						</footer>
					</div>
				</DialogPrimitive.Content>
			</DialogPortal>
		</Dialog>
	);
}

// ============================================================================
// History View (existing table view)
// ============================================================================

function HistorySnapshotsView() {
	const { user } = useAuth();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [selectedEventType, setSelectedEventType] = useState<string | null>(
		null,
	);
	const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
	const [userSearch, setUserSearch] = useState("");
	const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
	const [imageDialogOpen, setImageDialogOpen] = useState(false);

	const canDelete = user && checkPermissions(user, ["security.delete"]);

	const {
		data: snapshotsData,
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: [
			"securitySnapshots",
			page,
			pageSize,
			selectedEventType,
			selectedDevice,
			userSearch,
		],
		queryFn: async () => {
			return trpc.security.listSnapshots.query({
				page,
				pageSize,
				...(selectedEventType &&
					selectedEventType !== "all" && {
						eventType: selectedEventType as
							| "TAP"
							| "FACE_ID"
							| "FACE_ID_ENROLLMENT",
					}),
				...(selectedDevice &&
					selectedDevice !== "all" && {
						deviceId: Number.parseInt(selectedDevice, 10),
					}),
				...(userSearch && { userSearch }),
			});
		},
		refetchInterval: 30000,
	});

	// Fetch devices for filter
	const { data: devicesData } = useQuery({
		queryKey: ["devices"],
		queryFn: async () => {
			return trpc.devices.list.query({ limit: 100, offset: 0 });
		},
	});

	// Fetch image for selected snapshot
	const { data: imageData, isLoading: imageLoading } = useQuery({
		queryKey: ["securitySnapshotImage", selectedSnapshot],
		queryFn: async () => {
			if (!selectedSnapshot) return null;
			return trpc.security.getImage.query({ snapshotId: selectedSnapshot });
		},
		enabled: !!selectedSnapshot && imageDialogOpen,
	});

	const snapshots = snapshotsData?.snapshots ?? [];
	const offset = (page - 1) * pageSize;
	const total = snapshotsData?.pagination.totalCount ?? 0;
	const { totalPages } = usePaginationInfo({
		total,
		pageSize,
		offset,
		currentCount: snapshots.length,
	});

	const handleViewImage = (snapshotId: string) => {
		setSelectedSnapshot(snapshotId);
		setImageDialogOpen(true);
	};

	const handleDeleteSnapshot = async (snapshotId: string) => {
		if (!confirm("Are you sure you want to delete this snapshot?")) return;

		try {
			await trpc.security.deleteSnapshot.mutate({ snapshotId });
			refetch();
		} catch (error) {
			console.error("Failed to delete snapshot:", error);
		}
	};

	const columns: ColumnDef<SecuritySnapshot>[] = [
		{
			accessorKey: "capturedAt",
			header: "Time",
			cell: ({ row }) => {
				const date = new Date(row.original.capturedAt);
				return (
					<div className="flex flex-col">
						<span className="font-medium">{date.toLocaleDateString()}</span>
						<span className="text-sm text-muted-foreground">
							{date.toLocaleTimeString()}
						</span>
					</div>
				);
			},
		},
		{
			accessorKey: "eventType",
			header: "Event",
			cell: ({ row }) => {
				const eventType = row.original.eventType;
				return (
					<Badge className={eventTypeColors[eventType] ?? "bg-gray-500"}>
						{eventTypeLabels[eventType] ?? eventType}
					</Badge>
				);
			},
		},
		{
			accessorKey: "user",
			header: "User",
			cell: ({ row }) => {
				const user = row.original.user;
				if (!user) {
					return <span className="text-muted-foreground">Anonymous</span>;
				}
				return (
					<div className="flex items-center gap-2">
						<User className="h-4 w-4 text-muted-foreground" />
						<div className="flex flex-col">
							<span className="font-medium">{user.name}</span>
							<span className="text-sm text-muted-foreground">
								@{user.username}
							</span>
						</div>
					</div>
				);
			},
		},
		{
			accessorKey: "device",
			header: "Device",
			cell: ({ row }) => {
				const device = row.original.device;
				if (!device) {
					return <span className="text-muted-foreground">Unknown</span>;
				}
				return (
					<div className="flex items-center gap-2">
						<Camera className="h-4 w-4 text-muted-foreground" />
						<span>{device.name}</span>
					</div>
				);
			},
		},
		{
			accessorKey: "faceDetected",
			header: "Face Detected",
			cell: ({ row }) => {
				const detected = row.original.faceDetected;
				const confidence = row.original.faceConfidence;
				return (
					<div className="flex items-center gap-2">
						{detected ? (
							<Badge
								variant="outline"
								className="text-green-600 border-green-600"
							>
								Yes{" "}
								{confidence !== null && `(${Math.round(confidence * 100)}%)`}
							</Badge>
						) : (
							<Badge variant="outline" className="text-muted-foreground">
								No
							</Badge>
						)}
					</div>
				);
			},
		},
		{
			id: "actions",
			header: "Actions",
			cell: ({ row }) => {
				return (
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => handleViewImage(row.original.id)}
						>
							<Eye className="h-4 w-4" />
						</Button>
						{canDelete && (
							<Button
								variant="ghost"
								size="icon"
								className="text-destructive hover:text-destructive"
								onClick={() => handleDeleteSnapshot(row.original.id)}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						)}
					</div>
				);
			},
		},
	];

	return (
		<>
			<div className="flex items-center justify-between mb-4">
				{/* Filters */}
				<div className="flex flex-wrap gap-4">
					<Select
						value={selectedEventType ?? "all"}
						onValueChange={(value) => {
							setSelectedEventType(value === "all" ? null : value);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Event Type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Events</SelectItem>
							<SelectItem value="TAP">Tap</SelectItem>
							<SelectItem value="FACE_ID">Face ID</SelectItem>
							<SelectItem value="FACE_ID_ENROLLMENT">
								Face ID Enrollment
							</SelectItem>
						</SelectContent>
					</Select>

					<Select
						value={selectedDevice ?? "all"}
						onValueChange={(value) => {
							setSelectedDevice(value === "all" ? null : value);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Device" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Devices</SelectItem>
							{devicesData?.devices.map((device) => (
								<SelectItem key={device.id} value={String(device.id)}>
									{device.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by user..."
							value={userSearch}
							onChange={(e) => {
								setUserSearch(e.target.value);
								setPage(1);
							}}
							className="pl-9 w-[200px]"
						/>
					</div>
				</div>

				<Button
					variant="outline"
					onClick={() => refetch()}
					disabled={isFetching}
				>
					{isFetching ? (
						<Loader2Icon className="size-4 animate-spin" />
					) : (
						<RefreshCcwIcon className="size-4" />
					)}
				</Button>
			</div>

			{/* Table */}
			<div className="border rounded-lg">
				<DataTable columns={columns} data={snapshots} isLoading={isLoading} />
			</div>

			{/* Pagination */}
			<TablePaginationFooter
				page={page}
				totalPages={totalPages}
				pageSize={pageSize}
				offset={offset}
				currentCount={snapshots.length}
				total={total}
				itemName="snapshots"
				onPageChange={setPage}
				onPageSizeChange={(newSize) => {
					setPageSize(newSize);
					setPage(1);
				}}
			/>

			{/* Image Preview Dialog */}
			<Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>Security Snapshot</DialogTitle>
						<DialogDescription>
							{imageData && (
								<>
									{eventTypeLabels[imageData.eventType] ?? imageData.eventType}{" "}
									at {new Date(imageData.capturedAt).toLocaleString()}
								</>
							)}
						</DialogDescription>
					</DialogHeader>

					<div className="flex items-center justify-center min-h-[400px] bg-muted rounded-lg">
						{imageLoading ? (
							<Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
						) : imageData?.imageData ? (
							<img
								src={imageData.imageData}
								alt="Security snapshot"
								className="max-w-full max-h-[500px] object-contain rounded-lg"
							/>
						) : (
							<span className="text-muted-foreground">
								Failed to load image
							</span>
						)}
					</div>

					{imageData?.imageData && (
						<div className="flex justify-end">
							<Button
								variant="outline"
								onClick={() => {
									const link = document.createElement("a");
									link.href = imageData.imageData;
									link.download = `snapshot-${selectedSnapshot}.jpg`;
									link.click();
								}}
							>
								<Download className="h-4 w-4 mr-2" />
								Download
							</Button>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

// ============================================================================
// Main Page Component
// ============================================================================

function SecuritySnapshotsPage() {
	const [activeTab, setActiveTab] = useState<"live" | "history">("live");
	const [timelineOpen, setTimelineOpen] = useState(false);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Security Snapshots</PageTitle>
				<PageActions>
					<Button
						variant="outline"
						className="gap-2"
						onClick={() => setTimelineOpen(true)}
					>
						<Maximize2 className="h-4 w-4" />
						Timeline View
					</Button>
				</PageActions>
			</PageHeader>

			<PageContent>
				<Tabs
					value={activeTab}
					onValueChange={(v) => setActiveTab(v as "live" | "history")}
				>
					<TabsList>
						<TabsTrigger value="live" className="gap-2">
							<Radio className="h-4 w-4" />
							Live
						</TabsTrigger>
						<TabsTrigger value="history" className="gap-2">
							<History className="h-4 w-4" />
							History
						</TabsTrigger>
					</TabsList>

					<TabsContent value="live" className="mt-4">
						<LiveSnapshotsView />
					</TabsContent>

					<TabsContent value="history" className="mt-4">
						<HistorySnapshotsView />
					</TabsContent>
				</Tabs>
			</PageContent>

			<FullPageTimeline open={timelineOpen} onOpenChange={setTimelineOpen} />
		</Page>
	);
}
