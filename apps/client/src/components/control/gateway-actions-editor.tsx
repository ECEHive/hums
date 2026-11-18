import type { trpc } from "@ecehive/trpc/client";
import { PlusIcon, Trash2Icon } from "lucide-react";
import type { JSX } from "react/jsx-runtime";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export type GatewayActionValue = "TURN_ON" | "TURN_OFF" | "UNLOCK";

export type GatewayActionRow = {
	controlPointId: string;
	action: GatewayActionValue;
};

export type ControlPointOption = Awaited<
	ReturnType<typeof trpc.control.points.list.query>
>["points"][number];

const ACTION_LABELS: Record<GatewayActionValue, string> = {
	TURN_ON: "Turn On",
	TURN_OFF: "Turn Off",
	UNLOCK: "Unlock",
};

const DOOR_ACTIONS: GatewayActionValue[] = ["UNLOCK"];
const SWITCH_ACTIONS: GatewayActionValue[] = ["TURN_ON", "TURN_OFF"];

// Both selects ignore "": inside a <form>, Radix's hidden native <select> fires
// a change to "" when the value is briefly missing from its options (e.g. the
// action list switching between switch and door actions), which would
// otherwise wipe the selection.
export function GatewayActionsEditor({
	actions,
	onChange,
	controlPoints,
}: {
	actions: GatewayActionRow[];
	onChange: (actions: GatewayActionRow[]) => void;
	controlPoints: ControlPointOption[];
}): JSX.Element {
	const updateRow = (index: number, row: GatewayActionRow) =>
		onChange(actions.map((a, i) => (i === index ? row : a)));

	return (
		<div className="border rounded-lg p-4 space-y-4">
			<div className="flex items-center justify-between">
				<h4 className="font-medium text-sm">Gateway Actions</h4>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() =>
						onChange([...actions, { controlPointId: "", action: "TURN_ON" }])
					}
				>
					<PlusIcon className="h-3 w-3 mr-1" />
					Add Action
				</Button>
			</div>

			<div className="space-y-2">
				{actions.length === 0 && (
					<p className="text-sm text-muted-foreground text-center py-2">
						No actions configured. Add actions to define what this gateway will
						do.
					</p>
				)}
				{actions.map((row, index) => {
					const point = controlPoints.find((p) => p.id === row.controlPointId);
					const choices =
						point?.controlClass === "DOOR" ? DOOR_ACTIONS : SWITCH_ACTIONS;
					return (
						<div
							key={index}
							className="flex items-center gap-2 border rounded-md p-2"
						>
							<Select
								value={row.controlPointId}
								onValueChange={(controlPointId) => {
									if (!controlPointId) return;
									const next = controlPoints.find(
										(p) => p.id === controlPointId,
									);
									let action = row.action;
									if (next?.controlClass === "DOOR") action = "UNLOCK";
									else if (action === "UNLOCK") action = "TURN_ON";
									updateRow(index, { controlPointId, action });
								}}
							>
								<SelectTrigger className="flex-1">
									<SelectValue placeholder="Select control point" />
								</SelectTrigger>
								<SelectContent>
									{controlPoints.map((p) => (
										<SelectItem key={p.id} value={p.id}>
											{p.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select
								value={row.action}
								onValueChange={(action) => {
									if (!action) return;
									updateRow(index, {
										...row,
										action: action as GatewayActionValue,
									});
								}}
							>
								<SelectTrigger className="w-[130px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{choices.map((a) => (
										<SelectItem key={a} value={a}>
											{ACTION_LABELS[a]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label="Remove action"
								onClick={() => onChange(actions.filter((_, i) => i !== index))}
							>
								<Trash2Icon className="h-4 w-4 text-destructive" />
							</Button>
						</div>
					);
				})}
			</div>
		</div>
	);
}
