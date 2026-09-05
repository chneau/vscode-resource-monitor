import { powerShellRelease, powerShellStart } from "systeminformation";
import { commands, type ExtensionContext, window, workspace } from "vscode";
import { getRefreshInterval, openConfigurationMenu } from "./configuration";
import { metricDefinitions } from "./metricDefinitions";
import {
	getEnabledMetrics,
	hasHeavyMetrics,
	type Metric,
} from "./metrics";

let intervalId: NodeJS.Timeout | undefined;
let metrics: Metric[] = [];
let isPowerShellStarted = false;
let isPolling = false;

const stopPolling = () => {
	if (intervalId) {
		clearInterval(intervalId);
		intervalId = undefined;
	}
	isPolling = false;
};

const startPolling = () => {
	stopPolling();
	if (metrics.length === 0) return;
	const updateBarsText = async () => {
		if (isPolling) return;
		isPolling = true;
		try {
			await Promise.all(metrics.map((x) => x.update()));
		} finally {
			isPolling = false;
		}
	};
	updateBarsText();
	intervalId = setInterval(updateBarsText, getRefreshInterval());
};

const refreshMetrics = () => {
	for (const metric of metrics) metric.dispose();
	metrics = getEnabledMetrics();

	if (process.platform === "win32") {
		const hasHeavy = hasHeavyMetrics();
		if (hasHeavy && !isPowerShellStarted) {
			powerShellStart();
			isPowerShellStarted = true;
		} else if (!hasHeavy && isPowerShellStarted) {
			powerShellRelease();
			isPowerShellStarted = false;
		}
	}

	if (metrics.length === 0) return;
	if (window.state.focused) startPolling();
};

export const activate = (context: ExtensionContext) => {
	context.subscriptions.push(
		commands.registerCommand(
			"resource-monitor.openMenu",
			() => openConfigurationMenu(metricDefinitions),
		),
		workspace.onDidChangeConfiguration((e) => {
			if (!e.affectsConfiguration("resource-monitor")) return;
			stopPolling();
			refreshMetrics();
		}),
		window.onDidChangeWindowState((e) => {
			if (e.focused) {
				startPolling();
			} else {
				stopPolling();
			}
		}),
	);
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
