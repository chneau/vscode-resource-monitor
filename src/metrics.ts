import os from "node:os";
import prettyBytes from "pretty-bytes";
import {
	currentLoad,
	fsStats,
	graphics,
	networkStats,
} from "systeminformation";
import { StatusBarAlignment, type StatusBarItem, window } from "vscode";
import { getOrder, type OrderConfigurationKey } from "./configuration";

const cpuText = async () => {
	const cl = await currentLoad();
	return `$(pulse)${cl.currentLoad.toFixed(2)}%`;
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

type MetricDefinition = {
	key: OrderConfigurationKey;
	// Human-readable name used for tooltips and error reporting.
	name: string;
	// Codicon-prefixed label shown in the configuration quick pick.
	label: string;
	// Order assigned to the metric when it is enabled from the quick pick.
	defaultOrder: number;
	isHeavy: boolean;
	getText: () => Promise<string>;
};

// Single source of truth for every metric: the status bar, the configuration
// quick pick, and heavy-metric detection all derive from this list.
export const metricRegistry: readonly MetricDefinition[] = [
	{
		key: "resource-monitor.cpu",
		name: "CPU usage",
		label: "$(pulse) CPU Usage",
		defaultOrder: 1,
		isHeavy: false,
		getText: cpuText,
	},
	{
		key: "resource-monitor.memory",
		name: "Memory usage",
		label: "$(server) Memory Usage",
		defaultOrder: 2,
		isHeavy: false,
		getText: memText,
	},
	{
		key: "resource-monitor.network",
		name: "Network usage",
		label: "$(cloud-download) Network Usage",
		defaultOrder: 3,
		isHeavy: true,
		getText: netText,
	},
	{
		key: "resource-monitor.file-system",
		name: "File system usage",
		label: "$(log-in) File System Usage",
		defaultOrder: 4,
		isHeavy: true,
		getText: fsText,
	},
	{
		key: "resource-monitor.gpu",
		name: "GPU usage",
		label: "$(zap) GPU Usage",
		defaultOrder: 5,
		isHeavy: true,
		getText: gpuText,
	},
];

export class Metric {
	#getText: () => Promise<string>;
	#name: string;
	#bar: StatusBarItem | null;

	constructor({ getText, name, key }: MetricDefinition) {
		this.#getText = getText;
		this.#name = name;
		this.#bar = newBarItem({ name, priority: -1e3 - getOrder(key) });
	}

	async update() {
		if (!this.#bar) return;
		try {
			const text = await this.#getText();
			if (!this.#bar) return;
			this.#bar.text = text;
		} catch (error) {
			console.error(`Failed to update metric ${this.#name}:`, error);
			if (this.#bar) this.#bar.text = "$(error)";
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

// Fresh instances are built on every refresh cycle, so an in-flight update can
// only ever observe a disposed (bar-less) metric and never a re-used one.
export const getEnabledMetrics = () =>
	metricRegistry
		.filter((metric) => getOrder(metric.key) > 0)
		.map((metric) => new Metric(metric));

export const hasHeavyMetrics = () =>
	metricRegistry.some((metric) => metric.isHeavy && getOrder(metric.key) > 0);
