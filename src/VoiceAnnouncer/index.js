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
      audio.crossOrigin = 'anonymous';
      audio.volume = this.settings.audioSettings.voiceNotificationVolume;
      audio.play();
    }
    checkMuteStatusListenerHandler() {
      if (DiscordModules.MediaInfo.isSelfMute()) {
        this.playAudioClip(
          this.settings.audioSettings.useFemaleVoice
            ? voices.femaleUs2.muted
            : voices.maleUs3.muted
        );
      } else {
        this.playAudioClip(
          this.settings.audioSettings.useFemaleVoice
            ? voices.femaleUs2.unmuted
            : voices.maleUs3.unmuted
        );
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
