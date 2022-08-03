import { commands, ExtensionContext, window } from "vscode";

export const activate = (context: ExtensionContext) => {
  console.log('Congratulations, your extension "resource-monitor" is now active!');

  const statusBarItem = window.createStatusBarItem();
  statusBarItem.text = "Hello!";
  statusBarItem.color = "yellow";
  statusBarItem.show();

  const disposable = commands.registerCommand("resource-monitor.helloWorld", () => {
    statusBarItem.color = statusBarItem.color === "yellow" ? "green" : "yellow";
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(statusBarItem);
};

export const deactivate = () => ({});
