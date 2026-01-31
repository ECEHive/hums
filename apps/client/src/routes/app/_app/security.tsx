import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
	Camera,
	Download,
	Eye,
	Loader2Icon,
	RefreshCcwIcon,
	Search,
	Trash2,
	User,
} from "lucide-react";
import { useState } from "react";
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
	TAP_IN: "bg-green-500",
	TAP_OUT: "bg-blue-500",
	FACE_ID_LOGIN: "bg-purple-500",
	FACE_ID_ENROLLMENT: "bg-orange-500",
};

const eventTypeLabels: Record<string, string> = {
	TAP_IN: "Tap In",
	TAP_OUT: "Tap Out",
	FACE_ID_LOGIN: "Face ID Login",
	FACE_ID_ENROLLMENT: "Face ID Enrollment",
};

function SecuritySnapshotsPage() {
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
							| "TAP_IN"
							| "TAP_OUT"
							| "FACE_ID_LOGIN"
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
		<Page>
			<PageHeader>
				<PageTitle>Security Snapshots</PageTitle>
				<PageActions>
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
				</PageActions>
			</PageHeader>

			<PageContent>
				{/* Filters */}
				<div className="flex flex-wrap gap-4 mb-4">
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
							<SelectItem value="TAP_IN">Tap In</SelectItem>
							<SelectItem value="TAP_OUT">Tap Out</SelectItem>
							<SelectItem value="FACE_ID_LOGIN">Face ID Login</SelectItem>
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
			</PageContent>

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
		</Page>
	);
}
