import { powerShellRelease, powerShellStart } from "systeminformation";
import { workspace } from "vscode";
import { getRefreshInterval } from "./configuration";
import { Metric, getEnabledMetrics } from "./metrics";

let intervalIds: NodeJS.Timeout;
let metrics: Metric[] = [];

workspace.onDidChangeConfiguration(() => {
  deactivate();
  activate();
});

export const activate = async () => {
  if (process.platform === "win32") powerShellStart();
  metrics.forEach((x) => x.dispose());
  metrics = getEnabledMetrics();
  const updateBarsText = async () => await Promise.all(metrics.map((x) => x.update()));
  intervalIds = setInterval(updateBarsText, getRefreshInterval());
};

export const deactivate = () => {
  if (process.platform === "win32") powerShellRelease();
  clearInterval(intervalIds);
  metrics.forEach((x) => x.dispose());
};
