# Voice Announcer for [BD]("https://github.com/BetterDiscord/BetterDiscord")

## What does it do?

When the user switches between muted and unmuted the plugin will announce the currently set mode via audio notification.

## Prerequisites

- [pnpm](https://pnpm.io/installation)
- NodeJs
- inotifywait (optional for live-update development)

## Build

```bash
pnpm install
npm run build VoiceAnnouncer
```

## Live-update while developing (Linux / Bash)

```bash
while inotifywait -e close_write src/VoiceAnnouncer/*; do npm run build VoiceAnnouncer; done
```
