'use strict';

/**
 *
 * @param {import("zerespluginlibrary").Plugin} Plugin
 * @param {import("zerespluginlibrary").BoundAPI} Library
 * @returns
 */

module.exports = (Plugin, Library) => {
  const { Logger, Utilities, WebpackModules, DiscordModules } = Library;

  const Dispatcher = WebpackModules.getByProps('dispatch', 'subscribe');
  const DisStreamerModeStore = DiscordModules.StreamerModeStore;
  const DisMediaInfo = DiscordModules.MediaInfo;

  const voicesJson = JSON.parse(require('voices.json'));

  const localVoices = [...voicesJson.female, ...voicesJson.male];

  return class VoiceMutedAnnouncer extends Plugin {
    constructor() {
      super();
      //audio
      this.playAudioClip = this.playAudioClip.bind(this);
      this.shouldMakeSound = this.shouldMakeSound.bind(this);
      this.getSelectedSpeakerVoice = this.getSelectedSpeakerVoice.bind(this);
      this.getAllVoices = this.getAllVoices.bind(this);

      //event listener handlers
      this.checkMuteStatusListenerHandler =
        this.checkMuteStatusListenerHandler.bind(this);
      this.checkDeafenedStatusListenerHandler =
        this.checkDeafenedStatusListenerHandler.bind(this);

      this.setUpListeners = this.setUpListeners.bind(this);
      this.disposeListeners = this.disposeListeners.bind(this);
    }
    getAllVoices() {
      const allVoices = [
        ...localVoices,
        ...(window.voiceAnnouncerAdditionalVoicesArray ?? []),
      ];
      return allVoices;
    }
    shouldMakeSound() {
      return !(
        this.settings.audioSettings.respectDisableAllSoundsStreamerMode &&
        DisStreamerModeStore.getSettings().enabled &&
        DisStreamerModeStore.getSettings().disableSounds
      );
    }

    setUpListeners() {
      Dispatcher.subscribe(
        'AUDIO_TOGGLE_SELF_MUTE',
        this.checkMuteStatusListenerHandler
      );
      Dispatcher.subscribe(
        'AUDIO_TOGGLE_SELF_DEAF',
        this.checkDeafenedStatusListenerHandler
      );
      // Dispatcher.subscribe('SPEAKING', this.checkDeafenedStatusListenerHandler);
      // Dispatcher.subscribe(
      //   'VOICE_CHANNEL_SELECT',
      //   this.checkTestStatusListenerHandler
      // );
      // Dispatcher.subscribe(
      //   'VOICE_STATE_UPDATES',
      //   this.checkTestStatusListenerHandler
      // );
      // Dispatcher.subscribe(
      //   'SPEAK_MESSAGE',
      //   this.checkTestStatusListenerHandler
      // );
    }

    disposeListeners() {
      Dispatcher.unsubscribe(
        'AUDIO_TOGGLE_SELF_MUTE',
        this.checkMuteStatusListenerHandler
      );
      Dispatcher.unsubscribe(
        'AUDIO_TOGGLE_SELF_DEAF',
        this.checkDeafenedStatusListenerHandler
      );
      // Dispatcher.unsubscribe(
      //   'SPEAKING',
      //   this.checkDeafenedStatusListenerHandler
      // );
      // Dispatcher.unsubscribe(
      //   'VOICE_CHANNEL_SELECT',
      //   this.checkTestStatusListenerHandler
      // );
      // Dispatcher.unsubscribe(
      //   'VOICE_STATE_UPDATES',
      //   this.checkTestStatusListenerHandler
      // );
      // Dispatcher.unsubscribe(
      //   'SPEAK_MESSAGE',
      //   this.checkTestStatusListenerHandler
      // );
    }

    playAudioClip(src) {
      const audioPlayer = new Audio(src);
      audioPlayer.volume = this.settings.audioSettings.voiceNotificationVolume;

      audioPlayer.play().then(() => audioPlayer.remove());
    }

    getSelectedSpeakerVoice(overrideVoiceId) {
      const allVoices = this.getAllVoices();
      const selectedVoiceId =
        overrideVoiceId ??
        this.settings.audioSettings.speakerVoice ??
        allVoices[0].id;

      const voiceWithSelectedId = allVoices.filter(
        (voice) => voice.id == selectedVoiceId
      );

      if (voiceWithSelectedId.length > 1) {
        Logger.error(
          'Two or more voices have the same id! This is not allowed. Fallback voice is being used!'
        );
        return allVoices[0];
      }

      if (voiceWithSelectedId.length < 1) {
        Logger.error(
          'Voice with selected ID could not be found. Fallback voice is being used!'
        );
        return allVoices[0];
      }

      return voiceWithSelectedId[0];
    }

    checkDeafenedStatusListenerHandler() {
      if (!this.shouldMakeSound()) return;

      if (DisMediaInfo.isSelfDeaf()) {
        this.playAudioClip(this.getSelectedSpeakerVoice().audioClips.deafened);
      } else {
        this.playAudioClip(
          this.getSelectedSpeakerVoice().audioClips.undeafened
        );
      }
    }

    checkTestStatusListenerHandler(e) {
      // if (!this.shouldMakeSound()) return;
      Logger.info(e);
      // if (
      //   this.settings.audioSettings.respectDisableAllSoundsStreamerMode &&
      //   DiscordModules.StreamerModeStore.getSettings().enabled &&
      //   DiscordModules.StreamerModeStore.getSettings().disableSounds
      // ) {
      //   return;
      // }
      // if (DisMediaInfo.isSelfMute()) {
      //   this.playAudioClip(this.getSelectedSpeakerVoice().audioClips.muted);
      // } else {
      //   this.playAudioClip(this.getSelectedSpeakerVoice().audioClips.unmuted);
      // }
    }
    checkMuteStatusListenerHandler() {
      if (!this.shouldMakeSound()) return;

      if (DisMediaInfo.isSelfMute()) {
        this.playAudioClip(this.getSelectedSpeakerVoice().audioClips.muted);
      } else {
        this.playAudioClip(this.getSelectedSpeakerVoice().audioClips.unmuted);
      }
    }

    onStart() {
      Logger.info('Plugin enabled!');
      if (window.voiceAnnouncerAdditionalVoicesArray === undefined) {
        window.voiceAnnouncerAdditionalVoicesArray = [];
      }
      this.setUpListeners();
    }

    getSettingsPanel() {
      const allVoices = this.getAllVoices();
      const settingsPanel = this.buildSettingsPanel();
      settingsPanel.append(
        this.buildSetting({
          type: 'dropdown',
          id: 'speakerVoice',
          name: 'Voice',
          note: 'Change the voice of the announcer. A sample announcement will be played when changing this setting.',
          value: this.settings.audioSettings.speakerVoice ?? allVoices[0].id,
          options: allVoices.map((voice) => {
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
      window.voiceAnnouncerAdditionalVoicesArray = undefined;
      this.disposeListeners();
    }
  };
};
