import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Banner shown when user has incomplete agreements
 */
export function AgreementsBanner() {
	const { user } = useAuth();

	const { data: agreementStatus } = useQuery({
		queryKey: ["agreementsStatus"],
		queryFn: async () => {
			return await trpc.agreements.getStatus.query({});
		},
		enabled: !!user,
		refetchOnWindowFocus: true,
	});

	// Don't show banner if agreements are complete or not loaded
	if (!agreementStatus || agreementStatus.hasAgreedToAll) {
		return null;
	}

	const count = agreementStatus.missingAgreementIds.length;

	return (
		<Alert variant="destructive" className="mb-4 md:mb-6">
			<AlertCircle className="h-4 w-4" />
			<AlertTitle>Action Required</AlertTitle>
			<AlertDescription className="flex items-center justify-between flex-col sm:flex-row">
				<span>
					You must agree to {count} agreement{count !== 1 ? "s" : ""} before you
					can tap in.
				</span>
				<Button asChild variant="outline" size="sm" className="ml-4">
					<Link to="/app/my-agreements">Review Agreements</Link>
				</Button>
			</AlertDescription>
		</Alert>
	);
}
