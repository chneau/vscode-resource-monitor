import { powerShellRelease, powerShellStart } from "systeminformation";
import { workspace } from "vscode";
import { Metric, cpuMetric, fileSystemMetric, memoryMetric, networkMetric } from "./metrics";

let intervalIds: NodeJS.Timeout;
let metrics: Metric[] = [];

workspace.onDidChangeConfiguration(() => {
  deactivate();
  activate();
});

export const activate = async () => {
  if (process.platform === "win32") powerShellStart();
  metrics.forEach((metric) => metric.dispose());
  metrics = [];
  metrics = [cpuMetric, memoryMetric, networkMetric, fileSystemMetric];
  metrics.forEach((x) => x.init());
  metrics = metrics.filter((x) => x.enabled);
  const updateBarsText = async () => await Promise.all(metrics.map((metric) => metric.update()));
  intervalIds = setInterval(updateBarsText, 1000);
};

export const deactivate = () => {
  if (process.platform === "win32") powerShellRelease();
  clearInterval(intervalIds);
  metrics.forEach((metric) => metric.dispose());
};
