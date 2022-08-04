import { battery, cpuCurrentSpeed, cpuTemperature, currentLoad, fsSize, mem, networkStats } from "systeminformation";
import { ExtensionContext, StatusBarAlignment, window } from "vscode";

const intervalIds: NodeJS.Timer[] = [];

export const activate = async ({ subscriptions: sub }: ExtensionContext) => {
  let priority = -1000;
  sub.push(newSBI({ fn: cpuTemperature, text: (x) => `$(flame)${x.main?.toFixed(2) ?? -1}C`, name: "CPU temperature", priority: priority-- }));
  sub.push(newSBI({ fn: battery, text: (x) => `$(plug)${x.percent ?? -1}%`, name: "Battery charge", priority: priority-- }));
  sub.push(newSBI({ fn: cpuCurrentSpeed, text: (x) => `$(dashboard)${x.avg.toFixed(2)}GHz`, name: "CPU speed", priority: priority-- }));
  sub.push(newSBI({ fn: currentLoad, text: (x) => `$(pulse)${x.currentLoad.toFixed(2)}%`, name: "CPU load", priority: priority-- }));
  sub.push(newSBI({ fn: mem, text: (x) => `$(server)${formatBytes(x.active)}`, name: "Memory usage", priority: priority-- }));
  sub.push(newSBI({ fn: networkStats, text: (x) => `$(arrow-small-down)${formatBytes(x[0]?.rx_sec ?? 0)}$(arrow-small-up)${formatBytes(x[0]?.tx_sec ?? 0)}`, name: "Network usage", priority: priority-- }));
  sub.push(newSBI({ fn: fsSize, text: (x) => `$(database)${formatBytes(x.reduce((acc, cur) => acc + cur.used, 0))}`, name: "Filesystem usage", priority: priority }));
};

export const deactivate = () => intervalIds.forEach((id) => clearInterval(id));

interface NewSBIProps<T> {
  fn: () => Promise<T>;
  text: (value: T) => string;
  name: string;
  ms?: number;
  priority?: number;
}

const newSBI = <T>({ fn, text, name, ms = 1000, priority }: NewSBIProps<T>) => {
  const sbi = window.createStatusBarItem(`ResMon: ${name}`, StatusBarAlignment.Left, priority);
  sbi.show();
  sbi.tooltip = name;
  sbi.name = sbi.id;
  const updateTexts = async () => (sbi.text = text(await fn()));
  updateTexts();
  intervalIds.push(setInterval(updateTexts, ms));
  return sbi;
};

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0b";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(dm)}${sizes[i]}`;
};
