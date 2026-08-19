import { powerShellRelease, powerShellStart } from "systeminformation";
import { window, workspace } from "vscode";
import { getRefreshInterval } from "./configuration";
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

workspace.onDidChangeConfiguration((e) => {
	if (!e.affectsConfiguration("resource-monitor")) return;
	deactivate();
	activate();
});

window.onDidChangeWindowState((e) => {
	if (e.focused) {
		startPolling();
	} else {
		stopPolling();
	}
});

export const activate = async () => {
	for (const metric of metrics) metric.dispose();
	metrics = getEnabledMetrics();
	if (metrics.length === 0) return;

	if (process.platform === "win32" && hasHeavyMetrics()) {
		powerShellStart();
		isPowerShellStarted = true;
	}

	if (window.state.focused) {
		startPolling();
	}
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
