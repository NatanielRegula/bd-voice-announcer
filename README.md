# Voice Announcer for [BD](https://github.com/BetterDiscord/BetterDiscord)

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

## Disclaimer

### Use at your own risk! And read the [license](https://github.com/NatanielRegula/bd-voice-announcer/blob/master/LICENSE) before you do.

```
15. Disclaimer of Warranty.

THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY
APPLICABLE LAW.  EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT
HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY
OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO,
THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE.  THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM
IS WITH YOU.  SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF
ALL NECESSARY SERVICING, REPAIR OR CORRECTION.
```
