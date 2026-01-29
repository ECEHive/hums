import type { ExportFormat } from "./types";
import { escapeHtml, generateTimestampForFilename } from "./utils";

/**
 * Escape a value for CSV format.
 * Uses selective quoting (RFC 4180 compliant): only quotes values that contain
 * special characters (comma, newline, quote). This produces smaller, more readable
 * CSV files while maintaining compatibility with spreadsheet software.
 *
 * Date objects and ISO date strings are formatted as raw ISO strings for
 * maximum compatibility and precision.
 */
function csvEscape(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);

	// Handle Date objects - format as ISO string
	if (value instanceof Date) {
		return value.toISOString();
	}

	// Check if it's an ISO date string and pass through as-is
	if (typeof value === "string") {
		// ISO 8601 date pattern (e.g., 2024-01-15T10:30:00.000Z)
		const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
		if (isoDatePattern.test(value)) {
			return value;
		}
	}

	const s = String(value);
	// Escape quotes and wrap in quotes if contains comma, newline, or quote
	if (s.includes(",") || s.includes("\n") || s.includes('"')) {
		return `"${s.replace(/"/g, '""')}"`;
	}
	return s;
}

/**
 * Export data to CSV format and trigger download
 */
export function exportToCSV<T extends Record<string, unknown>>(
	data: T[],
	filename: string,
	headers?: { key: keyof T; label: string }[],
): void {
	if (!data || data.length === 0) return;

	// Use provided headers or infer from data keys
	const columnHeaders =
		headers ??
		Object.keys(data[0]).map((key) => ({ key: key as keyof T, label: key }));
	const headerRow = columnHeaders.map((h) => h.label).join(",");
	const dataRows = data.map((row) =>
		columnHeaders.map((h) => csvEscape(row[h.key])).join(","),
	);

	const csv = [headerRow, ...dataRows].join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = `${filename}-${generateTimestampForFilename()}.csv`;
	document.body.appendChild(a);
	a.click();

	setTimeout(() => {
		URL.revokeObjectURL(url);
		document.body.removeChild(a);
	}, 0);
}

/**
 * Generate HTML document for print/PDF export
 */
export function generateHTMLDocument(
	title: string,
	subtitle: string,
	content: string,
	styles?: string,
): string {
	const defaultStyles = `
		@page {
			size: letter portrait;
			margin: 0.5in;
		}

		body {
			margin: 0;
			padding: 0;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			color: #000;
			background: #fff;
		}

		.header {
			margin-bottom: 16px;
		}

		.title {
			font-size: 16pt;
			font-weight: bold;
			margin-bottom: 4px;
			color: #000;
		}

		.subtitle {
			font-size: 10pt;
			color: #666;
		}

		table {
			width: 100%;
			border-collapse: collapse;
			font-size: 10pt;
			table-layout: auto;
		}

		th, td {
			border: 1px solid #333;
			padding: 4px 8px;
			text-align: left;
			vertical-align: top;
		}

		th {
			background-color: #e5e5e5;
			font-weight: bold;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		tbody tr:nth-child(even) td {
			background-color: #f5f5f5;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		.empty-cell {
			font-size: 8pt;
			color: #999;
		}

		.summary {
			margin-top: 16px;
			padding: 8px;
			background-color: #f5f5f5;
			border: 1px solid #ddd;
			font-size: 10pt;
		}
	`;

	const generatedDate = new Date().toLocaleString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
	});

	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>${escapeHtml(title)}</title>
	<style>
		${styles ?? defaultStyles}
	</style>
</head>
<body>
	<div class="header">
		<div class="title">${escapeHtml(title)}</div>
		<div class="subtitle">${escapeHtml(subtitle)}</div>
		<div class="subtitle">Generated on ${generatedDate}</div>
	</div>

	${content}

	<script>
		window.onload = function() {
			window.print();
			window.onafterprint = function() {
				window.close();
			};
		};
	</script>
</body>
</html>
	`;
}

/**
 * Generate an HTML table from data
 */
export function generateHTMLTable<T extends Record<string, unknown>>(
	data: T[],
	columns: {
		key: keyof T;
		label: string;
		format?: (value: T[keyof T]) => string;
	}[],
): string {
	if (!data || data.length === 0) {
		return '<p class="empty-cell">No data available</p>';
	}

	const headerRow = columns
		.map((col) => `<th>${escapeHtml(col.label)}</th>`)
		.join("");
	const dataRows = data
		.map(
			(row) =>
				`<tr>${columns
					.map((col) => {
						const value = row[col.key];
						const formatted = col.format
							? col.format(value)
							: String(value ?? "—");
						return `<td>${escapeHtml(formatted)}</td>`;
					})
					.join("")}</tr>`,
		)
		.join("");

	return `
		<table>
			<thead>
				<tr>${headerRow}</tr>
			</thead>
			<tbody>
				${dataRows}
			</tbody>
		</table>
	`;
}

/**
 * Open HTML content in a new window for printing
 */
export function openPrintWindow(html: string): void {
	const printWindow = window.open("", "_blank");
	if (printWindow) {
		printWindow.document.write(html);
		printWindow.document.close();
	}
}

/**
 * Column definition for export
 */
export interface ExportColumn<T = Record<string, unknown>> {
	key: keyof T;
	label: string;
	format?: (value: T[keyof T]) => string;
}

/**
 * Export options configuration
 */
export interface ExportOptions<T = Record<string, unknown>> {
	filename: string;
	title: string;
	subtitle: string;
	columns: ExportColumn<T>[];
}

/**
 * Unified export handler for all report types
 * Works consistently across CSV and HTML/PDF formats
 */
export function exportReport<T extends Record<string, unknown>>(
	format: ExportFormat,
	data: T[],
	options: ExportOptions<T>,
): void {
	const { filename, title, subtitle, columns } = options;

	if (format === "csv") {
		exportToCSV(
			data,
			filename,
			columns.map((c) => ({ key: c.key, label: c.label })),
		);
	} else if (format === "html") {
		const tableHtml = generateHTMLTable(data, columns);
		const html = generateHTMLDocument(title, subtitle, tableHtml);
		openPrintWindow(html);
	}
}

/**
 * Convert column definitions from TanStack Table format to export format.
 * Uses the header as label when it's a string, otherwise falls back to accessorKey.
 */
export function columnsToExportFormat<T extends Record<string, unknown>>(
	columns: { accessorKey?: string; header?: string | unknown }[],
): ExportColumn<T>[] {
	return columns
		.filter((col) => col.accessorKey)
		.map((col) => ({
			key: col.accessorKey as keyof T,
			// Use header if it's a string, otherwise fallback to accessorKey for readability
			label:
				typeof col.header === "string" ? col.header : (col.accessorKey ?? ""),
		}));
}
