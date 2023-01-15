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
  const DisNotificationSettingsStore =
    WebpackModules.getByProps('isSoundDisabled');
  const DisNotificationSettingsController =
    WebpackModules.getByProps('setDisabledSounds');

  const voicesJson = JSON.parse(require('voices.json'));

  const localVoices = [...voicesJson.female, ...voicesJson.male];

  const SOUNDS_THAT_THIS_PLUGIN_REPLACES = [
    'deafen',
    'undeafen',
    'mute',
    'unmute',
    'disconnect',
    'user_join',
    'user_leave',
    'user_moved',
  ];

  const VOICE_ANNOUNCEMENT = Object.freeze({
    CONNECTED: { name: 'connected', replacesInDis: ['undeafen'] },
    DEAFENED: { name: 'deafened', replacesInDis: ['deafen'] },
    DISCONNECTED: { name: 'disconnected', replacesInDis: ['disconnect'] },
    ERROR: { name: 'error', replacesInDis: [] },
    MUTED: { name: 'muted', replacesInDis: ['mute'] },
    UNDEAFENED: { name: 'undeafened', replacesInDis: ['undeafen'] },
    UNMUTED: { name: 'unmuted', replacesInDis: ['unmute'] },
    USER_JOINED_YOUR_CHANNEL: {
      name: 'userJoinedYourChannel',
      replacesInDis: ['user_join'],
    },
    USER_LEFT_YOUR_CHANNEL: {
      name: 'userLeftYourChannel',
      replacesInDis: ['user_leave'],
    },
    CHANNEL_SWITCHED: {
      name: 'channelSwitched',
      replacesInDis: ['user_moved'],
    },
  });

  return class VoiceMutedAnnouncer extends Plugin {
    constructor() {
      super();

      ///-----Audio-----///
      this.playAudioClip = this.playAudioClip.bind(this);
      this.shouldMakeSound = this.shouldMakeSound.bind(this);
      this.getSelectedSpeakerVoice = this.getSelectedSpeakerVoice.bind(this);
      this.getAllVoices = this.getAllVoices.bind(this);

      ///-----Event Listener Handlers-----///
      this.checkMuteStatusListenerHandler =
        this.checkMuteStatusListenerHandler.bind(this);
      this.checkDeafenedStatusListenerHandler =
        this.checkDeafenedStatusListenerHandler.bind(this);
      this.channelSwitchedListenerHandler =
        this.channelSwitchedListenerHandler.bind(this);
      this.voiceChannelUpdateListenerHandler =
        this.voiceChannelUpdateListenerHandler.bind(this);

      ///-----Event Listeners Subscriptions-----///
      this.setUpListeners = this.setUpListeners.bind(this);
      this.disposeListeners = this.disposeListeners.bind(this);
      this.disEventListenerPairs = [
        ['AUDIO_TOGGLE_SELF_MUTE', this.checkMuteStatusListenerHandler],
        ['AUDIO_TOGGLE_SELF_DEAF', this.checkDeafenedStatusListenerHandler],
        ['VOICE_CHANNEL_SELECT', this.channelSwitchedListenerHandler],
        ['VOICE_STATE_UPDATES', this.voiceChannelUpdateListenerHandler],

        // ['SPEAKING', this.checkTestStatusListenerHandler],
        // ['CHANNEL_UPDATES', this.checkTestStatusListenerHandler],
        // ['CALL_UPDATE', this.checkTestStatusListenerHandler],
        // ['VIDEO_BACKGROUND_SHOW_FEEDBACK', this.checkTestStatusListenerHandler],
        // ['VOICE_CHANNEL_SELECT', this.checkTestStatusListenerHandler],
        // ['VOICE_CHANNEL_SHOW_FEEDBACK', this.checkTestStatusListenerHandler],
        // ['CHANNEL_RECIPIENT_ADD', this.checkTestStatusListenerHandler],
        // VOICE_ACTIVITY
      ];

      ///-----Cached Values-----///
      //voice channel actions [connected,disconnected,channel_switched,user_left_your_channel,user_joined_your_channel]
      this.cachedCurrentUserId = DisUserStore.getCurrentUser().id;
      this.cachedVoiceChannelId =
        DisSelectedChannelStore.getVoiceChannelId() ?? null;
      this.cachedCurrentVoiceChannelUsersIds = [];

      ///-----Adding Context To Methods-----///
      //voice channel actions [connected,disconnected,channel_switched,user_left_your_channel,user_joined_your_channel]
      this.getCurrentVoiceChannelUsersIds =
        this.getCurrentVoiceChannelUsersIds.bind(this);
      this.refreshCurrentVoiceChannelUsersIdsCache =
        this.refreshCurrentVoiceChannelUsersIdsCache.bind(this);
      //stock sounds
      this.disableStockDisSounds = this.disableStockDisSounds.bind(this);
      this.restoreStockDisSounds = this.restoreStockDisSounds.bind(this);
      //settings
      this.setDefaultValuesForSettings =
        this.setDefaultValuesForSettings.bind(this);
    }

    ///-----Misc-----///
    getCurrentVoiceChannelUsersIds() {
      const voiceStatesForCurrentVoiceChannelObject =
        DisVoiceStateStore.getVoiceStatesForChannel(
          DisSelectedChannelStore.getVoiceChannelId()
        );

      const currentVoiceChannelUsersIds = Object.keys(
        voiceStatesForCurrentVoiceChannelObject
      ).map((key) => voiceStatesForCurrentVoiceChannelObject[key].userId);

      return currentVoiceChannelUsersIds;
    }

    refreshCurrentVoiceChannelUsersIdsCache() {
      this.cachedCurrentVoiceChannelUsersIds =
        this.getCurrentVoiceChannelUsersIds();
    }

    ///-----Events Handlers-----///
    checkDeafenedStatusListenerHandler() {
      if (!this.shouldMakeSound()) return;

      if (DisMediaInfo.isSelfDeaf()) {
        this.playAudioClip(VOICE_ANNOUNCEMENT.DEAFENED);
      } else {
        this.playAudioClip(VOICE_ANNOUNCEMENT.UNDEAFENED);
      }
    }

    voiceChannelUpdateListenerHandler(_) {
      try {
        if (!this.shouldMakeSound()) return;

        const eventVoiceChannelId = DisSelectedChannelStore.getVoiceChannelId();

        if (this.cachedVoiceChannelId == null) return;
        if (eventVoiceChannelId == null) return;
        if (eventVoiceChannelId != this.cachedVoiceChannelId) return;

        const currentVoiceChannelUsersIds =
          this.getCurrentVoiceChannelUsersIds();

        const idsOfUsersWhoJoined = currentVoiceChannelUsersIds.filter(
          (state) => !this.cachedCurrentVoiceChannelUsersIds.includes(state)
        );

        const idsOfUsersWhoLeft = this.cachedCurrentVoiceChannelUsersIds.filter(
          (state) => !currentVoiceChannelUsersIds.includes(state)
        );

        //this is used for the next time this function runs
        this.refreshCurrentVoiceChannelUsersIdsCache();

        //if the users id is in this list it means that we just connected
        if (idsOfUsersWhoJoined.includes(this.cachedCurrentUserId)) return;

        //if the users id is in this list it means that we just disconnected
        if (idsOfUsersWhoLeft.includes(this.cachedCurrentUserId)) return;

        idsOfUsersWhoJoined.forEach((userId) => {
          this.playAudioClip(VOICE_ANNOUNCEMENT.USER_JOINED_YOUR_CHANNEL);
        });

        idsOfUsersWhoLeft.forEach((userId) => {
          this.playAudioClip(VOICE_ANNOUNCEMENT.USER_LEFT_YOUR_CHANNEL);
        });
      } catch (error) {
        Logger.error(error);
      }
    }

    channelSwitchedListenerHandler(e) {
      if (!this.shouldMakeSound()) return;

      const eventVoiceChannelId = e.channelId;

      //if this is true it means that channel wasn't changed
      if (eventVoiceChannelId == this.cachedVoiceChannelId) return;

      if (eventVoiceChannelId == null) {
        //this means we have disconnected from voice channel
        //there could be an announcement made for this.
        this.playAudioClip(VOICE_ANNOUNCEMENT.DISCONNECTED);

        this.refreshCurrentVoiceChannelUsersIdsCache();
        this.cachedVoiceChannelId = eventVoiceChannelId;
        return;
      }

      if (this.cachedVoiceChannelId == null) {
        //this means we have connected to a voice channel for the first time
        //so there could be a "connected" announcement

        this.playAudioClip(VOICE_ANNOUNCEMENT.CONNECTED);
        this.refreshCurrentVoiceChannelUsersIdsCache();
        this.cachedVoiceChannelId = eventVoiceChannelId;
        return;
      }

      this.cachedVoiceChannelId = eventVoiceChannelId;
      this.refreshCurrentVoiceChannelUsersIdsCache();
      this.playAudioClip(VOICE_ANNOUNCEMENT.CHANNEL_SWITCHED);
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
        this.playAudioClip(VOICE_ANNOUNCEMENT.MUTED);
      } else {
        this.playAudioClip(VOICE_ANNOUNCEMENT.UNMUTED);
      }
    }

    ///-----Life Cycle & BD/Z Specific-----///
    onStart() {
      Logger.info('Plugin enabled!');
      this.setDefaultValuesForSettings();
      this.disableStockDisSounds();

      if (this.cachedVoiceChannelId != null) {
        this.refreshCurrentVoiceChannelUsersIdsCache();
      }

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
          value: this.settings.audioSettings.speakerVoice,
          options: allVoices.map((voice) => {
            return { label: voice.label, value: voice.id };
          }),
          onChange: (newVoiceId) => {
            this.playAudioClip(VOICE_ANNOUNCEMENT.MUTED, newVoiceId);
            this.settings.audioSettings['speakerVoice'] = newVoiceId;
          },
        })
      );
      settingsPanel.append(
        this.buildSetting({
          type: 'switch',
          id: 'disableDiscordStockSounds',
          name: "Disable Discord's stock sounds",
          note: "If true the default/stock/native sounds that discord makes will be disabled by overwriting your settings to make space for the voice announcements. This setting will overwrite discord's notification settings the the current session but the plugin will try to restore original settings when disabled.",
          value: this.settings.audioSettings.disableDiscordStockSounds ?? true,

          onChange: (value) => {
            this.settings.audioSettings['disableDiscordStockSounds'] = value;
            if (value) {
              this.disableStockDisSounds();
            } else {
              this.restoreStockDisSounds();
            }
          },
        })
      );

      return settingsPanel.getElement();
    }

    onStop() {
      Logger.info('Plugin disabled!');
      window.voiceAnnouncerAdditionalVoicesArray = undefined;
      this.restoreStockDisSounds();
      this.disposeListeners();
    }

    ///-----Voice Announcements-----///
    getAllVoices() {
      const allVoices = [
        ...localVoices,
        ...(window.voiceAnnouncerAdditionalVoicesArray ?? []),
      ];
      return allVoices;
    }

    getSelectedSpeakerVoice(overrideVoiceId) {
      const allVoices = this.getAllVoices();
      const selectedVoiceId =
        overrideVoiceId ?? this.settings.audioSettings.speakerVoice;

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

    playAudioClip(src, overrideVoiceId) {
      const audioPlayer = new Audio(
        this.getSelectedSpeakerVoice(overrideVoiceId).audioClips[src.name]
      );
      audioPlayer.volume = this.settings.audioSettings.voiceNotificationVolume;

      audioPlayer.play().then(() => audioPlayer.remove());
    }

    shouldMakeSound() {
      return !(
        this.settings.audioSettings.respectDisableAllSoundsStreamerMode &&
        DisStreamerModeStore.getSettings().enabled &&
        DisStreamerModeStore.getSettings().disableSounds
      );
    }

    ///-----Stock Sounds Enable/Restore-----///
    disableStockDisSounds() {
      if (!this.settings.audioSettings.disableDiscordStockSounds) return;

      if (
        !Utilities.loadData('VoiceAnnouncer', 'stockSoundsManipulated', false)
      ) {
        Utilities.saveData(
          'VoiceAnnouncer',
          'stockSoundsDisabledBeforeManipulated',
          DisNotificationSettingsStore.getDisabledSounds()
        );
      }

      DisNotificationSettingsController.setDisabledSounds([
        ...SOUNDS_THAT_THIS_PLUGIN_REPLACES,
        ...Utilities.loadData(
          'VoiceAnnouncer',
          'stockSoundsDisabledBeforeManipulated',
          []
        ),
      ]);

      Utilities.saveData('VoiceAnnouncer', 'stockSoundsManipulated', true);
    }

    restoreStockDisSounds() {
      if (
        !Utilities.loadData('VoiceAnnouncer', 'stockSoundsManipulated', false)
      )
        return;

      DisNotificationSettingsController.setDisabledSounds(
        Utilities.loadData(
          'VoiceAnnouncer',
          'stockSoundsDisabledBeforeManipulated',
          []
        )
      );
      Utilities.saveData('VoiceAnnouncer', 'stockSoundsManipulated', false);
    }

    setDefaultValuesForSettings() {
      const allVoices = this.getAllVoices();
      if (this.settings.audioSettings.disableDiscordStockSounds === undefined) {
        this.settings.audioSettings.disableDiscordStockSounds = true;
      }
      if (this.settings.audioSettings.speakerVoice === undefined) {
        this.settings.audioSettings.speakerVoice = allVoices[0].id;
      }
    }

    ///-----Events Subscribing-----///
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
  };
};
