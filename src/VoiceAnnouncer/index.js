/**
 *
 * @param {import("zerespluginlibrary").Plugin} Plugin
 * @param {import("zerespluginlibrary").BoundAPI} Library
 * @returns
 */

module.exports = (Plugin, Library) => {
  const { Logger, Utilities, WebpackModules, DiscordModules } = Library;

  const Dispatcher = WebpackModules.getByProps('dispatch', 'subscribe');

  const voices = JSON.parse(require('voices.json'));

  return class VoiceMutedAnnouncer extends Plugin {
    constructor() {
      super();
      this.playAudioClip = this.playAudioClip.bind(this);
      this.getSelectedSpeakerVoice = this.getSelectedSpeakerVoice.bind(this);
      this.checkMuteStatusListenerHandler =
        this.checkMuteStatusListenerHandler.bind(this);
    }

    playAudioClip(src) {
      if (
        DiscordModules.StreamerModeStore.getSettings().enabled &&
        DiscordModules.StreamerModeStore.getSettings().disableSounds &&
        this.settings.audioSettings.respectDisableAllSoundsStreamerMode
      ) {
        return;
      }

      const audio = new Audio(src);
      audio.volume = this.settings.audioSettings.voiceNotificationVolume;
      audio.play();
    }
    getSelectedSpeakerVoice() {
      return this.settings.audioSettings.useFemaleVoice
        ? voices.femaleUs2
        : voices.maleUs3;
    }
    checkMuteStatusListenerHandler() {
      if (DiscordModules.MediaInfo.isSelfMute()) {
        this.playAudioClip(getSelectedSpeakerVoice().muted);
      } else {
        this.playAudioClip(getSelectedSpeakerVoice().unmuted);
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
      return this.buildSettingsPanel().getElement();
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
