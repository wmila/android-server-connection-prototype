# Localink Prototype

A React, Vite, and Material 3-inspired Android LAN connection prototype.

## Preview

- The workbench contains 21 independently addressable scenes. Scene URLs use `#/connected`, `#/first`, `#/manual`, and the other IDs in `src/data/scenes.ts`.
- Selecting a scene freezes that state for inspection. Buttons in the device are interactive.
- The play control runs the connection or discovery flow. Its result selector can simulate success, timeout, discovery results, or an empty scan.
- `?mode=app#/connected` opens an individual scene without the workbench. `?mode=app` without a hash runs normal startup.
- The reset control restores the two included example servers. Empty-state previews do not delete saved configurations.

## Behavior

- Saved servers, the last successful server, and the automatic connection preference are persisted in browser local storage.
- Startup connects directly to the last successful server. It never initiates discovery. With no saved configurations, startup opens the first-use screen.
- The default server changes only after a successful connection. Failures and canceled requests retain configuration.
- HTTP uses a simulated five-second polling cycle and a dashed status indicator. WebSocket uses a distinct live-connection indicator.
- Retries are bounded to three attempts with a five-second wait between attempts. Cancellation clears all pending flow timers.
- Discovery is available only in the add-server flow. Each discovered device is listed once, with both supported communication modes.
- HTTP and WebSocket maintain separate paths. TLS is an independent preference, and protocol changes do not disable it.
- Pasted HTTP, HTTPS, WS, and WSS addresses are parsed and previewed. Parsing a plaintext URL does not disable an already enabled TLS preference.
- Server removal requires confirmation. Removing the last server clears the default target.

## Simulation Boundary

This is an interactive frontend prototype, not a native Android client. Discovery and network connections are simulated; no requests are sent to entered servers. A native implementation should use service discovery such as mDNS / DNS-SD, deduplicate by stable device identity, and then connect using the explicitly selected transport and TLS settings.

## Main Files

- `src/App.tsx`: routing, application state, storage, connection and discovery flows, workbench.
- `src/components/MobileScreens.tsx`: connection, configuration, discovery, management, and home screens.
- `src/components/MobileUI.tsx`: shared Material 3-inspired controls and status components.
- `src/data/servers.ts`: server types, address parsing, input validation, and storage loading.
- `src/data/scenes.ts`: scene definitions and design notes.
- `src/index.css`: responsive workbench and device styling, state colors, and motion.