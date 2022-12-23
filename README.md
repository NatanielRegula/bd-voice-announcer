# Voice Announcer for [BD]("https://github.com/BetterDiscord/BetterDiscord")

## What does it do?

When the user switches between muted and unmuted the plugin will announce the currently set mode via audio notification.

## Build

```bash
pnpm install
npm run build VoiceAnnouncer
```

## Live-update while developing (Linux)

```bash
while inotifywait -e close_write src/VoiceAnnouncer/*; do npm run build VoiceAnnouncer; done
```
