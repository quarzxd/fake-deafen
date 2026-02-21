import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Menu } from "@webpack/common";

const MediaEngineActions = findByPropsLazy(
  "toggleSelfMute",
  "toggleSelfDeafen"
);
const NotificationSettingsStore = findByPropsLazy("getDisableAllSounds", "getState");

let updating = false;
async function update() {
  if (updating) return setTimeout(update, 125);
  updating = true;

  try {

    const state = NotificationSettingsStore.getState();
    const toDisable: string[] = [];
    if (!state.disabledSounds.includes("mute")) toDisable.push("mute");
    if (!state.disabledSounds.includes("unmute")) toDisable.push("unmute");
    if (!state.disabledSounds.includes("deafen")) toDisable.push("deafen");
    if (!state.disabledSounds.includes("undeafen")) toDisable.push("undeafen");
    state.disabledSounds.push(...toDisable);
    
    const { selfMute, selfDeaf } = fakeVoiceState;

    async function toggleIfNeeded(current: boolean, toggleFn: () => Promise<void>) {
      if (!current) await toggleFn();
      await new Promise(r => setTimeout(r, 50));
      await toggleFn();
    }


    await toggleIfNeeded(selfMute, MediaEngineActions.toggleSelfMute);
    await toggleIfNeeded(selfDeaf, MediaEngineActions.toggleSelfDeafen);

  } finally {

    const state = NotificationSettingsStore.getState();
    state.disabledSounds = state.disabledSounds.filter(i => ![
      "mute", "unmute", "deafen", "undeafen"
    ].includes(i));
    updating = false;
  }
}

const fakeVoiceState = {
  _selfMute: false,
  _selfDeaf: false,
  _serverMute: false,
  _serverDeaf: false,

  get selfMute() { return this._selfMute; },
  set selfMute(value) { this._selfMute = value; },

  get selfDeaf() { return this._selfDeaf; },
  set selfDeaf(value) { this._selfDeaf = value; },

  get serverMute() { return this._serverMute; },
  set serverMute(value) { this._serverMute = value; },

  get serverDeaf() { return this._serverDeaf; },
  set serverDeaf(value) { this._serverDeaf = value; },
};

const StateKeys = ["selfMute", "selfDeaf", "serverMute", "serverDeaf"];

export default definePlugin({
  name: "FakeMuteDeaf",
  description: "Quarz Made that shit",
  authors: [Devs.TheArmagan],

  modifyVoiceState(e) {
    if (window.VencordNative?.plugins?.isPluginEnabled?.("FakeMuteAndDeafen")) {
      return e;
    }
    for (const stateKey of StateKeys) {
      e[stateKey] = fakeVoiceState[stateKey];
    }
    return e;
  },

  contextMenus: {
    "audio-device-context"(children, data) {
      if (!data?.renderOutputDevices ||
          window.VencordNative?.plugins?.isPluginEnabled?.("FakeMuteAndDeafen")) return;

      const existingIndex = children.findIndex(child => child?.props?.id === "fake-mute-controls");
      if (existingIndex !== -1) return;

      children.push(
        <Menu.MenuItem
          id="fake-mute-controls"
          label="developed by quarz"
          children={[
            <Menu.MenuCheckboxItem
              id="fake-mute"
              label="Fake Mute"
              checked={fakeVoiceState.selfMute}
              action={() => {
                fakeVoiceState.selfMute = !fakeVoiceState.selfMute;
                update();
              }}
            />,
            <Menu.MenuCheckboxItem
              id="fake-deafen"
              label="Fake Deaf"
              checked={fakeVoiceState.selfDeaf}
              action={() => {
                fakeVoiceState.selfDeaf = !fakeVoiceState.selfDeaf;
                update();
              }}
            />
          ]}
        />
      );
    }
  },

  patches: [
    {
      find: "voiceServerPing(){",
      replacement: [
        {
          match: /voiceStateUpdate\((\w+)\){(.{0,10})guildId:/,
          replace: "voiceStateUpdate($1){$1=$self.modifyVoiceState($1);$2guildId:"
        }
      ]
    }
  ],
});
