import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, Mail, ScanFace, Trash2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RequireAuth } from "@/auth";
import { useCurrentUser } from "@/auth/AuthProvider";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/layout";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/_app/me/")({
	component: () => RequireAuth({ children: <UserProfilePage /> }),
});

export const permissions = [] as RequiredPermissions;

function UserProfilePage() {
	const user = useCurrentUser();
	const queryClient = useQueryClient();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	const { data: profileData, isLoading } = useQuery({
		queryKey: ["user", "profile", user?.id],
		queryFn: async () => {
			if (!user?.id) return null;
			return trpc.users.getProfile.query({});
		},
		enabled: !!user?.id,
	});

	const { data: faceIdData, isLoading: isFaceIdLoading } = useQuery({
		queryKey: ["faceId", "myEnrollment", user?.id],
		queryFn: async () => {
			if (!user?.id) return null;
			return trpc.faceId.getMyEnrollment.query();
		},
		enabled: !!user?.id,
	});

	const deleteFaceIdMutation = useMutation({
		mutationFn: async () => trpc.faceId.deleteEnrollment.mutate({}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["faceId", "myEnrollment"] });
			setDeleteDialogOpen(false);
			toast.success("Face ID enrollment deleted successfully");
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : String(err);
			toast.error(`Failed to delete Face ID: ${message}`);
		},
	});

	const formatDate = (date: Date | string | null | undefined) => {
		if (!date) return "Unknown";
		const d = new Date(date);
		return d.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	return (
		<Page>
			<PageHeader>
				<div>
					<PageTitle>My Profile</PageTitle>
					<PageDescription>View your account information</PageDescription>
				</div>
			</PageHeader>

			<PageContent className="max-w-7xl">
				<div className="grid gap-6 md:grid-cols-2 lg:gap-8">
					{/* User Information Card */}
					<Card className="h-fit">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<User className="h-5 w-5" />
								Account Information
							</CardTitle>
							<CardDescription>
								Your personal details and account info
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{isLoading ? (
								<div className="space-y-4">
									<Skeleton className="h-6 w-48" />
									<Skeleton className="h-6 w-64" />
									<Skeleton className="h-6 w-40" />
									<Skeleton className="h-6 w-56" />
								</div>
							) : (
								<>
									<div className="flex flex-col space-y-1">
										<span className="text-sm font-medium text-muted-foreground">
											Display Name
										</span>
										<span className="text-lg">
											{profileData?.name || user?.name || "Not set"}
										</span>
									</div>

									<div className="flex flex-col space-y-1">
										<span className="text-sm font-medium text-muted-foreground">
											Username
										</span>
										<span className="text-lg font-mono">
											{profileData?.username || user?.username}
										</span>
									</div>

									<div className="flex flex-col space-y-1">
										<span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
											<Mail className="h-3 w-3" />
											Email
										</span>
										<span className="text-lg">
											{profileData?.email || user?.email || "Not set"}
										</span>
									</div>

									<div className="flex flex-col space-y-1">
										<span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
											<CalendarClock className="h-3 w-3" />
											Member Since
										</span>
										<span className="text-lg">
											{formatDate(profileData?.createdAt)}
										</span>
									</div>
								</>
							)}
						</CardContent>
					</Card>

					{/* Face ID Card - only show if enrolled */}
					{isFaceIdLoading ? (
						<Card className="h-fit">
							<CardHeader>
								<Skeleton className="h-6 w-32" />
								<Skeleton className="h-4 w-48" />
							</CardHeader>
							<CardContent>
								<Skeleton className="h-10 w-40" />
							</CardContent>
						</Card>
					) : faceIdData?.enrolled ? (
						<Card className="h-fit">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<ScanFace className="h-5 w-5" />
									Face ID
								</CardTitle>
								<CardDescription>
									Manage your Face ID enrollment
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex flex-col space-y-1">
									<span className="text-sm font-medium text-muted-foreground">
										Status
									</span>
									<span className="text-lg text-green-600 dark:text-green-400">
										Enrolled
									</span>
								</div>

								{faceIdData.enrollment?.enrolledAt && (
									<div className="flex flex-col space-y-1">
										<span className="text-sm font-medium text-muted-foreground">
											Enrolled On
										</span>
										<span className="text-lg">
											{formatDate(faceIdData.enrollment.enrolledAt)}
										</span>
									</div>
								)}

								{faceIdData.enrollment?.lastUsedAt && (
									<div className="flex flex-col space-y-1">
										<span className="text-sm font-medium text-muted-foreground">
											Last Used
										</span>
										<span className="text-lg">
											{formatDate(faceIdData.enrollment.lastUsedAt)}
										</span>
									</div>
								)}

								{typeof faceIdData.enrollment?.successfulMatches ===
									"number" && (
									<div className="flex flex-col space-y-1">
										<span className="text-sm font-medium text-muted-foreground">
											Successful Logins
										</span>
										<span className="text-lg">
											{faceIdData.enrollment.successfulMatches}
										</span>
									</div>
								)}

								<div className="pt-4 border-t">
									<AlertDialog
										open={deleteDialogOpen}
										onOpenChange={setDeleteDialogOpen}
									>
										<AlertDialogTrigger asChild>
											<Button variant="destructive" size="sm">
												<Trash2 className="h-4 w-4 mr-2" />
												Delete Face ID Data
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													Delete Face ID Enrollment?
												</AlertDialogTitle>
												<AlertDialogDescription>
													This will permanently delete your Face ID enrollment
													data. You will no longer be able to log in using
													Face ID until you re-enroll at a kiosk.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel
													disabled={deleteFaceIdMutation.isPending}
												>
													Cancel
												</AlertDialogCancel>
												<AlertDialogAction
													className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
													onClick={() => deleteFaceIdMutation.mutate()}
													disabled={deleteFaceIdMutation.isPending}
												>
													{deleteFaceIdMutation.isPending
														? "Deleting..."
														: "Delete Face ID"}
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							</CardContent>
						</Card>
					) : null}
				</div>
			</PageContent>
		</Page>
	);
}
