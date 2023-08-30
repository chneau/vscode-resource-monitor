import { workspace } from "vscode";

const AllOrderConfigurationKeys = <const>["resource-monitor.cpu", "resource-monitor.memory", "resource-monitor.network", "resource-monitor.file-system"];
export type OrderConfigurationKey = (typeof AllOrderConfigurationKeys)[number];
export const getOrder = (key: OrderConfigurationKey) => workspace.getConfiguration().get<number>(key) ?? 0;
export const getRefreshInterval = () => workspace.getConfiguration().get<number>("resource-monitor.refresh-interval") ?? 1000;
