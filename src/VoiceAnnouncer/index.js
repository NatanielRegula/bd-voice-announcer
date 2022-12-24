/**
 *
 * @param {import("zerespluginlibrary").Plugin} Plugin
 * @param {import("zerespluginlibrary").BoundAPI} Library
 * @returns
 */

module.exports = (Plugin, Library) => {
  const { Logger, Utilities, WebpackModules, DiscordModules } = Library;

  const Dispatcher = WebpackModules.getByProps('dispatch', 'subscribe');

  const voicesJson = JSON.parse(require('voices.json'));
  const voices = [...voicesJson.female, ...voicesJson.male];

  return class VoiceMutedAnnouncer extends Plugin {
    constructor() {
      super();
      this.playAudioClip = this.playAudioClip.bind(this);
      this.getSelectedSpeakerVoice = this.getSelectedSpeakerVoice.bind(this);
      this.checkMuteStatusListenerHandler =
        this.checkMuteStatusListenerHandler.bind(this);
    }

    playAudioClip(src) {
      const audioPlayer = new Audio(src);
      audioPlayer.volume = this.settings.audioSettings.voiceNotificationVolume;

      audioPlayer.play().then(() => audioPlayer.remove());
    }

    getSelectedSpeakerVoice(overrideVoiceId) {
      const selectedVoiceId =
        overrideVoiceId ?? this.settings.audioSettings.speakerVoice ?? 0;
      const voiceWithSelectedId = voices.filter(
        (voice) => voice.id == selectedVoiceId
      );

      if (voiceWithSelectedId.length > 1) {
        Logger.error(
          'Two or more voices have the same id! This is not allowed. Fallback voice is being used!'
        );
        return voices[0];
      }

      if (voiceWithSelectedId.length < 1) {
        Logger.error(
          'Voice with selected ID could not be found. Fallback voice is being used!'
        );
        return voices[0];
      }

      return voiceWithSelectedId[0];
    }

    checkMuteStatusListenerHandler() {
      if (
        this.settings.audioSettings.respectDisableAllSoundsStreamerMode &&
        DiscordModules.StreamerModeStore.getSettings().enabled &&
        DiscordModules.StreamerModeStore.getSettings().disableSounds
      ) {
        return;
      }

      if (DiscordModules.MediaInfo.isSelfMute()) {
        this.playAudioClip(this.getSelectedSpeakerVoice().audioClips.muted);
      } else {
        this.playAudioClip(this.getSelectedSpeakerVoice().audioClips.unmuted);
      }
    }

    onStart() {
      Logger.info('Plugin enabled!');

      Dispatcher.subscribe(
        'AUDIO_TOGGLE_SELF_MUTE',
        this.checkMuteStatusListenerHandler
      );
    }

    getSettingsPanel() {
      const settingsPanel = this.buildSettingsPanel();
      Logger.info(settingsPanel);
      settingsPanel.append(
        this.buildSetting({
          type: 'dropdown',
          id: 'speakerVoice',
          name: 'Voice',
          note: 'Change the voice of the announcer. A sample announcement will be played when changing this setting.',
          value: this.settings.audioSettings.speakerVoice ?? 0,
          options: voices.map((voice) => {
            return { label: voice.label, value: voice.id };
          }),
          onChange: (value) => {
            this.playAudioClip(
              this.getSelectedSpeakerVoice(value).audioClips.muted
            );
            this.settings.audioSettings['speakerVoice'] = value;
          },
        })
      );

      return settingsPanel.getElement();
    }

    onStop() {
      Logger.info('Plugin disabled!');
      Dispatcher.unsubscribe(
        'AUDIO_TOGGLE_SELF_MUTE',
        this.checkMuteStatusListenerHandler
      );
    }
  };
};
