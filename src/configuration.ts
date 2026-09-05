import {
	ConfigurationTarget,
	commands,
	ThemeIcon,
	window,
	workspace,
} from "vscode";

const allOrderConfigurationKeys = [
	"resource-monitor.cpu",
	"resource-monitor.memory",
	"resource-monitor.network",
	"resource-monitor.file-system",
	"resource-monitor.gpu",
] as const;
export type OrderConfigurationKey = (typeof allOrderConfigurationKeys)[number];
export const getOrder = (key: OrderConfigurationKey) =>
	workspace.getConfiguration().get<number>(key) ?? 0;
export const getRefreshInterval = () =>
	workspace
		.getConfiguration()
		.get<number>("resource-monitor.refresh-interval") ?? 3000;

// The subset of a metric definition the quick pick needs. The full registry is
// provided by the caller (see main.ts) so this module stays free of metric logic.
type MenuMetric = {
	key: OrderConfigurationKey;
	label: string;
	defaultOrder: number;
};

export const openConfigurationMenu = async (metrics: readonly MenuMetric[]) => {
	const quickPick = window.createQuickPick();
	quickPick.title = "Resource Monitor: Configure Components";
	quickPick.placeholder =
		"Select components to display in the status bar (Press Enter to apply)";
	quickPick.canSelectMany = true;
	quickPick.buttons = [
		{
			iconPath: new ThemeIcon("settings-gear"),
			tooltip: "Open Extension Settings",
		},
	];

	const quickPickItems = metrics.map((metric) => ({
		label: metric.label,
		description: getOrder(metric.key) > 0 ? "Enabled" : "Disabled",
		metric,
	}));

	quickPick.items = quickPickItems;
	quickPick.selectedItems = quickPickItems.filter(
		(i) => getOrder(i.metric.key) > 0,
	);

	quickPick.onDidTriggerButton(async () => {
		quickPick.hide();
		await commands.executeCommand(
			"workbench.action.openSettings",
			"@ext:chneau.resource-monitor",
		);
	});

	quickPick.onDidAccept(async () => {
		const selectedKeys = new Set(
			quickPick.selectedItems.map(
				(i) => (i as (typeof quickPickItems)[number]).metric.key,
			),
		);
		quickPick.hide();

		const config = workspace.getConfiguration();
		for (const metric of metrics) {
			const currentOrder = getOrder(metric.key);
			const isSelected = selectedKeys.has(metric.key);

			if (isSelected && currentOrder === 0) {
				await config.update(
					metric.key,
					metric.defaultOrder,
					ConfigurationTarget.Global,
				);
			} else if (!isSelected && currentOrder > 0) {
				await config.update(metric.key, 0, ConfigurationTarget.Global);
			}
		}
	});

	quickPick.onDidHide(() => quickPick.dispose());
	quickPick.show();
};
