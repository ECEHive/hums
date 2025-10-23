import { Filter } from "lucide-react";
import { useState } from "react";
import type { JSX } from "react/jsx-runtime";
import {
	type Role,
	RoleMultiSelect,
} from "@/components/roles/role-multiselect";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

type FilterDialogProps = {
	onFilterChange: (roles: Role[]) => void;
	filterRoles: Role[];
	trigger?: JSX.Element;
};

export function FilterDialog({
	onFilterChange,
	filterRoles,
	trigger,
}: FilterDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [roles, setRoles] = useState<Role[]>(filterRoles);
	const [serverError, setServerError] = useState<string | null>(null);

	// Reset local selection when the dialog is closed (discard changes)
	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			// revert to original roles when dialog closed without saving
			onFilterChange(filterRoles);
			setServerError(null);
		}
		setOpen(nextOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				{trigger ? (
					trigger
				) : (
					<Button variant="outline" size="sm">
						<Filter className="size-4" />
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Filter by Role</DialogTitle>
					<DialogDescription>
						Matches users who possess any of the selected roles.
					</DialogDescription>
				</DialogHeader>
				<div className="py-4 space-y-3">
					<div>
						<p className="text-sm text-muted-foreground mb-2">Filter roles</p>
						{/* RoleMultiSelect allows viewing/searching and selecting roles. Changes are local until Save is pressed. */}
						<RoleMultiSelect
							value={roles}
							onChange={(next: Role[]) => {
								setRoles(next);
							}}
						/>
					</div>
					{serverError && (
						<p className="text-sm text-destructive">{serverError}</p>
					)}
				</div>
				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="outline">
							Cancel
						</Button>
					</DialogClose>
					<Button
						onClick={() => {
							onFilterChange(roles);
							setServerError(null);
							setOpen(false);
						}}
					>
						Apply
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
