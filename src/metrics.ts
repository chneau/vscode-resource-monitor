import os from "node:os";
import prettyBytes from "pretty-bytes";
import { fsStats, graphics, networkStats } from "systeminformation";
import { StatusBarAlignment, type StatusBarItem, window } from "vscode";
import { getOrder, type OrderConfigurationKey } from "./configuration";

let prevCpuTimes: { idle: number; total: number } | null = null;

const getCpuUsage = (): number => {
	const cpus = os.cpus();
	let idle = 0;
	let total = 0;
	for (const cpu of cpus) {
		for (const type of Object.keys(cpu.times) as (keyof typeof cpu.times)[]) {
			total += cpu.times[type];
		}
		idle += cpu.times.idle;
	}
	if (!prevCpuTimes) {
		prevCpuTimes = { idle, total };
		return 0;
	}
	const idleDiff = idle - prevCpuTimes.idle;
	const totalDiff = total - prevCpuTimes.total;
	prevCpuTimes = { idle, total };
	if (totalDiff <= 0) return 0;
	return Math.max(0, Math.min(100, (1 - idleDiff / totalDiff) * 100));
};

export const resetCpuUsage = () => {
	prevCpuTimes = null;
};

const cpuText = async () => {
	const load = getCpuUsage();
	return `$(pulse)${load.toFixed(2)}%`;
};

const memText = async () => {
	const used = os.totalmem() - os.freemem();
	return `$(server)${prettyBytes(used)}`;
};

const netText = async () => {
	const ns = await networkStats();
	return `$(cloud-download)${prettyBytes(
		ns?.[0]?.rx_sec ?? 0,
	)}$(cloud-upload)${prettyBytes(ns?.[0]?.tx_sec ?? 0)}`;
};

const fsText = async () => {
	const fs = await fsStats();
	return `$(log-in)${prettyBytes(fs?.wx_sec ?? 0)}$(log-out)${prettyBytes(
		fs?.rx_sec ?? 0,
	)}`;
};

const gpuText = async () => {
	const g = await graphics();
	let totalMemUsed = 0;
	let maxUtil = 0;
	for (const c of g.controllers) {
		maxUtil = Math.max(maxUtil, c.utilizationGpu ?? 0);
		totalMemUsed += (c.memoryUsed ?? 0) * 1024 * 1024;
	}
	return `$(zap)${maxUtil.toFixed(0)}% ${prettyBytes(totalMemUsed)}`;
};

type MetricCtrProps = {
	getText: () => Promise<string>;
	isHeavy?: boolean;
	name: string;
	section: OrderConfigurationKey;
};

export class Metric {
	#getText: () => Promise<string>;
	#name: string;
	#section: OrderConfigurationKey;
	#bar: StatusBarItem | null = null;
	readonly isHeavy: boolean;

	constructor({ getText, isHeavy = false, name, section }: MetricCtrProps) {
		this.#getText = getText;
		this.#name = name;
		this.#section = section;
		this.isHeavy = isHeavy;
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
		try {
			this.#bar.text = await this.#getText();
		} catch (error) {
			console.error(`Failed to update metric ${this.#name}:`, error);
			this.#bar.text = "$(error)";
		}
	}

	dispose() {
		this.#bar?.dispose();
		this.#bar = null;
	}
}

const newBarItem = ({ name, priority }: { name: string; priority: number }) => {
	const sbi = window.createStatusBarItem(
		name,
		StatusBarAlignment.Left,
		priority,
	);
	sbi.show();
	sbi.tooltip = `${name} (click to configure)`;
	sbi.command = "resource-monitor.openMenu";
	sbi.name = sbi.id;
	return sbi;
};

const metrics: MetricCtrProps[] = [
	{
		getText: cpuText,
		isHeavy: false,
		name: "CPU usage",
		section: "resource-monitor.cpu",
	},
	{
		getText: memText,
		isHeavy: false,
		name: "Memory usage",
		section: "resource-monitor.memory",
	},
	{
		getText: netText,
		isHeavy: true,
		name: "Network usage",
		section: "resource-monitor.network",
	},
	{
		getText: fsText,
		isHeavy: true,
		name: "File system usage",
		section: "resource-monitor.file-system",
	},
	{
		getText: gpuText,
		isHeavy: true,
		name: "GPU usage",
		section: "resource-monitor.gpu",
	},
];

const allMetrics = metrics.map((x) => new Metric(x));
export const getEnabledMetrics = () =>
	allMetrics.map((x) => x.init()).filter((x): x is Metric => x != null);

export const hasHeavyMetrics = () =>
	metrics.some((x) => x.isHeavy && getOrder(x.section) > 0);
