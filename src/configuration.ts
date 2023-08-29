import { workspace } from "vscode";

const AllEnabledConfigurationKeys = <const>["resource-monitor.cpu", "resource-monitor.memory", "resource-monitor.network", "resource-monitor.file-system"];
type EnabledConfigurationKey = (typeof AllEnabledConfigurationKeys)[number];
export const isEnabled = (key: EnabledConfigurationKey) => workspace.getConfiguration().get<boolean>(key) ?? false;