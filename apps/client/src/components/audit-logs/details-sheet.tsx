import type React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { AuditLogRow } from "./types";
import { formatActor, formatDateTime, stringifyMetadata } from "./utils";

type AuditLogDetailsSheetProps = {
	log: AuditLogRow | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function AuditLogDetailsSheet({
	log,
	open,
	onOpenChange,
}: AuditLogDetailsSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>Audit Log Details</SheetTitle>
					<SheetDescription>
						Review the complete payload, actors, and context recorded for this
						entry.
					</SheetDescription>
				</SheetHeader>
				{log ? (
					<div className="flex flex-col gap-6 overflow-y-auto p-4">
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">Action</p>
							<code className="rounded bg-muted px-2 py-1 text-sm">
								{log.action}
							</code>
						</div>
						<div className="grid grid-cols-1 gap-4 text-sm">
							<Detail label="Actor" value={formatActor(log.user) ?? "System"} />
							<Detail label="Timestamp" value={formatDateTime(log.createdAt)} />
							<Detail
								label="Source"
								value={<Badge variant="secondary">{log.source}</Badge>}
							/>
							{log.impersonatedBy && (
								<Detail
									label="Impersonated By"
									value={formatActor(log.impersonatedBy)}
								/>
							)}
							{log.apiToken && (
								<Detail
									label="API Token"
									value={`${log.apiToken.name ?? "Token"} (#${log.apiToken.id})`}
								/>
							)}
						</div>
						<div className="space-y-2 text-sm">
							<div className="flex items-center justify-between">
								<p className="text-muted-foreground">Metadata</p>
								<Button
									variant="secondary"
									size="sm"
									onClick={() => handleCopy(log.metadata)}
								>
									Copy JSON
								</Button>
							</div>
							<pre className="max-h-[320px] overflow-auto rounded border bg-muted/50 p-3 text-xs">
								{stringifyMetadata(log.metadata)}
							</pre>
						</div>
					</div>
				) : (
					<p className="p-4 text-sm text-muted-foreground">
						Select an audit log entry to inspect the payload.
					</p>
				)}
			</SheetContent>
		</Sheet>
	);
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="space-y-1">
			<p className="text-xs uppercase tracking-wide text-muted-foreground">
				{label}
			</p>
			<div className="font-medium">{value}</div>
		</div>
	);
}

function handleCopy(metadata: unknown) {
	const serialized = stringifyMetadata(metadata);
	try {
		if (typeof navigator === "undefined" || !navigator.clipboard) {
			throw new Error("Clipboard API unavailable");
		}
		navigator.clipboard.writeText(serialized);
		toast.success("Metadata copied to clipboard");
	} catch (error) {
		console.error(error);
		toast.error("Unable to copy metadata");
	}
}
