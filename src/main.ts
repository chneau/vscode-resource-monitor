import { battery, cpuCurrentSpeed, cpuTemperature, currentLoad, fsSize, mem, networkStats } from "systeminformation";
import { ExtensionContext, window } from "vscode";

const intervalIds: NodeJS.Timer[] = [];

export const activate = async ({ subscriptions: sub }: ExtensionContext) => {
  sub.push(await newSBI({ fn: async () => `$(pulse) ${(await currentLoad()).currentLoad.toFixed(2)}%`, tooltip: "Current CPU load" }));
  (await cpuTemperature()).main && sub.push(await newSBI({ fn: async () => `$(flame) ${(await cpuTemperature()).main.toFixed(2)}C`, tooltip: "CPU temperature" }));
  sub.push(await newSBI({ fn: async () => `$(dashboard) ${(await cpuCurrentSpeed()).avg.toFixed(2)}GHz`, tooltip: "CPU average speed" }));
  (await battery()).hasBattery && sub.push(await newSBI({ fn: async () => `$(plug) ${(await battery()).percent}%`, tooltip: "Battery charge" }));
  sub.push(await newSBI({ fn: async () => `$(server) ${formatBytes((await mem()).active)}`, tooltip: "Memory usage" }));
  sub.push(await newSBI({ fn: async () => `$(arrow-small-down) ${formatBytes((await networkStats())[0]?.rx_sec ?? 0)}`, tooltip: "Network download" }));
  sub.push(await newSBI({ fn: async () => `$(arrow-small-up) ${formatBytes((await networkStats())[0]?.tx_sec ?? 0)}`, tooltip: "Network upload" }));
  sub.push(await newSBI({ fn: async () => `$(database) ${formatBytes((await fsSize()).reduce((acc, cur) => acc + cur.used, 0))}`, tooltip: "Filesystem usage" }));
};

export const deactivate = () => intervalIds.forEach((id) => clearInterval(id));

const newSBI = async ({ fn, tooltip }: { fn: () => Promise<string>; tooltip: string }) => {
  const sbi = window.createStatusBarItem();
  sbi.text = await fn();
  sbi.tooltip = tooltip;
  sbi.show();
  const intervalId = setInterval(async () => (sbi.text = await fn()), 1000);
  intervalIds.push(intervalId);
  return sbi;
};

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0b";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`;
};
