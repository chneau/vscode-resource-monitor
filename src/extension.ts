import { commands, ExtensionContext, window } from "vscode";

export const activate = (context: ExtensionContext) => {
  console.log('Congratulations, your extension "resource-monitor" is now active!');

  const disposable = commands.registerCommand("resource-monitor.helloWorld", () => {
    window.showInformationMessage("Yo!");
  });

  context.subscriptions.push(disposable);
};

export const deactivate = () => ({});
