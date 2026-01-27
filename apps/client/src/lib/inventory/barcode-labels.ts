import JsBarcode from "jsbarcode";
import type { ItemRow } from "@/components/inventory/types";

/**
 * Avery Presta Template 94200 Specifications
 * Rectangle Labels: 1" x 2-5/8" (2.54cm x 6.67cm)
 * 30 labels per sheet (3 columns x 10 rows)
 * Letter size page: 8.5" x 11"
 */
const LABEL_SPECS = {
	// Label dimensions in inches
	labelWidth: 2.625, // 2-5/8"
	labelHeight: 1.0,

	// Grid layout
	columns: 3,
	rows: 10,
	labelsPerPage: 30,

	// Page dimensions in inches
	pageWidth: 8.5,
	pageHeight: 11.0,

	// Margins (calculated to center the labels)
	marginTop: 0.5,
	marginLeft: 0.1875, // Calculated for centering

	// Spacing between labels
	horizontalGap: 0.125,
	verticalGap: 0.0,
};

/**
 * Generate a barcode as a data URL
 */
function generateBarcodeDataURL(sku: string): string {
	const canvas = document.createElement("canvas");

	try {
		JsBarcode(canvas, sku, {
			format: "CODE39",
			width: 2,
			height: 40,
			displayValue: false,
			margin: 0,
		});
		return canvas.toDataURL("image/png");
	} catch (error) {
		console.error("Error generating barcode:", error);
		return "";
	}
}

/**
 * Generate HTML for barcode labels following Avery 94200 template
 */
export function generateBarcodeLabelHTML(items: ItemRow[]): string {
	// Filter items that have SKUs
	const itemsWithSKU = items.filter((item) => item.sku);

	if (itemsWithSKU.length === 0) {
		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Barcode Labels</title>
</head>
<body>
	<p>No items with SKUs found to generate labels.</p>
</body>
</html>
		`;
	}

	// Generate barcodes for all items
	const itemsWithBarcodes = itemsWithSKU.map((item) => ({
		...item,
		barcodeDataURL: generateBarcodeDataURL(item.sku || ""),
	}));

	// Split items into pages
	const pages: (typeof itemsWithBarcodes)[] = [];
	for (
		let i = 0;
		i < itemsWithBarcodes.length;
		i += LABEL_SPECS.labelsPerPage
	) {
		pages.push(itemsWithBarcodes.slice(i, i + LABEL_SPECS.labelsPerPage));
	}

	const styles = `
		@page {
			size: letter portrait;
			margin: 0;
		}

		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			margin: 0;
			padding: 0;
			font-family: Arial, sans-serif;
			background: white;
		}

		.page {
			width: ${LABEL_SPECS.pageWidth}in;
			height: ${LABEL_SPECS.pageHeight}in;
			position: relative;
			page-break-after: always;
			background: white;
		}

		.page:last-child {
			page-break-after: auto;
		}

		.labels-grid {
			position: absolute;
			top: ${LABEL_SPECS.marginTop}in;
			left: ${LABEL_SPECS.marginLeft}in;
			display: grid;
			grid-template-columns: repeat(${LABEL_SPECS.columns}, ${LABEL_SPECS.labelWidth}in);
			grid-template-rows: repeat(${LABEL_SPECS.rows}, ${LABEL_SPECS.labelHeight}in);
			column-gap: ${LABEL_SPECS.horizontalGap}in;
			row-gap: ${LABEL_SPECS.verticalGap}in;
		}

		.label {
			width: ${LABEL_SPECS.labelWidth}in;
			height: ${LABEL_SPECS.labelHeight}in;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 0.05in;
			overflow: hidden;
		}

		.label-name {
			font-size: 7pt;
			font-weight: bold;
			text-align: center;
			max-width: 100%;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			margin-bottom: 1px;
			line-height: 1.1;
		}

		.label-barcode {
			flex: 1;
			display: flex;
			align-items: center;
			justify-content: center;
			max-width: 100%;
			max-height: 0.6in;
		}

		.label-barcode img {
			max-width: 100%;
			max-height: 100%;
			object-fit: contain;
		}

		.label-sku {
			font-size: 6pt;
			text-align: center;
			margin-top: 1px;
			line-height: 1.1;
		}

		@media print {
			body {
				-webkit-print-color-adjust: exact;
				print-color-adjust: exact;
			}
		}
	`;

	const pagesHTML = pages
		.map((pageItems) => {
			// Create array of 30 slots (some may be empty)
			const slots = Array(LABEL_SPECS.labelsPerPage).fill(null);
			pageItems.forEach((item, index) => {
				slots[index] = item;
			});

			const labelsHTML = slots
				.map((item) => {
					if (!item) {
						return '<div class="label"></div>';
					}

					return `
				<div class="label">
					<div class="label-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
					<div class="label-barcode">
						<img src="${item.barcodeDataURL}" alt="Barcode for ${escapeHtml(item.sku || "")}">
					</div>
					<div class="label-sku">${escapeHtml(item.sku || "")}</div>
				</div>
			`;
				})
				.join("");

			return `
			<div class="page">
				<div class="labels-grid">
					${labelsHTML}
				</div>
			</div>
		`;
		})
		.join("");

	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Barcode Labels - ${itemsWithBarcodes.length} Items</title>
	<style>${styles}</style>
</head>
<body>
	${pagesHTML}
	<script>
		// Auto-print when loaded
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
 * Helper function to escape HTML
 */
function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Open barcode labels in a new window for printing
 */
export function printBarcodeLabels(items: ItemRow[]): void {
	const html = generateBarcodeLabelHTML(items);
	const printWindow = window.open("", "_blank");

	if (printWindow) {
		printWindow.document.write(html);
		printWindow.document.close();
	} else {
		console.error(
			"Failed to open print window. Please check popup blocker settings.",
		);
	}
}
