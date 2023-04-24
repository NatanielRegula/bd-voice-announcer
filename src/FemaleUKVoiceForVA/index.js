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

  const uuid = WebpackModules.getByProps('v4', 'v1', 'parse');

  const voicesJson = JSON.parse(require('voices.json'));
  const localVoices = [...voicesJson.female, ...voicesJson.male];

  return class VoiceMutedAnnouncer extends Plugin {
    constructor() {
      super();
    }

    onStart() {
      Logger.info('Plugin enabled!');
      if (window.voiceAnnouncerAdditionalVoicesArray === undefined) {
        throw Error(
          'Plugin VoiceAnnouncer needs to be installed and enabled for this voice pack to work! Install VoiceAnnouncer and reenable this plugin!'
        );
      }
      window.voiceAnnouncerAdditionalVoicesArray = [
        ...window.voiceAnnouncerAdditionalVoicesArray,
        ...localVoices,
      ];
    }

    onStop() {
      Logger.info('Plugin disabled!');
      if (window.voiceAnnouncerAdditionalVoicesArray === undefined) {
        return;
      }

      localVoices.forEach((localVoice) => {
        window.voiceAnnouncerAdditionalVoicesArray.forEach((globalVoice) => {
          if (globalVoice.id == localVoice.id) {
            const index =
              window.voiceAnnouncerAdditionalVoicesArray.indexOf(globalVoice);

            if (index > -1) {
              window.voiceAnnouncerAdditionalVoicesArray.splice(index, 1);
            }
          }
        });
      });
    }
  };
};
