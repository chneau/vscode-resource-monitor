import { battery, cpuCurrentSpeed, cpuTemperature, currentLoad, mem, networkStats } from "systeminformation";
import { ExtensionContext, window } from "vscode";

const intervalIds: NodeJS.Timer[] = [];

export const activate = async ({ subscriptions: sub }: ExtensionContext) => {
  sub.push(await newSBI(async () => `$(pulse) ${(await currentLoad()).currentLoad.toFixed(2)}`));
  (await cpuTemperature()).main && sub.push(await newSBI(async () => `$(flame) ${(await cpuTemperature()).main.toFixed(2)}%`));
  sub.push(await newSBI(async () => `$(dashboard) ${(await cpuCurrentSpeed()).avg.toFixed(2)}GHz`));
  (await battery()).hasBattery && sub.push(await newSBI(async () => `$(plug) ${(await battery()).percent}%`));
  sub.push(await newSBI(async () => `$(server) ${formatBytes((await mem()).active)}`));
  sub.push(await newSBI(async () => `$(arrow-small-down) ${formatBytes((await networkStats())[0]?.rx_sec ?? 0)}`));
  sub.push(await newSBI(async () => `$(arrow-small-up) ${formatBytes((await networkStats())[0]?.tx_sec ?? 0)}`));
};

export const deactivate = () => intervalIds.forEach((id) => clearInterval(id));

const newSBI = async (fn: () => Promise<string>) => {
  const sbi = window.createStatusBarItem();
  sbi.text = await fn();
  sbi.show();
  const intervalId = setInterval(async () => (sbi.text = await fn()), 1000);
  intervalIds.push(intervalId);
  return sbi;
};

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0b";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["b", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`;
};
