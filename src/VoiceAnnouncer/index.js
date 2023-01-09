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
  const DisVoiceStateStore = WebpackModules.getByProps(
    'getVoiceStateForUser',
    'getVoiceStatesForChannel'
  );
  const DisStreamerModeStore = DiscordModules.StreamerModeStore;
  const DisMediaInfo = DiscordModules.MediaInfo;
  const DisSelectedChannelStore = DiscordModules.SelectedChannelStore;
  const DisUserStore = DiscordModules.UserStore;

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
      this.channelSwitchedListenerHandler =
        this.channelSwitchedListenerHandler.bind(this);
      this.voiceChannelUpdateListenerHandler =
        this.voiceChannelUpdateListenerHandler.bind(this);

      this.setUpListeners = this.setUpListeners.bind(this);
      this.disposeListeners = this.disposeListeners.bind(this);

      this.disEventListenerPairs = [
        ['AUDIO_TOGGLE_SELF_MUTE', this.checkMuteStatusListenerHandler],
        ['AUDIO_TOGGLE_SELF_DEAF', this.checkDeafenedStatusListenerHandler],
        // ['SPEAKING', this.checkTestStatusListenerHandler],
        ['VOICE_CHANNEL_SELECT', this.channelSwitchedListenerHandler],

        ['VOICE_STATE_UPDATES', this.voiceChannelUpdateListenerHandler],

        // ['CALL_UPDATE', this.checkTestStatusListenerHandler],
        // ['VIDEO_BACKGROUND_SHOW_FEEDBACK', this.checkTestStatusListenerHandler],
        // ['VOICE_CHANNEL_SELECT', this.checkTestStatusListenerHandler],
        // ['VOICE_CHANNEL_SHOW_FEEDBACK', this.checkTestStatusListenerHandler],
        // ['CHANNEL_RECIPIENT_ADD', this.checkTestStatusListenerHandler],
        // VOICE_ACTIVITY
      ];

      //cache
      this.cachedChannelId = null;

      this.cachedVoiceChannelId =
        DisSelectedChannelStore.getVoiceChannelId() ?? null;

      this.cachedCurrentVoiceChannelUsersIds = [];
      this.cachedCurrentUserId = DisUserStore.getCurrentUser().id;
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
      this.disEventListenerPairs.forEach((eventListenerPair) => {
        Dispatcher.subscribe(...eventListenerPair);
      });
    }

    disposeListeners() {
      this.disEventListenerPairs.forEach((eventListenerPair) => {
        Dispatcher.unsubscribe(...eventListenerPair);
      });
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

    voiceChannelUpdateListenerHandler(_) {
      try {
        if (!this.shouldMakeSound()) return;
        Logger.info('here');
        // Logger.info(`this.cachedVoiceChannelId ${this.cachedVoiceChannelId}`);
        // Logger.info(
        //   `DisSelectedChannelStore.getVoiceChannelId() ${DisSelectedChannelStore.getVoiceChannelId()}`
        // );

        //do not carry on if we're not in the same channel because that means that we have either just connected or disconnected

        if (
          (this.cachedVoiceChannelId != null &&
            this.cachedVoiceChannelId !=
              DisSelectedChannelStore.getVoiceChannelId()) ||
          DisSelectedChannelStore.getVoiceChannelId() == null
        )
          return;
        this.cachedVoiceChannelId = DisSelectedChannelStore.getVoiceChannelId();

        const voiceStatesForCurrentVoiceChannelObject =
          DisVoiceStateStore.getVoiceStatesForChannel(
            DisSelectedChannelStore.getVoiceChannelId()
          );

        const currentVoiceChannelUsersIds = Object.keys(
          voiceStatesForCurrentVoiceChannelObject
        ).map((key) => voiceStatesForCurrentVoiceChannelObject[key].userId);

        const IdsOfUsersWhoJoined = currentVoiceChannelUsersIds.filter(
          (state) => !this.cachedCurrentVoiceChannelUsersIds.includes(state)
        );

        const IdsOfUsersWhoLeft = this.cachedCurrentVoiceChannelUsersIds.filter(
          (state) => !currentVoiceChannelUsersIds.includes(state)
        );

        this.cachedCurrentVoiceChannelUsersIds = currentVoiceChannelUsersIds;
        if (
          this.cachedCurrentUserId == null ||
          this.cachedCurrentUserId == undefined
        ) {
          this.cachedCurrentUserId = DisUserStore.getCurrentUser().id;
        }

        //if the users id is in this list it means that we just connected
        if (IdsOfUsersWhoJoined.includes(this.cachedCurrentUserId)) return;

        //if the users id is in this list it means that we just disconnected
        if (IdsOfUsersWhoLeft.includes(this.cachedCurrentUserId)) return;

        IdsOfUsersWhoJoined.forEach((userId) => {
          Logger.log(`Joined ${userId}`);
          this.playAudioClip(
            this.getSelectedSpeakerVoice().audioClips.userJoinedYourChannel
          );
        });

        IdsOfUsersWhoLeft.forEach((userId) => {
          Logger.log(`Left ${userId}`);
          this.playAudioClip(
            this.getSelectedSpeakerVoice().audioClips.userLeftYourChannel
          );
        });
      } catch (error) {
        Logger.error(error);
      }
    }

    channelSwitchedListenerHandler(e) {
      if (!this.shouldMakeSound()) return;

      const eventChannelId = e.channelId;

      //if this is true it means that channel wasn't changed
      if (eventChannelId == this.cachedChannelId) return;

      if (eventChannelId == null) {
        //this means we have disconnected from voice channel
        //there could be an announcement made for this.
        this.playAudioClip(
          this.getSelectedSpeakerVoice().audioClips.disconnected
        );

        //emptying the array because the user disconnected from the channel to avoid announcements when re-connecting to the same channel
        this.cachedCurrentVoiceChannelUsersIds = [];
        this.cachedChannelId = eventChannelId;
        return;
      }

      if (this.cachedChannelId == null) {
        //this means we have connected to a voice channel for the first time
        //so there could be a "connected" announcement

        this.playAudioClip(this.getSelectedSpeakerVoice().audioClips.connected);
        this.cachedChannelId = eventChannelId;
        return;
      }

      this.cachedChannelId = eventChannelId;
      this.cachedCurrentVoiceChannelUsersIds = [];
      this.playAudioClip(
        this.getSelectedSpeakerVoice().audioClips.channelSwitched
      );
    }

    checkTestStatusListenerHandler(e) {
      // if (!this.shouldMakeSound()) return;
      Logger.info('test event fired');
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
