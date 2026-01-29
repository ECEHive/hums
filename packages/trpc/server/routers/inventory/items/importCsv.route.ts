import { type Prisma, prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../../trpc";

export const ZImportCsvSchema = z.object({
	csvContent: z.string().min(1, "CSV content cannot be empty"),
});

export type TImportCsvSchema = z.infer<typeof ZImportCsvSchema>;

export type TImportCsvOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TImportCsvSchema;
};

function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === "," && !inQuotes) {
			result.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}

	result.push(current.trim());
	return result;
}

function generateSku(): string {
	// Generate a random 8-character alphanumeric SKU
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let sku = "";
	for (let i = 0; i < 8; i++) {
		sku += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return sku;
}

async function generateUniqueSku(
	tx: Prisma.TransactionClient,
): Promise<string> {
	let sku = generateSku();
	let attempts = 0;
	const maxAttempts = 10;

	while (attempts < maxAttempts) {
		const existing = await tx.item.findUnique({
			where: { sku },
			select: { id: true },
		});

		if (!existing) {
			return sku;
		}

		sku = generateSku();
		attempts++;
	}

	// If we still have collision after max attempts, append timestamp
	return `${sku}-${Date.now().toString(36).toUpperCase()}`;
}

export async function importCsvHandler(options: TImportCsvOptions) {
	const { csvContent } = options.input;

	// Parse CSV
	const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() !== "");

	if (lines.length < 2) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "CSV must contain at least a header row and one data row",
		});
	}

	// Parse header (case-insensitive)
	const headerLine = lines[0];
	const headers = parseCsvLine(headerLine).map((h) =>
		h.toLowerCase().replace(/['"]/g, "").trim(),
	);

	// Find column indices
	const nameIndex = headers.indexOf("name");
	const descriptionIndex = headers.indexOf("description");
	const skuIndex = headers.indexOf("sku");
	const locationIndex = headers.indexOf("location");
	const minQuantityIndex = headers.findIndex((h) =>
		["minquantity", "min_quantity", "minqty"].includes(h),
	);
	const linkIndex = headers.indexOf("link");
	const isActiveIndex = headers.findIndex((h) =>
		["isactive", "is_active", "active"].includes(h),
	);
	const initialQuantityIndex = headers.findIndex((h) =>
		["initialquantity", "initial_quantity", "quantity", "qty"].includes(h),
	);
	// approvalRoles column: pipe-delimited list of role names (e.g., "Admin|Manager|Supervisor")
	const approvalRolesIndex = headers.findIndex((h) =>
		[
			"approvalroles",
			"approval_roles",
			"requiredroles",
			"required_roles",
		].includes(h),
	);

	if (nameIndex === -1) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: 'CSV must contain a "name" column (case-insensitive)',
		});
	}

	// If approvalRoles column exists, fetch all roles upfront to validate
	let roleMap: Map<string, number> = new Map();
	if (approvalRolesIndex !== -1) {
		const allRoles = await prisma.role.findMany({
			select: { id: true, name: true },
		});
		roleMap = new Map(allRoles.map((r) => [r.name.toLowerCase(), r.id]));
	}

	// Parse rows
	const itemsToCreate: Array<{
		name: string;
		description?: string;
		sku?: string;
		location?: string;
		minQuantity?: number;
		link?: string;
		isActive?: boolean;
		initialQuantity?: number;
		approvalRoleIds?: number[];
	}> = [];

	const errors: string[] = [];
	const skusInCsv = new Set<string>();

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		const values = parseCsvLine(line);
		const rowNum = i + 1;

		try {
			const name = values[nameIndex]?.replace(/^["']|["']$/g, "").trim();

			if (!name) {
				errors.push(`Row ${rowNum}: Name is required`);
				continue;
			}

			const sku =
				skuIndex !== -1
					? values[skuIndex]?.replace(/^["']|["']$/g, "").trim()
					: undefined;

			// Check for duplicate SKU within the CSV
			if (sku) {
				if (skusInCsv.has(sku.toLowerCase())) {
					errors.push(`Row ${rowNum}: Duplicate SKU "${sku}" in CSV`);
					continue;
				}
				skusInCsv.add(sku.toLowerCase());
			}

			const description =
				descriptionIndex !== -1
					? values[descriptionIndex]?.replace(/^["']|["']$/g, "").trim() ||
						undefined
					: undefined;

			const location =
				locationIndex !== -1
					? values[locationIndex]?.replace(/^["']|["']$/g, "").trim() ||
						undefined
					: undefined;

			const link =
				linkIndex !== -1
					? values[linkIndex]?.replace(/^["']|["']$/g, "").trim() || undefined
					: undefined;

			let minQuantity: number | undefined;
			if (minQuantityIndex !== -1) {
				const minQtyStr = values[minQuantityIndex]
					?.replace(/^["']|["']$/g, "")
					.trim();
				if (minQtyStr) {
					const parsed = Number.parseInt(minQtyStr, 10);
					if (Number.isNaN(parsed) || parsed < 0) {
						errors.push(
							`Row ${rowNum}: minQuantity must be a non-negative integer`,
						);
						continue;
					}
					minQuantity = parsed;
				}
			}

			let isActive: boolean | undefined;
			if (isActiveIndex !== -1) {
				const isActiveStr = values[isActiveIndex]
					?.replace(/^["']|["']$/g, "")
					.trim()
					.toLowerCase();
				if (isActiveStr) {
					if (["true", "1", "yes", "y"].includes(isActiveStr)) {
						isActive = true;
					} else if (["false", "0", "no", "n"].includes(isActiveStr)) {
						isActive = false;
					} else {
						errors.push(
							`Row ${rowNum}: isActive must be true/false, 1/0, yes/no, or y/n`,
						);
						continue;
					}
				}
			}

			let initialQuantity: number | undefined;
			if (initialQuantityIndex !== -1) {
				const initQtyStr = values[initialQuantityIndex]
					?.replace(/^["']|["']$/g, "")
					.trim();
				if (initQtyStr) {
					const parsed = Number.parseInt(initQtyStr, 10);
					if (Number.isNaN(parsed) || parsed < 0) {
						errors.push(
							`Row ${rowNum}: initialQuantity must be a non-negative integer`,
						);
						continue;
					}
					initialQuantity = parsed;
				}
			}

			// Parse approval roles (pipe-delimited list of role names)
			let approvalRoleIds: number[] | undefined;
			if (approvalRolesIndex !== -1) {
				const approvalRolesStr = values[approvalRolesIndex]
					?.replace(/^["']|["']$/g, "")
					.trim();
				if (approvalRolesStr) {
					const roleNames = approvalRolesStr
						.split("|")
						.map((r) => r.trim())
						.filter(Boolean);
					const resolvedIds: number[] = [];
					const unrecognizedRoles: string[] = [];

					for (const roleName of roleNames) {
						const roleId = roleMap.get(roleName.toLowerCase());
						if (roleId !== undefined) {
							resolvedIds.push(roleId);
						} else {
							unrecognizedRoles.push(roleName);
						}
					}

					if (unrecognizedRoles.length > 0) {
						errors.push(
							`Row ${rowNum}: Unrecognized role(s): ${unrecognizedRoles.join(", ")}. Available roles: ${Array.from(roleMap.keys()).join(", ")}`,
						);
						continue;
					}

					if (resolvedIds.length > 0) {
						approvalRoleIds = resolvedIds;
					}
				}
			}

			itemsToCreate.push({
				name,
				description,
				sku,
				location,
				minQuantity,
				link,
				isActive,
				initialQuantity,
				approvalRoleIds,
			});
		} catch (error) {
			errors.push(
				`Row ${rowNum}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	if (errors.length > 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `CSV validation errors:\n${errors.join("\n")}`,
		});
	}

	if (itemsToCreate.length === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "No valid items found in CSV",
		});
	}

	// Create items in a transaction
	const results = await prisma.$transaction(async (tx) => {
		const created: string[] = [];
		const failed: Array<{ name: string; error: string }> = [];

		for (const itemData of itemsToCreate) {
			try {
				// Generate SKU if not provided
				let sku = itemData.sku;
				if (!sku) {
					sku = await generateUniqueSku(tx);
				}

				// Check if SKU already exists
				const existingSku = await tx.item.findUnique({
					where: { sku },
					select: { id: true },
				});

				if (existingSku) {
					failed.push({
						name: itemData.name,
						error: `SKU "${sku}" already exists`,
					});
					continue;
				}

				const { initialQuantity, approvalRoleIds, ...itemFields } = itemData;

				// Create the item with approval roles if provided
				const item = await tx.item.create({
					data: {
						...itemFields,
						sku,
						approvalRoles: approvalRoleIds?.length
							? { connect: approvalRoleIds.map((id) => ({ id })) }
							: undefined,
					},
				});

				// Create initial snapshot if initialQuantity is provided
				if (initialQuantity !== undefined) {
					await tx.inventorySnapshot.create({
						data: {
							itemId: item.id,
							quantity: initialQuantity,
						},
					});
				}

				created.push(item.name);
			} catch (error) {
				failed.push({
					name: itemData.name,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}

		return { created, failed };
	});

	return {
		success: true,
		createdCount: results.created.length,
		failedCount: results.failed.length,
		created: results.created,
		failed: results.failed,
	};
}
