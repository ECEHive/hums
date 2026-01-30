import { ExternalLinkIcon, LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TicketField } from "./field-builder";

interface DynamicTicketDetailsProps {
	fields: TicketField[];
	data: Record<string, unknown>;
}

export function DynamicTicketDetails({
	fields,
	data,
}: DynamicTicketDetailsProps) {
	if (fields.length === 0) {
		// Fallback: display raw data if no field schema
		return <RawDataDisplay data={data} />;
	}

	// Get all data keys that have values
	const dataKeys = Object.keys(data).filter((key) => {
		const value = data[key];
		return value !== undefined && value !== null && value !== "";
	});

	// Separate known fields and deleted fields
	const knownFieldIds = new Set(fields.map((f) => f.id));
	const deletedFieldKeys = dataKeys.filter((key) => !knownFieldIds.has(key));

	return (
		<div className="space-y-4">
			{/* Display fields in schema order */}
			{fields.map((field) => {
				const value = data[field.id];
				if (value === undefined || value === null || value === "") {
					return null;
				}

				return <FieldDisplay key={field.id} field={field} value={value} />;
			})}

			{/* Display deleted fields (fields in data but not in schema) */}
			{deletedFieldKeys.map((key) => {
				const value = data[key];
				return <DeletedFieldDisplay key={key} fieldId={key} value={value} />;
			})}
		</div>
	);
}

interface DeletedFieldDisplayProps {
	fieldId: string;
	value: unknown;
}

function DeletedFieldDisplay({ value }: DeletedFieldDisplayProps) {
	return (
		<div>
			<span className="text-sm font-medium text-muted-foreground block">
				Deleted Field
			</span>
			<div className="mt-1">
				<RawFieldValue value={value} />
			</div>
		</div>
	);
}

interface FieldDisplayProps {
	field: TicketField;
	value: unknown;
}

function FieldDisplay({ field, value }: FieldDisplayProps) {
	return (
		<div>
			<span className="text-sm font-medium text-muted-foreground block">
				{field.label}
			</span>
			<div className="mt-1">
				<FieldValue field={field} value={value} />
			</div>
		</div>
	);
}

interface FieldValueProps {
	field: TicketField;
	value: unknown;
}

function FieldValue({ field, value }: FieldValueProps) {
	switch (field.type) {
		case "text":
		case "tel":
			return <p className="text-base">{String(value)}</p>;

		case "textarea":
			return <p className="whitespace-pre-wrap">{String(value)}</p>;

		case "number":
			return (
				<p className="text-lg font-medium">{Number(value).toLocaleString()}</p>
			);

		case "email":
			return (
				<a
					href={`mailto:${String(value)}`}
					className="text-primary hover:underline"
				>
					{String(value)}
				</a>
			);

		case "url":
			return (
				<a
					href={String(value)}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-primary hover:underline"
				>
					<LinkIcon className="h-3 w-3" />
					{String(value)}
					<ExternalLinkIcon className="h-3 w-3" />
				</a>
			);

		case "date":
			try {
				return <p>{new Date(String(value)).toLocaleDateString()}</p>;
			} catch {
				return <p>{String(value)}</p>;
			}

		case "datetime":
			try {
				return <p>{new Date(String(value)).toLocaleString()}</p>;
			} catch {
				return <p>{String(value)}</p>;
			}

		case "time":
			return <p>{String(value)}</p>;

		case "select":
		case "radio": {
			const selectedOption = field.options?.find(
				(o) => o.value === String(value),
			);
			const displayValue = selectedOption?.label ?? String(value);
			return (
				<Badge variant="secondary" className="text-sm">
					{displayValue}
				</Badge>
			);
		}

		case "checkbox":
			return (
				<Badge variant={value ? "default" : "outline"}>
					{value ? "Yes" : "No"}
				</Badge>
			);

		case "checkboxGroup": {
			const selectedValues = Array.isArray(value) ? value : [];
			if (selectedValues.length === 0) {
				return <p className="text-muted-foreground">None selected</p>;
			}
			return (
				<div className="flex flex-wrap gap-2">
					{selectedValues.map((v) => {
						const option = field.options?.find((o) => o.value === v);
						return (
							<Badge key={v} variant="secondary">
								{option?.label ?? v}
							</Badge>
						);
					})}
				</div>
			);
		}

		default:
			return <p>{String(value)}</p>;
	}
}

// Fallback component for displaying raw data when no field schema is available
function RawDataDisplay({ data }: { data: Record<string, unknown> }) {
	const entries = Object.entries(data).filter(([_, value]) => {
		return value !== undefined && value !== null && value !== "";
	});

	if (entries.length === 0) {
		return <p className="text-muted-foreground">No data</p>;
	}

	return (
		<div className="space-y-4">
			{entries.map(([key, value]) => (
				<div key={key}>
					<span className="text-sm font-medium text-muted-foreground capitalize block">
						{formatFieldKey(key)}
					</span>
					<div className="mt-1">
						<RawFieldValue value={value} />
					</div>
				</div>
			))}
		</div>
	);
}

// Format a field key for display (camelCase -> Title Case)
function formatFieldKey(key: string): string {
	return key
		.replace(/([A-Z])/g, " $1")
		.replace(/_/g, " ")
		.replace(/^\w/, (c) => c.toUpperCase())
		.trim();
}

interface RawFieldValueProps {
	value: unknown;
}

function RawFieldValue({ value }: RawFieldValueProps) {
	if (typeof value === "boolean") {
		return (
			<Badge variant={value ? "default" : "outline"}>
				{value ? "Yes" : "No"}
			</Badge>
		);
	}

	if (typeof value === "number") {
		return <p className="text-lg font-medium">{value.toLocaleString()}</p>;
	}

	if (Array.isArray(value)) {
		if (value.length === 0) {
			return <p className="text-muted-foreground">None</p>;
		}
		return (
			<div className="flex flex-wrap gap-2">
				{value.map((v, i) => (
					<Badge key={i} variant="secondary">
						{String(v)}
					</Badge>
				))}
			</div>
		);
	}

	if (typeof value === "string") {
		// Check if it's a URL
		if (value.startsWith("http://") || value.startsWith("https://")) {
			return (
				<a
					href={value}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-primary hover:underline"
				>
					<LinkIcon className="h-3 w-3" />
					{value}
					<ExternalLinkIcon className="h-3 w-3" />
				</a>
			);
		}

		// Check if it's an email
		if (value.includes("@") && value.includes(".")) {
			return (
				<a href={`mailto:${value}`} className="text-primary hover:underline">
					{value}
				</a>
			);
		}

		// Check if it looks like a date
		const dateAttempt = Date.parse(value);
		if (!Number.isNaN(dateAttempt) && value.match(/^\d{4}-\d{2}-\d{2}/)) {
			return <p>{new Date(value).toLocaleString()}</p>;
		}

		// Multi-line text
		if (value.includes("\n")) {
			return <p className="whitespace-pre-wrap">{value}</p>;
		}

		return <p>{value}</p>;
	}

	// Object or other types
	return (
		<pre className="text-sm bg-muted p-2 rounded overflow-auto">
			{JSON.stringify(value, null, 2)}
		</pre>
	);
}
