import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
	formatDateInAppTimezone,
	formatInAppTimezone,
	formatTimeRange,
} from "@/lib/timezone";
import { type AttendanceRecord, getIssueLabels } from "./columns";

type RequestExcuseDialogProps = {
	attendance: AttendanceRecord | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function RequestExcuseDialog({
	attendance,
	open,
	onOpenChange,
}: RequestExcuseDialogProps) {
	const [reason, setReason] = useState("");
	const queryClient = useQueryClient();

	// Reset the form whenever a different shift is selected
	useEffect(() => {
		if (open) setReason("");
	}, [open]);

	const requestExcuseMutation = useMutation({
		mutationFn: async (input: { attendanceId: number; reason: string }) => {
			return trpc.shiftAttendances.requestExcuse.mutate(input);
		},
		onSuccess: () => {
			toast.success("Your excuse request has been submitted for review.");
			queryClient.invalidateQueries({ queryKey: ["myAttendance"] });
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to submit excuse request");
		},
	});

	const trimmedReason = reason.trim();

	const handleSubmit = () => {
		if (!attendance || !trimmedReason) return;
		requestExcuseMutation.mutate({
			attendanceId: attendance.id,
			reason: trimmedReason,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Request Excuse</DialogTitle>
					<DialogDescription>
						Provide a reason for missing this shift. Excuses are granted for
						illness, emergencies, and Institute Approved Absences.
					</DialogDescription>
				</DialogHeader>

				{attendance && (
					<div className="space-y-4">
						<div className="rounded-lg border p-4 bg-muted/50">
							<div className="font-medium">
								{attendance.shiftOccurrence.shiftSchedule.shiftType.name}
							</div>
							<div className="text-sm text-muted-foreground">
								{formatDateInAppTimezone(attendance.shiftOccurrence.timestamp)}{" "}
								{formatTimeRange(
									attendance.shiftOccurrence.shiftSchedule.startTime,
									attendance.shiftOccurrence.shiftSchedule.endTime,
									{ referenceDate: attendance.shiftOccurrence.timestamp },
								)}
							</div>
							<div className="mt-2 flex flex-wrap gap-1">
								{getIssueLabels(attendance).map((label) => (
									<Badge key={label} variant="secondary">
										{label}
									</Badge>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="excuse-reason">Reason</Label>
							<Textarea
								id="excuse-reason"
								placeholder="Excuse reason?"
								value={reason}
								onChange={(e) => setReason(e.target.value)}
							/>
							{attendance.excuseRequestDeadline && (
								<p className="text-xs text-muted-foreground">
									Submit by{" "}
									{formatInAppTimezone(attendance.excuseRequestDeadline)}
								</p>
							)}
						</div>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={!trimmedReason || requestExcuseMutation.isPending}
					>
						{requestExcuseMutation.isPending && (
							<Spinner className="h-4 w-4 mr-2" />
						)}
						Submit Request
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
