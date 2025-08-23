import prettyBytes from "pretty-bytes";
import { currentLoad, fsStats, mem, networkStats } from "systeminformation";
import { StatusBarAlignment, type StatusBarItem, window } from "vscode";
import { getOrder, type OrderConfigurationKey } from "./configuration";

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
	return `$(cloud-download)${prettyBytes(
		ns?.[0]?.rx_sec ?? 0,
	)}$(cloud-upload)${prettyBytes(ns?.[0]?.tx_sec ?? 0)}`;
};

const fsText = async () => {
	const fs = await fsStats();
	return `$(log-in)${prettyBytes(fs.wx_sec ?? 0)}$(log-out)${prettyBytes(
		fs.rx_sec ?? 0,
	)}`;
};

interface MetricCtrProps {
	getText: () => Promise<string>;
	name: string;
	section: OrderConfigurationKey;
}

export class Metric {
	#getText: () => Promise<string>;
	#name: string;
	#section: OrderConfigurationKey;
	#bar: StatusBarItem | null = null;

	constructor({ getText, name, section }: MetricCtrProps) {
		this.#getText = getText;
		this.#name = name;
		this.#section = section;
	}

	init() {
		const order = getOrder(this.#section);
		if (!order) return;
		this.#bar = newBarItem({ name: this.#name, priority: -1e3 - order });
		this.update();
		return this;
	}

	async update() {
		if (!this.#bar) throw new Error("Metric not initialized");
		this.#bar.text = await this.#getText();
	}

	dispose() {
		this.#bar?.dispose();
	}
}

const newBarItem = ({ name, priority }: { name: string; priority: number }) => {
	const sbi = window.createStatusBarItem(
		name,
		StatusBarAlignment.Left,
		priority,
	);
	sbi.show();
	sbi.tooltip = name;
	sbi.name = sbi.id;
	return sbi;
};

const metrics: MetricCtrProps[] = [
	{ getText: cpuText, name: "CPU usage", section: "resource-monitor.cpu" },
	{
		getText: memText,
		name: "Memory usage",
		section: "resource-monitor.memory",
	},
	{
		getText: netText,
		name: "Network usage",
		section: "resource-monitor.network",
	},
	{
		getText: fsText,
		name: "File system usage",
		section: "resource-monitor.file-system",
	},
];

const allMetrics = metrics.map((x) => new Metric(x));
export const getEnabledMetrics = () =>
	allMetrics.flatMap((x) => x.init() || []);
