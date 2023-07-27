import prettyBytes from "pretty-bytes";
import { get, powerShellRelease, powerShellStart } from "systeminformation";
import { ExtensionContext, StatusBarAlignment, window } from "vscode";

let intervalIds: NodeJS.Timer;

interface GetAllResult {
  currentLoad: { currentLoad: number };
  mem: { active: number };
  networkStats: { rx_sec: number | null; tx_sec: number | null }[];
  fsStats: { rx_sec: number | null; wx_sec: number | null };
}

export const activate = async ({ subscriptions }: ExtensionContext) => {
  if (process.platform === "win32") powerShellStart();
  const cpuBar = newStatusBarItem({ name: "CPU load", priority: -1e3 - 1 });
  const memBar = newStatusBarItem({ name: "Memory usage", priority: -1e3 - 2 });
  const networkBar = newStatusBarItem({ name: "Network usage", priority: -1e3 - 3 });
  const fsBar = newStatusBarItem({ name: "File system usage", priority: -1e3 - 4 });
  subscriptions.push(cpuBar, memBar, networkBar, fsBar);
  const updateBarsText = async () => {
    const { currentLoad, mem, networkStats, fsStats }: GetAllResult = await get({ currentLoad: "currentLoad", mem: "active", networkStats: "rx_sec,tx_sec", fsStats: "rx_sec,wx_sec" });
    const currentLoadText = `$(pulse)${currentLoad.currentLoad.toFixed(2)}%`;
    const memText = `$(server)${prettyBytes(mem.active)}`;
    const networkStatsText = `$(cloud-download)${prettyBytes(networkStats?.[0]?.rx_sec ?? 0)}$(cloud-upload)${prettyBytes(networkStats?.[0]?.tx_sec ?? 0)}`;
    const fsStatsText = `$(log-in)${prettyBytes(fsStats.wx_sec ?? 0)}$(log-out)${prettyBytes(fsStats.rx_sec ?? 0)}`;
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
