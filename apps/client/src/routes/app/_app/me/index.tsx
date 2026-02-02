import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, Mail, User } from "lucide-react";
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

	const { data: profileData, isLoading } = useQuery({
		queryKey: ["user", "profile", user?.id],
		queryFn: async () => {
			if (!user?.id) return null;
			return trpc.users.getProfile.query({});
		},
		enabled: !!user?.id,
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
				</div>
			</PageContent>
		</Page>
	);
}
