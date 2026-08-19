import {
	ConfigurationTarget,
	commands,
	ThemeIcon,
	window,
	workspace,
} from "vscode";

const AllOrderConfigurationKeys = [
	"resource-monitor.cpu",
	"resource-monitor.memory",
	"resource-monitor.network",
	"resource-monitor.file-system",
	"resource-monitor.gpu",
] as const;
export type OrderConfigurationKey = (typeof AllOrderConfigurationKeys)[number];
export const getOrder = (key: OrderConfigurationKey) =>
	workspace.getConfiguration().get<number>(key) ?? 0;
export const getRefreshInterval = () =>
	workspace
		.getConfiguration()
		.get<number>("resource-monitor.refresh-interval") ?? 3000;

type MetricConfigItem = {
	key: OrderConfigurationKey;
	label: string;
	defaultOrder: number;
};

const metricConfigItems: MetricConfigItem[] = [
	{
		key: "resource-monitor.cpu",
		label: "$(pulse) CPU Usage",
		defaultOrder: 1,
	},
	{
		key: "resource-monitor.memory",
		label: "$(server) Memory Usage",
		defaultOrder: 2,
	},
	{
		key: "resource-monitor.network",
		label: "$(cloud-download) Network Usage",
		defaultOrder: 3,
	},
	{
		key: "resource-monitor.file-system",
		label: "$(log-in) File System Usage",
		defaultOrder: 4,
	},
	{
		key: "resource-monitor.gpu",
		label: "$(zap) GPU Usage",
		defaultOrder: 5,
	},
];

export const openConfigurationMenu = async () => {
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

	const items = metricConfigItems.map((item) => ({
		label: item.label,
		description: getOrder(item.key) > 0 ? "Enabled" : "Disabled",
		item,
	}));

	quickPick.items = items;
	quickPick.selectedItems = items.filter((i) => getOrder(i.item.key) > 0);

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
				(i) => (i as (typeof items)[number]).item.key,
			),
		);
		quickPick.hide();

		const config = workspace.getConfiguration();
		for (const metric of metricConfigItems) {
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
