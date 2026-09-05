// Regenerates the README screenshots by driving a real (desktop) VS Code
// instance with the extension loaded:
//
//   - images/bar.png      the status bar with every metric enabled
//   - images/tooltip.png  the hover tooltip of the CPU metric
//   - images/menu.png     the "Configure Components" quick pick
//   - images/settings.png the settings page filtered to this extension
//
// Requirements:
//   - A desktop VS Code build (code / code-insiders / codium) reachable via
//     $VSCODE_BIN or on $PATH. The vscode-server "remote-cli" shim is NOT a
//     desktop app and cannot be used.
//   - `bun install` (playwright-core is the Electron driver).
//   - On headless Linux, an X server is auto-started via Xvfb if none is
//     running (requires the `Xvfb` binary); ImageMagick's `import` is used as
//     a fallback to capture native tooltips that Chromium paints outside the
//     page (e.g. the plain-text tooltip of a status bar item).
//
// Usage:  bun run screenshots
// Env:    VSCODE_BIN=<path>            override the VS Code executable
//         SCREENSHOT_OUT_DIR=<dir>     output directory (default: images/)
//         SCREENSHOT_KEEP_TMP=1        keep the temporary profile directories
import { spawn, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	_electron,
	type ElectronApplication,
	type Page,
} from "playwright-core";

const projectRoot = path.resolve(__dirname, "..");
const outDir = path.resolve(
	projectRoot,
	process.env.SCREENSHOT_OUT_DIR ?? "images",
);
const keepTmp = process.env.SCREENSHOT_KEEP_TMP === "1";
const viewport = { width: 1440, height: 900 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message: string): never {
	console.error(`\n✖ ${message}\n`);
	process.exit(1);
}

function log(step: string) {
	console.log(`• ${step}`);
}

// --- VS Code binary ---------------------------------------------------------

function commandOnPath(name: string): string | undefined {
	const res = spawnSync("which", [name], { encoding: "utf8" });
	return res.status === 0 ? res.stdout.trim() : undefined;
}

// --- WSL interop ------------------------------------------------------------
// Inside WSL we can drive the Windows VS Code install through the /mnt/c
// mount. Windows can't read raw Linux paths, so any path handed to the Windows
// process must be rewritten to a \\wsl.localhost\<distro>\ UNC path.

function wslDistro(): string | undefined {
	if (process.platform !== "linux") return undefined;
	if (!process.env.WSL_DISTRO_NAME || !existsSync("/mnt/c")) return undefined;
	return process.env.WSL_DISTRO_NAME;
}

// Windows VS Code installs (as seen through /mnt/c) on this WSL machine.
function wslWindowsVscodeCandidates(): string[] {
	const found: string[] = [];
	const mount = (windowsPath: string) => {
		const rel = windowsPath.replace(/\\/g, "/").replace(/^[A-Za-z]:/, "");
		const mounted = `/mnt/c${rel}`;
		if (existsSync(mounted)) found.push(mounted);
	};
	mount("C:\\Program Files\\Microsoft VS Code\\Code.exe");
	mount("C:\\Program Files\\Microsoft VS Code Insiders\\Code - Insiders.exe");
	try {
		for (const user of readdirSync("/mnt/c/Users")) {
			mount(
				`C:\\Users\\${user}\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe`,
			);
			mount(
				`C:\\Users\\${user}\\AppData\\Local\\Programs\\Microsoft VS Code Insiders\\Code - Insiders.exe`,
			);
		}
	} catch {
		// ignore unreadable user dirs
	}
	return found;
}

const needsWindowsPaths = (binary: string) => binary.startsWith("/mnt/c/");

function findVscodeBinary(): string {
	const explicit = process.env.VSCODE_BIN?.trim();
	const candidates = explicit
		? [explicit]
		: [
				commandOnPath("code-insiders"),
				commandOnPath("codium"),
				commandOnPath("code"),
				...(process.platform === "darwin"
					? [
							"/Applications/Visual Studio Code.app/Contents/MacOS/Electron",
							"/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Electron",
							"/Applications/VSCodium.app/Contents/MacOS/Electron",
						]
					: []),
				...(process.platform === "win32"
					? [
							path.join(
								process.env.LOCALAPPDATA ?? "",
								"Programs/Microsoft VS Code/Code.exe",
							),
							path.join(
								process.env.LOCALAPPDATA ?? "",
								"Programs/Microsoft VS Code Insiders/Code - Insiders.exe",
							),
						]
					: []),
				...(process.platform === "linux"
					? [
							"/usr/share/code/code",
							"/usr/bin/codium",
							"/usr/bin/code",
							"/snap/bin/code",
						]
					: []),
				...(wslDistro() ? wslWindowsVscodeCandidates() : []),
			].filter((c): c is string => Boolean(c));

	// The vscode-server "code" on $PATH (e.g. inside a dev container) is a
	// remote CLI shim, not the desktop Electron app — driving it would fail
	// with an unhelpful "Process failed to launch!". Skip it and say so.
	const isRemoteShim = (p: string) => /remote-cli|vscode-server/i.test(p);
	let skippedRemoteShim = false;
	for (const candidate of candidates) {
		if (!candidate) continue;
		if (isRemoteShim(candidate)) {
			skippedRemoteShim = true;
			continue;
		}
		try {
			if (statSync(candidate).isFile()) return candidate;
		} catch {
			// not a regular file (missing, directory, broken link)
		}
	}
	const hint = skippedRemoteShim
		? [
				"The only 'code' on this system is the vscode-server remote-cli shim,",
				"which is not a desktop app and cannot be driven.",
			]
		: ["Could not find a desktop VS Code executable."];
	fail(
		[
			...hint,
			"Install VS Code, or point the script at it with:",
			"",
			"  VSCODE_BIN=/path/to/code bun run screenshots",
		].join("\n"),
	);
}

// --- X server (headless Linux) ----------------------------------------------

let xvfb: ReturnType<typeof spawn> | undefined;

function ensureDisplay() {
	if (process.env.DISPLAY) return;
	const hasXvfb =
		spawnSync("which", ["Xvfb"], { encoding: "utf8" }).status === 0;
	if (!hasXvfb) {
		fail(
			"No DISPLAY is set and Xvfb was not found.\n" +
				"Run under an X server, e.g.:  xvfb-run -a bun run screenshots",
		);
	}
	const display = ":97";
	xvfb = spawn(
		"Xvfb",
		[display, "-screen", "0", "1920x1080x24", "-nolisten", "tcp"],
		{ stdio: "ignore" },
	);
	process.env.DISPLAY = display;
	log(`started Xvfb on ${display}`);
	sleep(1500);
}

// --- Temporary profile ------------------------------------------------------

const tempRoot = mkdtempSync(path.join(tmpdir(), "rm-screenshots-"));
const cleanupTemp = () => {
	if (!keepTmp && existsSync(tempRoot)) {
		rmSync(tempRoot, { recursive: true, force: true });
	}
};
process.once("exit", cleanupTemp); // covers process.exit() on failure paths
const userDataDir = path.join(tempRoot, "user-data");
const extensionsDir = path.join(tempRoot, "extensions");
mkdirSync(path.join(userDataDir, "User"), { recursive: true });
mkdirSync(extensionsDir, { recursive: true });

// Dark theme, every metric enabled (battery/temperature hidden by default),
// and a quiet, deterministic UI.
writeFileSync(
	path.join(userDataDir, "User", "settings.json"),
	JSON.stringify(
		{
			"workbench.colorTheme": "Default Dark Modern",
			"window.zoomLevel": 0,
			"window.titleBarStyle": "native",
			"editor.minimap.enabled": false,
			"workbench.startupEditor": "none",
			"security.workspace.trust.enabled": false,
			"update.mode": "none",
			"telemetry.telemetryLevel": "off",
			"resource-monitor.cpu": 1,
			"resource-monitor.memory": 2,
			"resource-monitor.network": 3,
			"resource-monitor.file-system": 4,
			"resource-monitor.gpu": 5,
			"resource-monitor.battery": 6,
			"resource-monitor.temperature": 7,
		},
		null,
		"\t",
	),
);

// --- Helpers over the workbench DOM -----------------------------------------
// Kept DOM-free (locator-based) so the scripts stay typecheckable under the
// project's lib "ES2020" (no DOM library).

async function hasStatusBar(page: Page): Promise<boolean> {
	return page
		.locator(".part.statusbar .statusbar-item")
		.first()
		.waitFor({ state: "attached", timeout: 2500 })
		.then(() => true)
		.catch(() => false);
}

// The CPU item is the only status bar entry whose text ends in "%".
async function waitForCpuMetric(page: Page, timeoutMs: number) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if ((await metricItem(page).count()) > 0) return;
		await sleep(500);
	}
	fail("Timed out waiting for the CPU metric to appear in the status bar.");
}

function metricItem(page: Page) {
	return page.locator(".part.statusbar .statusbar-item").filter({
		hasText: /%\s*$/,
	});
}

async function screenshotStatusBar(page: Page) {
	const bar = page.locator(".part.statusbar");
	await bar.screenshot({ path: path.join(outDir, "bar.png") });
	log("wrote images/bar.png");
}

async function screenshotTooltip(page: Page) {
	const item = metricItem(page).first();
	const box = await item.boundingBox();
	if (!box) {
		console.warn("  ⚠ could not locate the CPU item for the tooltip shot");
		return;
	}

	// Custom (DOM) hover widget — some VS Code builds render tooltips this way.
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	const domHover = page.locator(".monaco-hover");
	const deadline = Date.now() + 3000;
	let hoverVisible = false;
	while (Date.now() < deadline) {
		if (
			await domHover
				.first()
				.isVisible()
				.catch(() => false)
		) {
			hoverVisible = true;
			break;
		}
		await sleep(200);
	}
	if (hoverVisible) {
		await domHover.first().screenshot({
			path: path.join(outDir, "tooltip.png"),
		});
		log("wrote images/tooltip.png (DOM hover)");
		await page.mouse.move(5, 5);
		return;
	}

	// Native tooltip (title attribute) — painted outside the page by Chromium,
	// so fall back to capturing the X root window around the cursor.
	const hasImport =
		spawnSync("which", ["import"], { encoding: "utf8" }).status === 0;
	if (hasImport && process.env.DISPLAY) {
		const w = 560;
		const h = 320;
		const x = Math.max(0, Math.round(box.x + box.width / 2 - w / 2));
		const y = Math.max(0, Math.round(box.y - h + 40));
		const target = path.join(outDir, "tooltip.png");
		const res = spawnSync(
			"import",
			["-window", "root", "-crop", `${w}x${h}+${x}+${y}`, target],
			{ encoding: "utf8" },
		);
		if (res.status === 0 && existsSync(target) && statSync(target).size > 0) {
			log("wrote images/tooltip.png (native tooltip via X11 capture)");
			await page.mouse.move(5, 5);
			return;
		}
	}
	console.warn(
		"  ⚠ tooltip not captured: no DOM hover appeared and no X11 capture was possible.\n" +
			"    Install ImageMagick (`import`) or run on a real X server to capture the native tooltip.",
	);
	await page.mouse.move(5, 5);
}

async function screenshotMenu(page: Page) {
	const item = metricItem(page).first();
	await item.click();
	const quickPick = page.locator(".quick-input-widget");
	await quickPick
		.waitFor({ state: "visible", timeout: 10000 })
		.catch(() => undefined);
	if (!(await quickPick.isVisible().catch(() => false))) {
		// Fallback: run the command from the command palette instead.
		await page.keyboard.press("Control+Shift+P");
		await page
			.locator(".quick-input-widget input")
			.waitFor({ state: "visible", timeout: 10000 });
		await page.keyboard.type("Resource Monitor: Configure");
		await page.keyboard.press("Enter");
		await quickPick.waitFor({ state: "visible", timeout: 10000 });
	}
	await sleep(600); // let the checkboxes render
	await quickPick.screenshot({ path: path.join(outDir, "menu.png") });
	log("wrote images/menu.png");
}

async function screenshotSettings(page: Page) {
	// The quick pick is still open: its gear button opens the settings page
	// filtered to this extension. Fall back to Ctrl+, (Settings UI) if needed.
	const gear = page.locator(".quick-input-widget .codicon-settings-gear");
	await gear
		.first()
		.click({ timeout: 5000 })
		.catch(() => undefined);
	let settingsVisible = await page
		.locator(".settings-editor")
		.waitFor({ state: "visible", timeout: 10000 })
		.then(() => true)
		.catch(() => false);
	if (!settingsVisible) {
		await page.keyboard.press("Control+,");
		settingsVisible = await page
			.locator(".settings-editor")
			.waitFor({ state: "visible", timeout: 10000 })
			.then(() => true)
			.catch(() => false);
	}
	if (!settingsVisible) {
		console.warn("  ⚠ settings page did not open; skipping settings.png");
		return;
	}
	await sleep(1200); // let the search filter apply
	await page.screenshot({ path: path.join(outDir, "settings.png") });
	log("wrote images/settings.png");
}

// --- Run --------------------------------------------------------------------

async function main() {
	mkdirSync(outDir, { recursive: true });
	const executablePath = findVscodeBinary();
	log(`VS Code: ${executablePath}`);
	if (needsWindowsPaths(executablePath)) {
		log("driving the Windows VS Code install via WSL interop");
	}
	ensureDisplay();
	log(`output: ${outDir}`);

	// When driving a Windows VS Code build from WSL, Linux paths must be
	// rewritten to \\wsl.localhost\<distro>\ UNC paths the Windows process can
	// read (raw /home/... or /tmp/... paths would not resolve there).
	const toAppPath = (p: string) =>
		needsWindowsPaths(executablePath)
			? `//wsl.localhost/${process.env.WSL_DISTRO_NAME}/${p.replace(
					/^\/+/,
					"",
				)}`
			: p;

	const launchArgs = [
		`--user-data-dir=${toAppPath(userDataDir)}`,
		`--extensions-dir=${toAppPath(extensionsDir)}`,
		`--extensionDevelopmentPath=${toAppPath(projectRoot)}`,
		"--disable-telemetry",
		"--disable-updates",
		"--disable-crash-reporter",
		"--disable-gpu",
		"--skip-welcome",
		"--skip-release-notes",
		"--no-first-run",
	];
	if (
		!needsWindowsPaths(executablePath) &&
		typeof process.getuid === "function" &&
		process.getuid() === 0
	) {
		launchArgs.push("--no-sandbox");
	}

	// Open a readable file so the editor has content behind the menus.
	const sampleFile = toAppPath(path.join(projectRoot, "README.md"));

	let app: ElectronApplication | undefined;
	try {
		log("launching VS Code…");
		app = await _electron.launch({
			executablePath,
			args: [...launchArgs, sampleFile],
			env: { ...process.env, DISPLAY: process.env.DISPLAY ?? "" },
			timeout: 120_000,
		});
		let page = await app.firstWindow();

		// Some builds briefly open a splash/auxiliary window first.
		const startupDeadline = Date.now() + 120_000;
		while (Date.now() < startupDeadline) {
			if (await hasStatusBar(page).catch(() => false)) break;
			const next = await app
				.waitForEvent("window", { timeout: 5000 })
				.catch(() => undefined);
			if (next) page = next;
		}
		if (!(await hasStatusBar(page))) {
			fail("VS Code started but the workbench never appeared.");
		}

		await app.evaluate(
			({ BrowserWindow }, size: { width: number; height: number }) => {
				const win = BrowserWindow.getAllWindows()[0];
				win?.setSize(size.width, size.height);
			},
			viewport,
		);
		await page.setViewportSize(viewport).catch(() => undefined);
		await sleep(2000);

		log("waiting for the CPU metric…");
		await waitForCpuMetric(page, 60_000);
		await sleep(6000); // let all metrics produce their second sample

		await screenshotStatusBar(page);
		await screenshotTooltip(page);
		await screenshotMenu(page);
		await screenshotSettings(page);

		console.log(`\n✔ Screenshots written to ${outDir}`);
	} catch (error) {
		fail(
			`Screenshot run failed: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	} finally {
		await app?.close().catch(() => undefined);
		xvfb?.kill();
		cleanupTemp();
	}
}

main();
