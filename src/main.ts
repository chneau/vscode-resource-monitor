import { battery, cpuCurrentSpeed, cpuTemperature, currentLoad, fsSize, mem, networkStats } from "systeminformation";
import { ExtensionContext, window } from "vscode";

const intervalIds: NodeJS.Timer[] = [];

export const activate = async ({ subscriptions: sub }: ExtensionContext) => {
  sub.push(await newSBI({ fn: currentLoad, text: (x) => `$(pulse)${x.currentLoad.toFixed(2)}%`, name: "CPU load" }));
  sub.push(await newSBI({ fn: cpuTemperature, text: (x) => `$(flame)${x.main?.toFixed(2) ?? -1}C`, name: "CPU temperature" }));
  sub.push(await newSBI({ fn: cpuCurrentSpeed, text: (x) => `$(dashboard)${x.avg.toFixed(2)}GHz`, name: "CPU speed" }));
  sub.push(await newSBI({ fn: battery, text: (x) => `$(plug)${x.percent ?? -1}%`, name: "Battery charge" }));
  sub.push(await newSBI({ fn: mem, text: (x) => `$(server)${formatBytes(x.active)}`, name: "Memory usage" }));
  sub.push(await newSBI({ fn: networkStats, text: (x) => `$(arrow-small-down)${formatBytes(x[0]?.rx_sec ?? 0)}$(arrow-small-up)${formatBytes(x[0]?.tx_sec ?? 0)}`, name: "Network usage" }));
  sub.push(await newSBI({ fn: fsSize, text: (x) => `$(database)${formatBytes(x.reduce((acc, cur) => acc + cur.used, 0))}`, name: "Filesystem usage" }));
};

export const deactivate = () => intervalIds.forEach((id) => clearInterval(id));

interface NewSBIProps<T> {
  fn: () => Promise<T>;
  text: (value: T) => string;
  name: string;
  ms?: number;
}

const newSBI = async <T>({ fn, text, name, ms = 1000 }: NewSBIProps<T>) => {
  const sbi = window.createStatusBarItem(name);
  sbi.show();
  sbi.tooltip = name;
  sbi.name = `ResMon: ${name}`;
  const updateTexts = async () => (sbi.text = text(await fn()));
  await updateTexts();
  intervalIds.push(setInterval(updateTexts, ms));
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
