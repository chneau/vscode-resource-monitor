import { StatusBarAlignment, type StatusBarItem, window } from "vscode";
import { getOrder } from "./configuration";
import {
	metricDefinitions,
	type MetricDefinition,
} from "./metricDefinitions";

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
	metricDefinitions
		.filter((def) => getOrder(def.key) > 0)
		.map((def) => new Metric(def));

export const hasHeavyMetrics = () =>
	metricDefinitions.some((def) => def.isHeavy && getOrder(def.key) > 0);
