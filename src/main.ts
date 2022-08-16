import prettyBytes from "pretty-bytes";
import { currentLoad, fsStats, mem, networkStats, powerShellRelease, powerShellStart } from "systeminformation";
import { ExtensionContext, StatusBarAlignment, window } from "vscode";

const intervalIds: NodeJS.Timer[] = [];

export const activate = async ({ subscriptions: sub }: ExtensionContext) => {
  if (process.platform === "win32") powerShellStart();
  let priority = -1000;
  sub.push(newSBI({ fn: currentLoad, text: (x) => `$(pulse)${x.currentLoad.toFixed(2)}%`, name: "CPU load", priority: priority-- }));
  sub.push(newSBI({ fn: mem, text: (x) => `$(server)${prettyBytes(x.active)}`, name: "Memory usage", priority: priority-- }));
  sub.push(newSBI({ fn: networkStats, text: (x) => `$(cloud-download)${prettyBytes(x[0]?.rx_sec ?? 0)}$(cloud-upload)${prettyBytes(x[0]?.tx_sec ?? 0)}`, name: "Network usage", priority: priority-- }));
  sub.push(newSBI({ fn: fsStats, text: (x) => `$(log-in)${prettyBytes(x.wx_sec ?? 0)}$(log-out)${prettyBytes(x.rx_sec ?? 0)}`, name: "File system usage", priority: priority-- }));
};

export const deactivate = () => {
  if (process.platform === "win32") powerShellRelease();
  intervalIds.forEach((id) => clearInterval(id));
};

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
