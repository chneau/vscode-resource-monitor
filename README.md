# resource-monitor

<div align="center">
  <img src="images/icon.png" alt="Icon" width="128" />
  <br />
  <b>Resource Monitor for VS Code</b>
</div>

<br />

A simple resource monitor.
[Marketplace link.](https://marketplace.visualstudio.com/items?itemName=chneau.resource-monitor)

![example](images/bar.png)

## Features

- CPU usage
- Memory usage
- Network usage
- File system usage
- GPU usage (disabled by default)

Clicking on any active metric in the status bar opens a quick menu allowing you
to toggle individual components on/off and quickly navigate to settings.

You can also customize the order of monitors in settings or adjust the refresh
interval:

![example](images/settings.png)

To enable GPU or other heavy metrics, use the status bar menu or set their order
to a value greater than 0 in settings.
