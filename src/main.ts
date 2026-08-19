import { powerShellRelease, powerShellStart } from "systeminformation";
import { commands, type ExtensionContext, window, workspace } from "vscode";
import { getRefreshInterval, openConfigurationMenu } from "./configuration";
import {
	getEnabledMetrics,
	hasHeavyMetrics,
	type Metric,
	resetCpuUsage,
} from "./metrics";

let intervalId: NodeJS.Timeout | undefined;
let metrics: Metric[] = [];
let isPowerShellStarted = false;

const stopPolling = () => {
	if (intervalId) {
		clearInterval(intervalId);
		intervalId = undefined;
	}
};

const startPolling = () => {
	stopPolling();
	resetCpuUsage();
	const updateBarsText = async () => {
		await Promise.all(metrics.map((x) => x.update()));
	};
	updateBarsText();
	intervalId = setInterval(updateBarsText, getRefreshInterval());
};

const refreshMetrics = () => {
	for (const metric of metrics) metric.dispose();
	metrics = getEnabledMetrics();
	if (metrics.length === 0) return;

	if (
		process.platform === "win32" &&
		hasHeavyMetrics() &&
		!isPowerShellStarted
	) {
		powerShellStart();
		isPowerShellStarted = true;
	}

	if (window.state.focused) {
		startPolling();
	}
};

workspace.onDidChangeConfiguration((e) => {
	if (!e.affectsConfiguration("resource-monitor")) return;
	stopPolling();
	refreshMetrics();
});

window.onDidChangeWindowState((e) => {
	if (e.focused) {
		startPolling();
	} else {
		stopPolling();
	}
});

export const activate = async (context?: ExtensionContext) => {
	const cmd = commands.registerCommand(
		"resource-monitor.openMenu",
		openConfigurationMenu,
	);
	if (context) {
		context.subscriptions.push(cmd);
	}
	refreshMetrics();
};

export const deactivate = () => {
	stopPolling();
	if (process.platform === "win32" && isPowerShellStarted) {
		powerShellRelease();
		isPowerShellStarted = false;
	}
	for (const metric of metrics) metric.dispose();
	metrics = [];
};
