/// <reference types="bun-types" />

import { getLogger } from "@ecehive/logger";

const logger = getLogger("email:text-generator");

/**
 * Convert HTML email to plain text using Bun's HTMLRewriter
 * Extracts text content while preserving structure and formatting
 */
export function htmlToPlainText(html: string): string {
	let result = "";

	const rewriter = new HTMLRewriter()
		// Remove script, style, and head tags completely
		.on("script, style, head", {
			element(el) {
				el.remove();
			},
		})
		// Add spacing before/after structural elements
		.on("h1, h2, h3, h4, h5, h6", {
			element(el) {
				el.prepend("\n\n", { html: false });
				el.append("\n", { html: false });
			},
		})
		.on("p, div", {
			element(el) {
				el.prepend("\n", { html: false });
				el.append("\n", { html: false });
			},
		})
		.on("br", {
			element(el) {
				el.after("\n", { html: false });
			},
		})
		.on("tr", {
			element(el) {
				el.append("\n", { html: false });
			},
		})
		// Add link URLs in parentheses after the link text
		.on("a[href]", {
			element(el) {
				const href = el.getAttribute("href");
				if (href && !href.startsWith("#") && !href.startsWith("mailto:")) {
					el.append(` (${href})`, { html: false });
				}
			},
		});

	try {
		const transformed = rewriter.transform(html);
		result = transformed;
	} catch (error) {
		logger.warn("Failed to parse HTML to plain text, using fallback", {
			error: error instanceof Error ? error.message : String(error),
		});
		// Fallback: just strip all HTML tags
		return html
			.replace(/<[^>]*>/g, "")
			.replace(/\s+/g, " ")
			.trim();
	}

	// Strip all remaining HTML tags
	result = result.replace(/<[^>]*>/g, "");

	// Decode common HTML entities
	result = result.replace(/&nbsp;/g, " ");
	result = result.replace(/&amp;/g, "&");
	result = result.replace(/&lt;/g, "<");
	result = result.replace(/&gt;/g, ">");
	result = result.replace(/&quot;/g, '"');
	result = result.replace(/&#39;/g, "'");
	result = result.replace(/&mdash;/g, "—");
	result = result.replace(/&ndash;/g, "–");

	// Clean up whitespace
	result = result.replace(/[ \t]+/g, " "); // Multiple spaces to single space
	result = result.replace(/\n[ \t]+/g, "\n"); // Remove leading whitespace on lines
	result = result.replace(/[ \t]+\n/g, "\n"); // Remove trailing whitespace on lines
	result = result.replace(/\n{3,}/g, "\n\n"); // Maximum 2 consecutive newlines

	// Trim start and end
	result = result.trim();

	return result;
}
