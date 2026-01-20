#!/usr/bin/env bun

import { $ } from "bun";
import { join } from "node:path";
import { readdir } from "node:fs/promises";

const workspaceRoot = join(import.meta.dir, "..");

async function findAndRemoveNodeModules(dir: string): Promise<void> {
	try {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isDirectory()) {
				const fullPath = join(dir, entry.name);

				if (entry.name === "node_modules") {
					console.log(`Removing: ${fullPath}`);
					await $`rm -rf ${fullPath}`;
				} else {
					// Recursively search subdirectories
					await findAndRemoveNodeModules(fullPath);
				}
			}
		}
	} catch (error) {
		// Skip directories we can't read
		if ((error as NodeJS.ErrnoException).code !== "EACCES") {
			throw error;
		}
	}
}

async function main() {
	console.log("🗑️  Removing all node_modules directories...");
	await findAndRemoveNodeModules(workspaceRoot);

	console.log("\n📦 Installing packages...");
	await $`bun install`.cwd(workspaceRoot);

	console.log("\n✅ Done!");
}

main().catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
