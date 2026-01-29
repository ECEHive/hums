import JsBarcode from "jsbarcode";
import type { ItemRow } from "@/components/inventory/types";

export type LabelTemplate = "94270" | "94200" | "94203";

export interface BarcodePrintOptions {
offset?: number;
template?: LabelTemplate;
}

interface TemplateConfig {
name: string;
columns: number;
rows: number;
labelWidth: number;
labelHeight: number;
marginTop: number;
marginBottom: number;
marginLeft: number;
marginRight: number;
}

const TEMPLATES: Record<LabelTemplate, TemplateConfig> = {
"94270": {
name: "Presta 94270",
columns: 6,
rows: 14,
labelWidth: 1.0,
labelHeight: 0.5,
marginTop: 0.5375,
marginBottom: 0.5375,
marginLeft: 0.4375,
marginRight: 0.4375,
},
"94200": {
name: "Presta 94200",
columns: 3,
rows: 10,
labelWidth: 2.625,
labelHeight: 1.0,
marginTop: 0.5,
marginBottom: 0.5,
marginLeft: 0.1875,
marginRight: 0.1875,
},
"94203": {
name: "Presta 94203",
columns: 4,
rows: 20,
labelWidth: 1.75,
labelHeight: 0.5,
marginTop: 0.5,
marginBottom: 0.5,
marginLeft: 0.3,
marginRight: 0.3,
},
};

const PAGE_WIDTH = 8.5;
const PAGE_HEIGHT = 11.0;

function generateBarcodeDataURL(sku: string): string {
const canvas = document.createElement("canvas");
try {
JsBarcode(canvas, sku, {
format: "CODE39",
width: 1.5,
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

function calculateGaps(config: TemplateConfig): { horizontalGap: number; verticalGap: number } {
const contentWidth = PAGE_WIDTH - config.marginLeft - config.marginRight;
const contentHeight = PAGE_HEIGHT - config.marginTop - config.marginBottom;
const totalLabelsWidth = config.columns * config.labelWidth;
const totalLabelsHeight = config.rows * config.labelHeight;
const horizontalGap = config.columns > 1 ? (contentWidth - totalLabelsWidth) / (config.columns - 1) : 0;
const verticalGap = config.rows > 1 ? (contentHeight - totalLabelsHeight) / (config.rows - 1) : 0;
return { horizontalGap, verticalGap };
}

export function generateBarcodeLabelHTML(items: ItemRow[], options: BarcodePrintOptions = {}): string {
const { offset = 0, template = "94200" } = options;
const config = TEMPLATES[template];
const { horizontalGap, verticalGap } = calculateGaps(config);
const labelsPerPage = config.columns * config.rows;

const itemsWithSKU = items.filter((item) => item.sku);
if (itemsWithSKU.length === 0) {
return "<!DOCTYPE html><html><head><title>No Labels</title></head><body><p>No items with SKUs.</p></body></html>";
}

const itemsWithBarcodes = itemsWithSKU.map((item) => ({
...item,
barcodeDataURL: generateBarcodeDataURL(item.sku || ""),
}));

const offsetSlots: null[] = Array(offset).fill(null);
const allSlots = [...offsetSlots, ...itemsWithBarcodes];

const pages: (typeof itemsWithBarcodes[0] | null)[][] = [];
for (let i = 0; i < allSlots.length; i += labelsPerPage) {
pages.push(allSlots.slice(i, i + labelsPerPage));
}

const escapeHtml = (text: string): string => {
const div = document.createElement("div");
div.textContent = text;
return div.innerHTML;
};

const renderLabel = (item: typeof itemsWithBarcodes[0] | null, row: number, col: number): string => {
const left = config.marginLeft + col * (config.labelWidth + horizontalGap);
const top = config.marginTop + row * (config.labelHeight + verticalGap);
if (!item) return "";
const fontSize = config.labelHeight < 1 ? 4 : 9;
const skuFontSize = config.labelHeight < 1 ? 3 : 7;
return '<div class="label" style="left:' + left + 'in;top:' + top + 'in;width:' + config.labelWidth + 'in;height:' + config.labelHeight + 'in;"><span class="name" style="font-size:' + fontSize + 'pt">' + escapeHtml(item.name) + '</span><img class="barcode" src="' + item.barcodeDataURL + '"><span class="sku" style="font-size:' + skuFontSize + 'pt">' + escapeHtml(item.sku || "") + '</span></div>';
};

const pagesHTML = pages.map((pageItems) => {
const labelsHTML = pageItems.map((item, index) => {
const row = Math.floor(index / config.columns);
const col = index % config.columns;
return renderLabel(item, row, col);
}).join("");
return '<div class="page">' + labelsHTML + '</div>';
}).join("");

const css = '@page{size:letter portrait;margin:0}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif}.page{width:' + PAGE_WIDTH + 'in;height:' + PAGE_HEIGHT + 'in;position:relative;page-break-after:always}.page:last-child{page-break-after:auto}.label{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;padding:1px}.name{font-weight:bold;text-align:center;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1}.barcode{max-width:95%;max-height:55%;object-fit:contain}.sku{text-align:center;width:100%;line-height:1}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';

return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Barcode Labels - ' + config.name + '</title><style>' + css + '</style></head><body>' + pagesHTML + '<script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}};</script></body></html>';
}

export function printBarcodeLabels(items: ItemRow[], options: BarcodePrintOptions = {}): void {
const html = generateBarcodeLabelHTML(items, options);
const printWindow = window.open("", "_blank");
if (printWindow) {
printWindow.document.write(html);
printWindow.document.close();
} else {
console.error("Failed to open print window. Please check popup blocker settings.");
}
}
