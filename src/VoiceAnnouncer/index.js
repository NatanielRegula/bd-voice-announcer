'use strict';

/**
 *
 * @param {import("zerespluginlibrary").Plugin} Plugin
 * @param {import("zerespluginlibrary").BoundAPI} Library
 * @returns
 */

/**
 * @typedef {{
 * id:string
 * label:string
 * audioClips: {
 * botJoinedYourChannel: string
 * botLeftYourChannel: string
 * channelSwitched: string
 * connected: string
 * deafened: string
 * disconnected: string
 * error: string
 * muted: string
 * undeafened: string
 * unmuted: string
 * userJoinedYourChannel: string
 * userLeftYourChannel: string
 * }
 * }} VoiceData
 */

/**
 * @typedef {{
 * channelId: string|null
 * deaf: boolean
 * guildId: string
 * mute: boolean
 * oldChannelId: string | undefined
 * requestToSpeakTimestamp: number | null
 * selfDeaf: boolean
 * selfMute: boolean
 * selfStream: boolean
 * selfVideo: boolean
 * sessionId: string
 * suppress: boolean
 * userId: string
 * }} DisVoiceState
 */

module.exports = (Plugin, Library) => {
  const BdApi = new window.BdApi('VoiceAnnouncer');
  const { ContextMenu, Data, Webpack } = BdApi;

  const { Logger, DiscordModules } = Library;
  const DisStreamerModeStore = DiscordModules.StreamerModeStore;
  const DisMediaInfo = DiscordModules.MediaInfo;
  const DisSelectedChannelStore = DiscordModules.SelectedChannelStore;
  const DisUserStore = DiscordModules.UserStore;
  // const DisUserStore = DiscordModules.UserStore;

  const DisSelectedGuildStore = Webpack.getModule(
    Webpack.Filters.byProps('getGuildId', 'getLastSelectedGuildId')
  );
  const Dispatcher = Webpack.getModule(
    Webpack.Filters.byProps('dispatch', 'subscribe')
  );
  const DisVoiceStateStore = Webpack.getModule(
    Webpack.Filters.byProps('getVoiceStateForUser', 'getVoiceStatesForChannel')
  );
  const DisNotificationSettingsStore = Webpack.getModule(
    Webpack.Filters.byProps('isSoundDisabled', 'getTTSType')
  );
  const DisNotificationSettingsController = Webpack.getModule(
    Webpack.Filters.byProps('setDisabledSounds', 'setTTSType')
  );

  const localVoices = [
    JSON.parse(require('female.json')),
    JSON.parse(require('male.json')),
  ];

  /**
   *
   * @readonly
   * @enum {{
   * name: string,
   * replacesInDis: Array<string>,
   * }}
   */
  const VOICE_ANNOUNCEMENT = Object.freeze({
    CONNECTED: { name: 'connected', replacesInDis: ['user_join'] },
    DISCONNECTED: { name: 'disconnected', replacesInDis: ['disconnect'] },
    CHANNEL_SWITCHED: {
      name: 'channelSwitched',
      replacesInDis: ['user_moved'],
    },
    DEAFENED: { name: 'deafened', replacesInDis: ['deafen'] },
    UNDEAFENED: { name: 'undeafened', replacesInDis: ['undeafen'] },
    MUTED: { name: 'muted', replacesInDis: ['mute'] },
    UNMUTED: { name: 'unmuted', replacesInDis: ['unmute'] },
    USER_JOINED_YOUR_CHANNEL: {
      name: 'userJoinedYourChannel',
      replacesInDis: ['user_join'],
    },
    BOT_JOINED_YOUR_CHANNEL: {
      name: 'botJoinedYourChannel',
      replacesInDis: ['user_join'],
    },
    USER_LEFT_YOUR_CHANNEL: {
      name: 'userLeftYourChannel',
      replacesInDis: ['user_leave'],
    },
    BOT_LEFT_YOUR_CHANNEL: {
      name: 'botLeftYourChannel',
      replacesInDis: ['user_leave'],
    },

    ERROR: { name: 'error', replacesInDis: [] },
  });

  /**
   * Returns the enum with name equal to the one passed to this function.
   *
   * Null will be returned if the matching enum is not found.
   * @param {string} name
   * @returns {VOICE_ANNOUNCEMENT?}
   */
  const getVoiceAnnouncementByName = (name) => {
    /**@type {VOICE_ANNOUNCEMENT?} */
    let r;

    Object.entries(VOICE_ANNOUNCEMENT).forEach(([_, value]) => {
      if (Object.is(value.name, name)) {
        r = value;
      }
    });

    return r;
  };

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

      this.voiceChannelUpdateListenerHandler =
        this.voiceChannelUpdateListenerHandler.bind(this);

      this.voiceStateUpdateHandler = this.voiceStateUpdateHandler.bind(this);

      ///-----Event Listeners Subscriptions-----///
      this.setUpListeners = this.setUpListeners.bind(this);
      this.disposeListeners = this.disposeListeners.bind(this);
      this.disEventListenerPairs = [
        ['AUDIO_TOGGLE_SELF_MUTE', this.checkMuteStatusListenerHandler],
        ['AUDIO_TOGGLE_SELF_DEAF', this.checkDeafenedStatusListenerHandler],
        ['VOICE_STATE_UPDATES', this.voiceChannelUpdateListenerHandler],
        ['VOICE_STATE_UPDATES', this.voiceStateUpdateHandler],

        //maybe a better replacement for VOICE_CHANNEL_SELECT
        // ['MEDIA_SESSION_JOINED', this.checkTestStatusListenerHandler],

        // ['REMOTE_SESSION_DISCONNECT', this.checkTestStatusListenerHandler],

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
      this.restoreSingleStockDisSounds =
        this.restoreSingleStockDisSounds.bind(this);
      //settings
      this.setDefaultValuesForSettings =
        this.setDefaultValuesForSettings.bind(this);
      this.patchContextMenus = this.patchContextMenus.bind(this);
      this.getIsUserABot = this.getIsUserABot.bind(this);
      this.getIsJoinedLeftAnnouncementDisabled =
        this.getIsJoinedLeftAnnouncementDisabled.bind(this);
    }

    /**
     *
     * @param {string} userId
     * @param {boolean} value
     * @returns
     */
    setIsMarkUserAsBot(userId, value) {
      Data.save(`isUserMarkedAsBotById-${userId}`, value);
    }

    /**
     *
     * @param {string} userId
     * @returns {boolean}
     */
    getIsUserABot(userId) {
      const overriddenMarkedValue = Data.load(
        `isUserMarkedAsBotById-${userId}`
      );
      if (overriddenMarkedValue !== undefined) return overriddenMarkedValue;

      const userData = DisUserStore.getUser(userId);

      const autoDetectedIsBot = this.settings.botSpecificSettings
        .automaticallyDetectIfUserIsBot
        ? userData.bot
        : null;

      return autoDetectedIsBot ?? false;
    }

    /**
     *
     * @param {string} userId
     * @param {boolean} value
     * @returns
     */
    setIsJoinedLeftAnnouncementDisabled(userId, value) {
      Data.save(`isJoinedLeftAnnouncementDisabledById-${userId}`, value);
    }

    /**
     *
     * @param {string} userId
     * @returns {boolean}
     */
    getIsJoinedLeftAnnouncementDisabled(userId) {
      const overriddenValue = Data.load(
        `isJoinedLeftAnnouncementDisabledById-${userId}`
      );
      if (overriddenValue !== undefined) return overriddenValue;

      const disabledAnnouncementsForAllBots = this.getIsUserABot(userId)
        ? this.settings.botSpecificSettings.disableAnnouncementsForAllBots
        : null;

      return disabledAnnouncementsForAllBots ?? false;
    }

    ///-----Patch Context Menus For VC Users-----///
    patchContextMenus() {
      this.contextMenuPatch = ContextMenu.patch(
        'user-context',
        (element, data) => {
          const userData = data.user;
          if (userData === undefined || userData === null) return;

          const childrenOfContextMenu =
            element.props.children[0].props.children;

          childrenOfContextMenu.push(
            ContextMenu.buildItem({ type: 'separator' })
          );

          childrenOfContextMenu.push(
            ContextMenu.buildItem({
              type: 'menu',
              label: this.getName(),
              children: [
                ContextMenu.buildItem({
                  type: 'toggle',
                  label: 'Disable Joined/Left channel',
                  checked: this.getIsJoinedLeftAnnouncementDisabled(
                    userData.id
                  ),
                  action: () =>
                    this.setIsJoinedLeftAnnouncementDisabled(
                      userData.id,
                      !this.getIsJoinedLeftAnnouncementDisabled(userData.id)
                    ),
                }),

                ContextMenu.buildItem({
                  type: 'toggle',
                  label: 'Mark As a Bot',
                  subtext:
                    'This will replace "User" with "Bot" for all the standard announcements, for example when the bot joins your voice channel you will hear "Bot joined your channel".',
                  checked: this.getIsUserABot(userData.id),
                  action: () =>
                    this.setIsMarkUserAsBot(
                      userData.id,
                      !this.getIsUserABot(userData.id)
                    ),
                }),
              ],
            })
          );
          // element.props.children.props.children[0].push({
          //   type: 'submenu',
          //   label: 'BetterDiscord',
          //   items: [],
          // });
        }
      );
    }

    ///-----Misc-----///
    /**
     * @returns {Array<string>}
     */
    getCurrentVoiceChannelUsersIds() {
      const voiceStatesForCurrentVoiceChannelObject =
        DisVoiceStateStore.getVoiceStatesForChannel(
          DisSelectedChannelStore.getVoiceChannelId()
        );

      /**
       * @type {Array<string>}
       */
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
          if (this.getIsJoinedLeftAnnouncementDisabled(userId)) return;

          this.getIsUserABot(userId)
            ? this.playAudioClip(VOICE_ANNOUNCEMENT.BOT_JOINED_YOUR_CHANNEL)
            : this.playAudioClip(VOICE_ANNOUNCEMENT.USER_JOINED_YOUR_CHANNEL);
        });

        idsOfUsersWhoLeft.forEach((userId) => {
          if (this.getIsJoinedLeftAnnouncementDisabled(userId)) return;
          this.getIsUserABot(userId)
            ? this.playAudioClip(VOICE_ANNOUNCEMENT.BOT_LEFT_YOUR_CHANNEL)
            : this.playAudioClip(VOICE_ANNOUNCEMENT.USER_LEFT_YOUR_CHANNEL);
        });
      } catch (error) {
        Logger.error(error);
      }
    }

    async voiceStateUpdateHandler(e) {
      if (!this.shouldMakeSound()) return;

      // Logger.info('voiceStateUpdateHandler event fired');
      // Logger.info(e);

      /**
       * @type {DisVoiceState}
       */
      const voiceState = e.voiceStates[0];

      // this isn't an update to current user
      // Logger.info(`not our user(${this.cachedCurrentUserId})`);
      if (voiceState.userId != this.cachedCurrentUserId) return;

      // channel didn't change
      if (voiceState.channelId == this.cachedVoiceChannelId) return;

      // this timeout in combination with DisSelectedGuildStore.getGuildId() later makes sure that VOICE_ANNOUNCEMENT.CHANNEL_SWITCHED
      // is called when changing to a voice channel in a different guild
      // if not for this the announcer would say disconnected and connected at the same time instead.
      await new Promise((r) => setTimeout(r, 10));

      this.refreshCurrentVoiceChannelUsersIdsCache();

      if (voiceState.channelId == null) {
        //this check prevents the disconnected announcement being made when changing to a voice channel in a different guild
        if (DisSelectedGuildStore.getGuildId() != voiceState.guildId) return;

        //disconnected
        this.playAudioClip(VOICE_ANNOUNCEMENT.DISCONNECTED);
        this.cachedVoiceChannelId = voiceState.channelId;

        return;
      }

      if (
        voiceState.oldChannelId != null ||
        this.cachedVoiceChannelId != null
      ) {
        //channel switched
        this.playAudioClip(VOICE_ANNOUNCEMENT.CHANNEL_SWITCHED);
        this.cachedVoiceChannelId = voiceState.channelId;

        return;
      }

      if (voiceState.oldChannelId == null) {
        //this check prevents the connected announcement being made when changing to a voice channel in a different guild
        if (DisSelectedGuildStore.getGuildId() != voiceState.guildId) return;

        //connected
        this.playAudioClip(VOICE_ANNOUNCEMENT.CONNECTED);
        this.cachedVoiceChannelId = voiceState.channelId;

        return;
      }
    }

    checkTestStatusListenerHandler(e) {
      // if (!this.shouldMakeSound()) return;
      Logger.info('test event fired');
      Logger.info(e);
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
      this.patchContextMenus();

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
      const warningElement = document.createElement('div');
      warningElement.innerHTML =
        '<span style="font-weight:600; padding-bottom:0.5rem;">WARNING</span></br ><p style="padding-bottom:0.5rem;">Due to the fact that in discord the same stock sound is used for "Connected" and "User Joined Your Channel" you should set these two announcements to matching value (enabled or disabled) to avoid unforeseen behavior.</p> <p>The same goes for "User" "Bot" variations of commands.</p>';
      warningElement.style.backgroundColor = 'var(--info-warning-foreground)';
      warningElement.style.padding = '0.5rem 1rem';
      warningElement.style.borderRadius = '5px';
      warningElement.style.fontWeight = '500';
      warningElement.style.marginTop = '20px';
      warningElement.style.marginBottom = '20px';

      settingsPanel.element
        .getElementsByClassName('plugin-inputs collapsible')[0]
        .append(
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
          }).getElement()
        );

      settingsPanel.element
        .getElementsByClassName('plugin-inputs collapsible')[1]
        .prepend(warningElement);

      settingsPanel.addListener((categoryId, settingId, value) => {
        if (categoryId === 'enableDisableAnnouncements') {
          const correspondingVoiceAnnouncement =
            getVoiceAnnouncementByName(settingId);

          if (!correspondingVoiceAnnouncement) return;

          value
            ? this.disableStockDisSounds()
            : this.restoreSingleStockDisSounds(correspondingVoiceAnnouncement);

          return;
        }

        switch (settingId) {
          case 'disableDiscordStockSounds':
            this.settings.audioSettings['disableDiscordStockSounds'] = value;
            if (value) {
              this.disableStockDisSounds();
            } else {
              this.restoreStockDisSounds();
            }
            break;

          default:
            break;
        }
      });

      return settingsPanel.getElement();
    }

    onStop() {
      Logger.info('Plugin disabled!');
      window.voiceAnnouncerAdditionalVoicesArray = undefined;
      this.restoreStockDisSounds();
      this.disposeListeners();
      this.contextMenuPatch?.();
    }

    ///-----Voice Announcements-----///
    /**
     *
     * @returns {Array<VoiceData>}
     */
    getAllVoices() {
      const allVoices = [
        ...localVoices,
        ...(window.voiceAnnouncerAdditionalVoicesArray ?? []),
      ];
      return allVoices;
    }

    /**
     *
     * @param {string?} overrideVoiceId
     * @returns {VoiceData}
     */
    getSelectedSpeakerVoice(overrideVoiceId) {
      const allVoices = this.getAllVoices();

      /**
       * @type {string}
       */
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

    /**
     *
     * @param {VOICE_ANNOUNCEMENT} src
     * @param {string} overrideVoiceId
     * @returns
     */
    playAudioClip(src, overrideVoiceId) {
      // Logger.log(
      //   this.getSelectedSpeakerVoice(overrideVoiceId).audioClips[src.name]
      // );
      //TODO  && overrideVoiceId == undefined is a hack to make sure it makes a sound when trying a voice pack even if muted is disabled
      if (
        !this.settings.enableDisableAnnouncements[src.name] &&
        overrideVoiceId == undefined
      )
        return;

      const audioPlayer = new Audio(
        this.getSelectedSpeakerVoice(overrideVoiceId).audioClips[src.name]
      );
      audioPlayer.volume = this.settings.audioSettings.voiceNotificationVolume;

      audioPlayer.play().then(() => audioPlayer.remove());
    }

    /**
     * Method that dictates whether any announcement should be played based on user settings.
     * @returns {boolean}
     */
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

      if (!(Data.load('stockSoundsManipulated') ?? false)) {
        Data.save(
          'stockSoundsDisabledBeforeManipulated',
          DisNotificationSettingsStore.getDisabledSounds()
        );
      }

      const soundsToDisable = [];
      for (const [_, value] of Object.entries(VOICE_ANNOUNCEMENT)) {
        if (!this.settings.enableDisableAnnouncements[value.name]) continue;

        soundsToDisable.push(...value.replacesInDis);
      }

      DisNotificationSettingsController.setDisabledSounds([
        ...soundsToDisable,
        ...(Data.load('stockSoundsDisabledBeforeManipulated') ?? []),
      ]);

      Data.save('stockSoundsManipulated', true);
    }

    restoreStockDisSounds() {
      if (!(Data.load('stockSoundsManipulated') ?? false)) return;

      DisNotificationSettingsController.setDisabledSounds(
        Data.load('stockSoundsDisabledBeforeManipulated') ?? []
      );
      Data.save('stockSoundsManipulated', false);
    }

    /**
     *
     * @param {VOICE_ANNOUNCEMENT} voiceAnnouncement
     * @returns
     */
    restoreSingleStockDisSounds(voiceAnnouncement) {
      if (!(Data.load('stockSoundsManipulated') ?? false)) return;

      const stockSoundsDisabledBeforeManipulated =
        Data.load('stockSoundsDisabledBeforeManipulated') ?? [];

      voiceAnnouncement.replacesInDis.forEach((disSoundToRestore) => {
        if (stockSoundsDisabledBeforeManipulated.includes(disSoundToRestore))
          return;

        DisNotificationSettingsController.setDisabledSounds(
          DisNotificationSettingsStore.getDisabledSounds().filter(
            (e) => e !== disSoundToRestore
          )
        );
      });
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
    // handleDisabledAnnouncement(e) {

    // }
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
