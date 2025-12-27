import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, FileTextIcon } from "lucide-react";
import { useId, useState } from "react";
import { RequireAuth } from "@/auth/AuthProvider";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/layout";
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
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/app/my-agreements")({
	component: () => <RequireAuth>{<MyAgreements />}</RequireAuth>,
});

function MyAgreements() {
	const queryClient = useQueryClient();
	const checkboxId = useId();
	const [selectedAgreement, setSelectedAgreement] = useState<{
		id: number;
		title: string;
		content: string;
		confirmationText: string;
	} | null>(null);
	const [agreed, setAgreed] = useState(false);

	const { data: allAgreements, isLoading: isLoadingAll } = useQuery({
		queryKey: ["agreementsAll"],
		queryFn: async () => {
			return await trpc.agreements.listAll.query({ onlyEnabled: true });
		},
	});

	const { data: agreementStatus } = useQuery({
		queryKey: ["agreementsStatus"],
		queryFn: async () => {
			return await trpc.agreements.getStatus.query({});
		},
	});

	const agreeMutation = useMutation({
		mutationFn: (agreementId: number) => {
			return trpc.agreements.agree.mutate({ agreementId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agreementsStatus"] });
			setSelectedAgreement(null);
			setAgreed(false);
		},
	});

	const agreedIds = new Set(
		agreementStatus?.userAgreements.map((ua) => ua.agreementId) || [],
	);

	const handleAgree = async () => {
		if (!selectedAgreement || !agreed) return;
		await agreeMutation.mutateAsync(selectedAgreement.id);
	};

	const handleOpenDialog = (agreement: {
		id: number;
		title: string;
		content: string;
		confirmationText: string;
	}) => {
		setSelectedAgreement(agreement);
		setAgreed(false);
	};

	if (isLoadingAll) {
		return (
			<Page>
				<PageHeader>
					<PageTitle>My Agreements</PageTitle>
					<PageDescription>
						Review and accept required agreements
					</PageDescription>
				</PageHeader>
				<PageContent>
					<div className="flex items-center justify-center h-64">
						<Spinner />
					</div>
				</PageContent>
			</Page>
		);
	}

	const agreements = allAgreements?.agreements || [];

	return (
		<Page>
			<PageHeader>
				<PageTitle>My Agreements</PageTitle>
				<PageDescription>Review and accept required agreements</PageDescription>
			</PageHeader>

			<PageContent>
				{agreements.length === 0 ? (
					<Empty>
						<EmptyContent>
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<FileTextIcon />
								</EmptyMedia>
								<EmptyTitle>No agreements</EmptyTitle>
								<EmptyDescription>
									There are no agreements to review at this time.
								</EmptyDescription>
							</EmptyHeader>
						</EmptyContent>
					</Empty>
				) : (
					<div className="grid gap-4">
						{agreements.map((agreement) => {
							const hasAgreed = agreedIds.has(agreement.id);
							return (
								<Card key={agreement.id}>
									<CardHeader>
										<div className="flex items-start justify-between">
											<div className="space-y-1">
												<CardTitle className="text-lg">
													{agreement.title}
												</CardTitle>
												<CardDescription>
													{hasAgreed ? (
														<span className="flex items-center gap-1 text-green-600">
															<Check className="h-4 w-4" />
															Agreed
														</span>
													) : (
														<span className="text-destructive">
															Action required
														</span>
													)}
												</CardDescription>
											</div>
											{!hasAgreed && (
												<Button onClick={() => handleOpenDialog(agreement)}>
													Review & Accept
												</Button>
											)}
										</div>
									</CardHeader>
									<CardContent>
										<p className="text-sm text-muted-foreground line-clamp-2">
											{agreement.content}
										</p>
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}

				{/* Agreement Dialog */}
				<Dialog
					open={!!selectedAgreement}
					onOpenChange={(open) => {
						if (!open) {
							setSelectedAgreement(null);
							setAgreed(false);
						}
					}}
				>
					<DialogContent className="sm:max-w-[600px]">
						<DialogHeader>
							<DialogTitle>{selectedAgreement?.title}</DialogTitle>
							<DialogDescription>
								Please review and accept this agreement
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							<div className="max-h-[400px] overflow-y-auto border rounded-md p-4 bg-muted/30">
								<div className="whitespace-pre-wrap text-sm">
									{selectedAgreement?.content}
								</div>
							</div>
							<div className="flex items-center space-x-2">
								<Checkbox
									id={checkboxId}
									checked={agreed}
									onCheckedChange={(e) => setAgreed(!!e)}
								/>
								<Label
									htmlFor={checkboxId}
									className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
								>
									{selectedAgreement?.confirmationText || "I agree"}
								</Label>
							</div>
						</div>
						<DialogFooter>
							<DialogClose asChild>
								<Button variant="outline">Cancel</Button>
							</DialogClose>
							<Button
								onClick={handleAgree}
								disabled={!agreed || agreeMutation.isPending}
							>
								{agreeMutation.isPending ? <Spinner /> : "Accept"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</PageContent>
		</Page>
	);
}
