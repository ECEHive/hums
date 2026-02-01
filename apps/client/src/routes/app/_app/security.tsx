import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
	Camera,
	Download,
	Eye,
	History,
	Loader2Icon,
	Radio,
	RefreshCcwIcon,
	Search,
	Trash2,
	User,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

	const deviceSnapshots = liveData?.deviceSnapshots ?? [];

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
	const [activeTab, setActiveTab] = useState("live");

	return (
		<Page>
			<PageHeader>
				<PageTitle>Security Snapshots</PageTitle>
				<PageActions />
			</PageHeader>

			<PageContent>
				<Tabs value={activeTab} onValueChange={setActiveTab}>
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
		</Page>
	);
}
