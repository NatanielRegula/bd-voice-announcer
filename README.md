# Voice Announcer for [BD](https://github.com/BetterDiscord/BetterDiscord)

## What does it do?

This plugin replaces the stock sounds made by Dis... with voice announcements similar to TS3.

The announced actions available are as follows:

- connected **(voice channel or a call)**
- disconnected **(voice channel or a call)**
- channel switched **(voice channel)**
- user joined your channel **(voice channel or a call)**
- user left your channel **(voice channel or a call)**
- a bot joined your channel **(voice channel)**
- a bot left your channel **(voice channel)**
- muted
- unmuted
- deafened
- undeafened

You can also customize the plugin behavior, for example, specific announcements can be switched on and off in the plugin settings at will.

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
npm run watch
```

or

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

# Credits

## texttospeech

Some text-to-speech recordings were made using [texttospeech](https://texttospeech.io/) service.

A snippet from their [FAQ section as of Dec 27th 2022](https://texttospeech.io/faqs)

```
Can I use the generated text to speech files in my commercial works?

The service basically is free to use for your personal purposes.

    - Otherwise, please help to add a credit / backlink to our site (https://texttospeech.io) to keep this free service running.
```
