import { powerShellRelease, powerShellStart } from "systeminformation";
import { workspace } from "vscode";
import { getRefreshInterval } from "./configuration";
import { getEnabledMetrics, type Metric } from "./metrics";

let intervalIds: NodeJS.Timeout;
let metrics: Metric[] = [];

workspace.onDidChangeConfiguration((e) => {
	if (!e.affectsConfiguration("system-monitor")) return;
	deactivate();
	activate();
});

export const activate = async () => {
	if (process.platform === "win32") powerShellStart();
	for (const metric of metrics) metric.dispose();
	metrics = getEnabledMetrics();
	const updateBarsText = async () =>
		await Promise.all(metrics.map((x) => x.update()));
	intervalIds = setInterval(updateBarsText, getRefreshInterval());
};

export const deactivate = () => {
	if (process.platform === "win32") powerShellRelease();
	clearInterval(intervalIds);
	for (const metric of metrics) metric.dispose();
};
