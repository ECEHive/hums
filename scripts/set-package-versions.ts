#!/usr/bin/env node
import { access, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

type CliOptions = {
	check: boolean;
	dryRun: boolean;
	verbose: boolean;
};

type PkgMismatch = {
	filePath: string;
	currentVersion: string | null;
};

type PkgUpdate = {
	filePath: string;
	from: string | null;
};

type PackageJson = {
	version?: string;
	[key: string]: unknown;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const helpText = `Usage: bun set-version <version> [--check] [--dry-run] [--verbose]

Arguments:
  <version>   Version to apply (accepts optional leading 'v').

Options:
  --check     Only verify that all package.json files already use <version>.
  --dry-run   Show the planned updates without writing to disk (ignored in --check mode).
  --verbose   Print every processed package.json file.
`;

function printHelp(exitCode = 0): never {
	console.log(helpText.trim());
	process.exit(exitCode);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.length === 0) {
		console.error("Missing version argument.\n");
		printHelp(1);
	}

	const [versionInput, ...flagArgs] = args;
	const flags = new Set(flagArgs);

	if (flags.has("--help") || flags.has("-h")) {
		printHelp(0);
	}

	const version = versionInput.startsWith("v")
		? versionInput.slice(1)
		: versionInput;
	const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?$/;
	if (!semverPattern.test(version)) {
		console.error(
			`Invalid version: ${version}. Expected semantic version like 1.2.3 or 1.2.3-beta.\n`,
		);
		printHelp(1);
	}

	const options: CliOptions = {
		check: flags.has("--check"),
		dryRun: flags.has("--dry-run"),
		verbose: flags.has("--verbose"),
	};

	const knownFlags = new Set([
		"--check",
		"--dry-run",
		"--verbose",
		"--help",
		"-h",
	]);
	for (const flag of flags) {
		if (!knownFlags.has(flag)) {
			console.error(`Unknown option: ${flag}\n`);
			printHelp(1);
		}
	}

	if (options.check) {
		options.dryRun = false;
	}

	const packageCandidates = [
		path.join(repoRoot, "package.json"),
		...(await collectWorkspacePackages(path.join(repoRoot, "apps"))),
		...(await collectWorkspacePackages(path.join(repoRoot, "packages"))),
	];

	const existingFiles: string[] = [];
	for (const target of packageCandidates) {
		if (await fileExists(target)) {
			existingFiles.push(target);
		}
	}

	if (existingFiles.length === 0) {
		console.warn("No package.json files found to update.");
		return;
	}

	const mismatches: PkgMismatch[] = [];
	const updates: PkgUpdate[] = [];
	let alreadyAligned = 0;

	for (const filePath of existingFiles) {
		const raw = await readFile(filePath, "utf8");
		const pkg = JSON.parse(raw) as PackageJson;
		const currentVersion = typeof pkg.version === "string" ? pkg.version : null;

		if (options.verbose) {
			console.log(
				`• ${path.relative(repoRoot, filePath)} (current: ${currentVersion ?? "<unset>"})`,
			);
		}

		if (options.check) {
			if (currentVersion !== version) {
				mismatches.push({ filePath, currentVersion });
			}
			continue;
		}

		if (currentVersion === version) {
			alreadyAligned += 1;
			continue;
		}

		pkg.version = version;
		const indent = detectIndent(raw);
		const serialized = `${JSON.stringify(pkg, null, indent)}\n`;

		if (!options.dryRun) {
			await writeFile(filePath, serialized, "utf8");
		}

		updates.push({ filePath, from: currentVersion });
	}

	if (options.check) {
		if (mismatches.length > 0) {
			console.error(
				`Found ${mismatches.length} package.json file(s) with mismatched versions:`,
			);
			for (const mismatch of mismatches) {
				const relativePath = path.relative(repoRoot, mismatch.filePath);
				console.error(
					`  - ${relativePath}: ${mismatch.currentVersion ?? "<unset>"} (expected ${version})`,
				);
			}
			console.error(
				"\nRun 'bun set-version " +
					`${version}` +
					"' to synchronize package versions.",
			);
			process.exit(1);
		}
		console.log(
			`All ${existingFiles.length} package.json file(s) match version ${version}.`,
		);
		return;
	}

	if (updates.length === 0) {
		if (alreadyAligned === existingFiles.length) {
			console.log(
				`All ${existingFiles.length} package.json file(s) already at version ${version}.`,
			);
		} else if (options.dryRun) {
			console.log(
				`Dry run complete. ${existingFiles.length - alreadyAligned} file(s) would be updated.`,
			);
		}
		return;
	}

	const summaryAction = options.dryRun ? "Would update" : "Updated";
	console.log(
		`${summaryAction} ${updates.length} package.json file(s) to version ${version}.`,
	);
	for (const change of updates) {
		const relativePath = path.relative(repoRoot, change.filePath);
		console.log(
			`  - ${relativePath}: ${change.from ?? "<unset>"} -> ${version}`,
		);
	}

	if (options.dryRun) {
		console.log("Dry run enabled. No files were modified.");
	}
}

function detectIndent(content: string): string {
	const lines = content.split(/\r?\n/);
	for (const line of lines) {
		if (!line.trim()) continue;
		const match = line.match(/^\s+/);
		if (match) {
			return match[0];
		}
	}
	return "\t";
}

async function collectWorkspacePackages(dir: string): Promise<string[]> {
	if (!(await directoryExists(dir))) {
		return [];
	}

	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory() || entry.name.startsWith(".")) {
			continue;
		}
		if (entry.name === "node_modules") {
			continue;
		}
		const pkgPath = path.join(dir, entry.name, "package.json");
		files.push(pkgPath);
	}

	return files;
}

async function fileExists(targetPath: string): Promise<boolean> {
	try {
		await access(targetPath);
		return true;
	} catch {
		return false;
	}
}

async function directoryExists(targetPath: string): Promise<boolean> {
	try {
		const stats = await stat(targetPath);
		return stats.isDirectory();
	} catch {
		return false;
	}
}

void main().catch((error) => {
	console.error(error);
	process.exit(1);
});
