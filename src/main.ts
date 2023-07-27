import prettyBytes from "pretty-bytes";
import { currentLoad, fsStats, mem, networkStats, powerShellRelease, powerShellStart } from "systeminformation";
import { ExtensionContext, StatusBarAlignment, window } from "vscode";

let intervalIds: NodeJS.Timer;

const getCurrentLoadText = async () => {
  const cl = await currentLoad();
  return `$(pulse)${cl.currentLoad.toFixed(2)}%`;
};

const getMemText = async () => {
  const m = await mem();
  return `$(server)${prettyBytes(m.active)}`;
};

const getNetworkStatsText = async () => {
  const ns = await networkStats();
  return `$(cloud-download)${prettyBytes(ns?.[0]?.rx_sec ?? 0)}$(cloud-upload)${prettyBytes(ns?.[0]?.tx_sec ?? 0)}`;
};

const getFsStatsText = async () => {
  const fs = await fsStats();
  return `$(log-in)${prettyBytes(fs.wx_sec ?? 0)}$(log-out)${prettyBytes(fs.rx_sec ?? 0)}`;
};

export const activate = async ({ subscriptions }: ExtensionContext) => {
  if (process.platform === "win32") powerShellStart();
  const cpuBar = newStatusBarItem({ name: "CPU load", priority: -1e3 - 1 });
  const memBar = newStatusBarItem({ name: "Memory usage", priority: -1e3 - 2 });
  const networkBar = newStatusBarItem({ name: "Network usage", priority: -1e3 - 3 });
  const fsBar = newStatusBarItem({ name: "File system usage", priority: -1e3 - 4 });
  subscriptions.push(cpuBar, memBar, networkBar, fsBar);
  const updateBarsText = async () => {
    const [currentLoadText, memText, networkStatsText, fsStatsText] = await Promise.all([getCurrentLoadText(), getMemText(), getNetworkStatsText(), getFsStatsText()]);
    cpuBar.text = currentLoadText;
    memBar.text = memText;
    networkBar.text = networkStatsText;
    fsBar.text = fsStatsText;
  };
  updateBarsText();
  intervalIds = setInterval(updateBarsText, 1000);
};

export const deactivate = () => {
  if (process.platform === "win32") powerShellRelease();
  clearInterval(intervalIds);
};

const newStatusBarItem = ({ name, priority }: { name: string; priority: number }) => {
  const sbi = window.createStatusBarItem(`ResMon: ${name}`, StatusBarAlignment.Left, priority);
  sbi.show();
  sbi.tooltip = name;
  sbi.name = sbi.id;
  return sbi;
};
