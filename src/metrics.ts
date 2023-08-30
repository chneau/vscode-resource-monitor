import prettyBytes from "pretty-bytes";
import { currentLoad, fsStats, mem, networkStats } from "systeminformation";
import { StatusBarAlignment, StatusBarItem, window } from "vscode";
import { isEnabled } from "./configuration";

const cpuText = async () => {
  const cl = await currentLoad();
  return `$(pulse)${cl.currentLoad.toFixed(2)}%`;
};

const memText = async () => {
  const m = await mem();
  return `$(server)${prettyBytes(m.active)}`;
};

const netText = async () => {
  const ns = await networkStats();
  return `$(cloud-download)${prettyBytes(ns?.[0]?.rx_sec ?? 0)}$(cloud-upload)${prettyBytes(ns?.[0]?.tx_sec ?? 0)}`;
};

const fsText = async () => {
  const fs = await fsStats();
  return `$(log-in)${prettyBytes(fs.wx_sec ?? 0)}$(log-out)${prettyBytes(fs.rx_sec ?? 0)}`;
};

interface MetricCtrProps {
  getText: () => Promise<string>;
  getBar: () => StatusBarItem;
  getEnabled: () => boolean;
}

export class Metric {
  #getText: () => Promise<string>;
  #getBar: () => StatusBarItem;
  #getEnabled: () => boolean;
  #bar: StatusBarItem = null!;

  constructor({ getText, getBar, getEnabled }: MetricCtrProps) {
    this.#getText = getText;
    this.#getBar = getBar;
    this.#getEnabled = getEnabled;
  }

  init() {
    if (!this.#getEnabled()) return;
    this.#bar = this.#getBar();
    this.update();
    return this;
  }

  async update() {
    if (!this.#bar) throw new Error("Metric not initialized");
    this.#bar.text = await this.#getText();
  }

  dispose() {
    this.#bar.dispose();
  }
}

const newBarItem = ({ name, priority }: { name: string; priority: number }) => {
  const sbi = window.createStatusBarItem(name, StatusBarAlignment.Left, priority);
  sbi.show();
  sbi.tooltip = name;
  sbi.name = sbi.id;
  return sbi;
};

const metrics: MetricCtrProps[] = [
  {
    getText: cpuText,
    getBar: () => newBarItem({ name: "CPU load", priority: -1e3 - 1 }),
    getEnabled: () => isEnabled("resource-monitor.cpu"),
  },
  {
    getText: memText,
    getBar: () => newBarItem({ name: "Memory usage", priority: -1e3 - 2 }),
    getEnabled: () => isEnabled("resource-monitor.memory"),
  },
  {
    getText: netText,
    getBar: () => newBarItem({ name: "Network usage", priority: -1e3 - 3 }),
    getEnabled: () => isEnabled("resource-monitor.network"),
  },
  {
    getText: fsText,
    getBar: () => newBarItem({ name: "File system usage", priority: -1e3 - 4 }),
    getEnabled: () => isEnabled("resource-monitor.file-system"),
  },
];

const allMetrics = metrics.map((x) => new Metric(x));
export const getEnabledMetrics = (): Metric[] => allMetrics.map((x) => x.init()!).filter((x) => x);
