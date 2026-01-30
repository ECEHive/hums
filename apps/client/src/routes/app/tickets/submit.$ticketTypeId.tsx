import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangleIcon,
	CheckCircleIcon,
	ExternalLinkIcon,
	LockIcon,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/shared/logo";
import { DynamicTicketForm, type TicketField } from "@/components/tickets";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/tickets/submit/$ticketTypeId")({
	component: SubmitTicketFormPage,
});

function SubmitTicketFormPage() {
	const { ticketTypeId } = Route.useParams();
	const { user, status: authStatus } = useAuth();
	const _navigate = useNavigate();
	const [showSuccessDialog, setShowSuccessDialog] = useState(false);
	const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(
		null,
	);
	const [serverError, setServerError] = useState<string | null>(null);

	// Parse ticket type ID
	const parsedId = Number.parseInt(ticketTypeId, 10);
	const isValidId = !Number.isNaN(parsedId) && parsedId > 0;

	// Fetch the ticket type details
	const {
		data: ticketType,
		isLoading: isLoadingType,
		error: typeError,
	} = useQuery({
		queryKey: ["ticket-type", parsedId],
		queryFn: async () => {
			return await trpc.tickets.types.get.query({ id: parsedId });
		},
		enabled: isValidId,
	});

	const submitMutation = useMutation({
		mutationFn: async (data: Record<string, unknown>) => {
			if (!ticketType) throw new Error("Ticket type not loaded");
			return await trpc.tickets.submit.mutate({
				ticketTypeId: ticketType.id,
				data,
			});
		},
		onSuccess: (result) => {
			setSubmittedTicketId(result.id);
			setShowSuccessDialog(true);
		},
		onError: (err) => {
			setServerError(err instanceof Error ? err.message : String(err));
		},
	});

	// Check if authentication is required and user is not authenticated
	const requiresAuth = ticketType?.requiresAuth ?? false;
	const isAuthenticated = authStatus === "authenticated" && user !== null;
	const needsLogin = requiresAuth && !isAuthenticated;

	// Invalid ID
	if (!isValidId) {
		return (
			<div className="min-h-screen bg-background flex flex-col">
				<header className="border-b">
					<div className="container mx-auto px-4 py-4">
						<Logo className="h-8" />
					</div>
				</header>
				<main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
					<Alert variant="destructive">
						<AlertTriangleIcon className="h-4 w-4" />
						<AlertTitle>Invalid Ticket Type</AlertTitle>
						<AlertDescription>
							The ticket type ID provided is not valid.
						</AlertDescription>
					</Alert>
					<div className="mt-4">
						<Link to="/app/tickets/submit">
							<Button variant="outline">Back to Ticket Types</Button>
						</Link>
					</div>
				</main>
			</div>
		);
	}

	if (isLoadingType) {
		return (
			<div className="min-h-screen bg-background flex flex-col">
				<header className="border-b">
					<div className="container mx-auto px-4 py-4">
						<Logo className="h-8" />
					</div>
				</header>
				<main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
					<Skeleton className="h-8 w-64 mb-2" />
					<Skeleton className="h-4 w-96 mb-8" />
					<Card>
						<CardContent className="p-6">
							<div className="space-y-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-24 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
						</CardContent>
					</Card>
				</main>
			</div>
		);
	}

	if (typeError || !ticketType) {
		return (
			<div className="min-h-screen bg-background flex flex-col">
				<header className="border-b">
					<div className="container mx-auto px-4 py-4">
						<Logo className="h-8" />
					</div>
				</header>
				<main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
					<Alert variant="destructive">
						<AlertTriangleIcon className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>
							{typeError instanceof Error
								? typeError.message
								: "Failed to load ticket type. Please try again later."}
						</AlertDescription>
					</Alert>
					<div className="mt-4">
						<Link to="/app/tickets/submit">
							<Button variant="outline">Back to Ticket Types</Button>
						</Link>
					</div>
				</main>
			</div>
		);
	}

	// Get fields from ticket type
	const fields: TicketField[] =
		ticketType.fieldSchema &&
		typeof ticketType.fieldSchema === "object" &&
		"fields" in ticketType.fieldSchema &&
		Array.isArray((ticketType.fieldSchema as { fields: unknown }).fields)
			? (ticketType.fieldSchema as { fields: TicketField[] }).fields
			: [];

	// Check if there are no fields defined
	const hasNoFields = fields.length === 0;

	// If login is required, show login prompt
	if (needsLogin) {
		const loginUrl = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
		return (
			<div className="min-h-screen bg-background flex flex-col">
				<header className="border-b">
					<div className="container mx-auto px-4 py-4">
						<Logo className="h-8" />
					</div>
				</header>
				<main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
					<h1 className="text-2xl font-bold mb-2">{ticketType.name}</h1>
					{ticketType.description && (
						<p className="text-muted-foreground mb-8">
							{ticketType.description}
						</p>
					)}
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<LockIcon className="h-5 w-5 text-muted-foreground" />
								<CardTitle>Login Required</CardTitle>
							</div>
							<CardDescription>
								This ticket type requires you to be logged in to submit.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground mb-4">
								Please log in to continue with your submission. Your submission
								will be associated with your account.
							</p>
							<a href={loginUrl}>
								<Button className="w-full">
									<LockIcon className="mr-2 h-4 w-4" />
									Log in to Continue
								</Button>
							</a>
						</CardContent>
					</Card>
				</main>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background flex flex-col">
			<header className="border-b">
				<div className="container mx-auto px-4 py-4 flex items-center justify-between">
					<Logo className="h-8" />
					{isAuthenticated && (
						<span className="text-sm text-muted-foreground">
							Logged in as {user?.name || user?.email}
						</span>
					)}
				</div>
			</header>
			<main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
				<h1 className="text-2xl font-bold mb-2">{ticketType.name}</h1>
				{ticketType.description && (
					<p className="text-muted-foreground mb-8">{ticketType.description}</p>
				)}

				{serverError && (
					<Alert variant="destructive" className="mb-4">
						<AlertTriangleIcon className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{serverError}</AlertDescription>
					</Alert>
				)}

				<Card>
					<CardContent className="p-6">
						{hasNoFields ? (
							<Alert>
								<AlertTriangleIcon className="h-4 w-4" />
								<AlertTitle>No Form Fields</AlertTitle>
								<AlertDescription>
									This ticket type doesn't have any form fields configured.
									Please contact an administrator.
								</AlertDescription>
							</Alert>
						) : (
							<DynamicTicketForm
								fields={fields}
								onSubmit={(data) => {
									setServerError(null);
									submitMutation.mutate(data);
								}}
								isSubmitting={submitMutation.isPending}
								submitButtonText="Submit Ticket"
							/>
						)}
					</CardContent>
				</Card>
			</main>

			{/* Success Dialog */}
			<Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<div className="flex items-center gap-2">
							<CheckCircleIcon className="h-6 w-6 text-green-500" />
							<DialogTitle>Ticket Submitted Successfully!</DialogTitle>
						</div>
						<DialogDescription>
							Your {ticketType.name.toLowerCase()} has been submitted.
							{isAuthenticated &&
								" You will receive a confirmation email shortly."}
						</DialogDescription>
					</DialogHeader>
					{submittedTicketId && (
						<div className="bg-muted p-3 rounded-md">
							<p className="text-sm text-muted-foreground">Ticket ID:</p>
							<p className="font-mono text-sm">{submittedTicketId}</p>
						</div>
					)}
					<DialogFooter className="flex-col gap-2 sm:flex-col">
						{isAuthenticated ? (
							<>
								<Link to="/app/tickets/my-tickets" className="w-full">
									<Button className="w-full">View My Tickets</Button>
								</Link>
								<Button
									variant="outline"
									className="w-full"
									onClick={() => {
										setShowSuccessDialog(false);
										setSubmittedTicketId(null);
									}}
								>
									Submit Another Ticket
								</Button>
							</>
						) : (
							<>
								<a href="/login" className="w-full">
									<Button className="w-full">
										<ExternalLinkIcon className="mr-2 h-4 w-4" />
										Log in to HUMS
									</Button>
								</a>
								<Button
									variant="outline"
									className="w-full"
									onClick={() => {
										setShowSuccessDialog(false);
										setSubmittedTicketId(null);
									}}
								>
									Submit Another Ticket
								</Button>
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
