import { FileQuestionIcon } from "lucide-react";
import { useState } from "react";
import { useCurrentUser } from "@/auth";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { checkPermissions } from "@/lib/permissions";
import { CreatePeriodSheet } from "../periods/create-period-sheet";

export function PeriodNotSelected() {
	const user = useCurrentUser();
	const canCreate = checkPermissions(user, ["periods.create"]);
	const [createOpen, setCreateOpen] = useState(false);

	return (
		<div className="flex w-full p-8">
			<Empty className="border border-dashed">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FileQuestionIcon />
					</EmptyMedia>
					<EmptyTitle>No Period Selected</EmptyTitle>
					<EmptyDescription>
						{canCreate
							? "No periods exist yet. Create a period to get started."
							: "There are no periods available."}
					</EmptyDescription>
				</EmptyHeader>
				{canCreate && (
					<EmptyContent>
						<Button
							onClick={() => setCreateOpen(true)}
							aria-label="Create Period"
						>
							Create a Period
						</Button>
						<CreatePeriodSheet open={createOpen} onOpenChange={setCreateOpen} />
					</EmptyContent>
				)}
			</Empty>
		</div>
	);
}
