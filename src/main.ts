import { powerShellRelease, powerShellStart } from "systeminformation";
import { ExtensionContext } from "vscode";
import { Metric, cpuMetric, fileSystemMetric, memoryMetric, networkMetric } from "./metrics";

let intervalIds: NodeJS.Timeout;

export const activate = async ({ subscriptions }: ExtensionContext) => {
  if (process.platform === "win32") powerShellStart();
  let cpuMetrics: Metric[] = [cpuMetric, memoryMetric, networkMetric, fileSystemMetric];
  cpuMetrics.forEach((metric) => metric.init());
  cpuMetrics = cpuMetrics.filter((metric) => metric.enabled);
  subscriptions.push(...cpuMetrics.map((metric) => metric.bar));
  const updateBarsText = async () => await Promise.all(cpuMetrics.map((metric) => metric.update()));
  intervalIds = setInterval(updateBarsText, 1000);
};

export const deactivate = () => {
  if (process.platform === "win32") powerShellRelease();
  clearInterval(intervalIds);
};
