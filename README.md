# resource-monitor

<div align="center">
  <img src="images/icon.png" alt="Icon" width="128" />
  <br />
  <b>Resource Monitor for VS Code</b>
</div>

<br />

A simple resource monitor.
[Marketplace link.](https://marketplace.visualstudio.com/items?itemName=chneau.resource-monitor)

## Screenshots

Everything the extension can show, straight from the status bar:

![Status bar with every metric enabled](images/bar.png)

Hovering a metric shows its name; clicking it opens the configuration menu:

![Metric tooltip](images/tooltip.png) ![Configure components](images/menu.png)

The order of each metric and the refresh interval can be customized in the
settings:

![Extension settings](images/settings.png)

## Features

- CPU usage
- Memory usage
- Network usage (disabled by default)
- File system usage (disabled by default)
- GPU usage (disabled by default)
- Battery level (disabled by default)
- CPU temperature (disabled by default)

Clicking on any active metric in the status bar opens a quick menu allowing you
to toggle individual components on/off and quickly navigate to settings, and
hovering a metric shows its name.

You can also customize the order of monitors in settings or adjust the refresh
interval.

The network, file system, GPU, battery, and temperature metrics probe the system
more aggressively, so they are disabled by default. To enable them, use the
status bar menu or set their order to a value greater than 0 in settings.
