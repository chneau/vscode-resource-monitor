import os from "node:os";
import prettyBytes from "pretty-bytes";
import {
	battery,
	cpuTemperature,
	currentLoad,
	fsStats,
	graphics,
	networkStats,
} from "systeminformation";

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

const batteryText = async () => {
	const b = await battery();
	if (!b.hasBattery) return "$(plug)N/A";
	return `$(plug)${Math.round(b.percent)}%`;
};

const temperatureText = async () => {
	const t = await cpuTemperature();
	if (typeof t.main !== "number" || t.main <= 0) return "$(flame)N/A";
	return `$(flame)${t.main.toFixed(0)}°C`;
};

type MetricConfigShape = {
	key: string;
	// Order contributed to package.json; 0 hides the metric by default.
	default: number;
	description: string;
	// Human-readable name used for tooltips and error reporting.
	name: string;
	// Codicon-prefixed label shown in the configuration quick pick.
	label: string;
	// Order assigned to the metric when it is enabled from the quick pick.
	enableOrder: number;
	isHeavy: boolean;
	getText: () => Promise<string>;
};

// Single source of truth for every metric. The settings contributed to
// package.json are regenerated from this list by scripts/syncPackageJson.ts
// (run automatically by `bun run build` and verified by `bun run check:package`),
// and the status bar and configuration quick pick both derive from it. Adding a
// metric means editing this list and nothing else.
//
// This module intentionally imports nothing from "vscode" so the sync script
// can load it outside the extension host.
export const metricDefinitions = [
	{
		key: "resource-monitor.cpu",
		default: 1,
		description: "Order of the CPU usage. 0 to hide.",
		name: "CPU usage",
		label: "$(pulse) CPU Usage",
		enableOrder: 1,
		isHeavy: false,
		getText: cpuText,
	},
	{
		key: "resource-monitor.memory",
		default: 2,
		description: "Order of the memory usage. 0 to hide.",
		name: "Memory usage",
		label: "$(server) Memory Usage",
		enableOrder: 2,
		isHeavy: false,
		getText: memText,
	},
	{
		key: "resource-monitor.network",
		default: 0,
		description: "Order of the network usage. 0 to hide.",
		name: "Network usage",
		label: "$(cloud-download) Network Usage",
		enableOrder: 3,
		isHeavy: true,
		getText: netText,
	},
	{
		key: "resource-monitor.file-system",
		default: 0,
		description: "Order of the file system usage. 0 to hide.",
		name: "File system usage",
		label: "$(log-in) File System Usage",
		enableOrder: 4,
		isHeavy: true,
		getText: fsText,
	},
	{
		key: "resource-monitor.gpu",
		default: 0,
		description: "Order of the GPU usage. 0 to hide.",
		name: "GPU usage",
		label: "$(zap) GPU Usage",
		enableOrder: 5,
		isHeavy: true,
		getText: gpuText,
	},
	{
		key: "resource-monitor.battery",
		default: 0,
		description: "Order of the battery level. 0 to hide.",
		name: "Battery",
		label: "$(plug) Battery",
		enableOrder: 6,
		isHeavy: true,
		getText: batteryText,
	},
	{
		key: "resource-monitor.temperature",
		default: 0,
		description: "Order of the CPU temperature. 0 to hide.",
		name: "CPU temperature",
		label: "$(flame) CPU Temperature",
		enableOrder: 7,
		isHeavy: true,
		getText: temperatureText,
	},
] as const satisfies readonly MetricConfigShape[];

export type MetricDefinition = (typeof metricDefinitions)[number];
export type OrderConfigurationKey = (typeof metricDefinitions)[number]["key"];
