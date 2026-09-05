// Regenerates the per-metric settings under package.json's
// "contributes.configuration.properties" from src/metricDefinitions.ts, which
// is the single source of truth for metric keys, defaults, and descriptions.
//
// Run with:            bun run sync:package   (also runs automatically on build)
// Verify up to date:   bun run check:package  (exits 1 if package.json drifted)
//
// This module intentionally imports nothing from "vscode", so it can run
// outside the extension host.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { metricDefinitions } from "../src/metricDefinitions";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
const current = readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(current) as {
	contributes: {
		configuration: { properties: Record<string, object> };
	};
};

// Settings not owned by a metric (authored directly in package.json) are kept
// as-is and appended after the generated metric entries.
const isMetricKey = (key: string) =>
	metricDefinitions.some((def) => def.key === key);

const properties: Record<string, object> = {};
for (const def of metricDefinitions) {
	properties[def.key] = {
		type: "number",
		default: def.default,
		description: def.description,
	};
}
for (const [key, value] of Object.entries(
	pkg.contributes.configuration.properties,
)) {
	if (!isMetricKey(key)) properties[key] = value;
}

pkg.contributes.configuration.properties = properties;
const next = `${JSON.stringify(pkg, null, "\t")}\n`;

if (next === current) {
	process.exit(0);
}
if (process.argv.includes("--check")) {
	console.error(
		"package.json is out of date. Run `bun run sync:package` (or `bun run build`) and commit the result.",
	);
	process.exit(1);
}
writeFileSync(pkgPath, next);
