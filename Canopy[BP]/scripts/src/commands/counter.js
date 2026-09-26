import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus } from "@minecraft/server";
import { BooleanRule, PlayerCommandOrigin, VanillaCommand } from "../../lib/canopy/Canopy";
import { counterChannels } from "../classes/CounterChannels";
import { ITEM_COUNTER_COLORS, ITEM_COUNTER_MODES } from "../classes/ItemCounterChannels";
import { broadcastActionBar, formatColorStr } from "../../include/utils";

export const COUNTER_CHANNELS = Object.freeze(['all', ...ITEM_COUNTER_COLORS]);

export const COUNTER_ACTIONS = Object.freeze([
    'realtime',
    'reset',
    'remove',
    ...ITEM_COUNTER_MODES
]);

new BooleanRule({
    category: 'Rules',
    identifier: 'hopperCounters',
    description: { translate: 'rules.hopperCounters' },
    wikiDescription: 'Enables/disables the counter command and hopper counter functionality. Disabling this rule also resets all counters.',
    onEnableCallback: () => counterChannels.enable(),
    onDisableCallback: () => counterChannels.disable()
});

export class CounterCommand extends VanillaCommand {
    constructor() {
        super({
            name: 'canopy:counter',
            description: 'commands.counter',
            enums: [
                {
                    name: 'canopy:counterChannel',
                    values: COUNTER_CHANNELS
                },
                {
                    name: 'canopy:counterAction',
                    values: COUNTER_ACTIONS
                }
            ],
            optionalParameters: [
                {
                    name: 'canopy:counterChannel',
                    type: CustomCommandParamType.Enum
                },
                {
                    name: 'canopy:counterAction',
                    type: CustomCommandParamType.Enum
                }
            ],
            permissionLevel: CommandPermissionLevel.Any,
            allowedSources: [PlayerCommandOrigin],
            contingentRules: ['hopperCounters'],
            aliases: ['canopy:ct'],
            callback: (origin, ...args) => this.counterCommand(origin, ...args),
            wikiDescription: 'Displays hopper counter statistics for all channels or one wool-color channel. Use `all` to apply an action to every channel. `realtime` displays rates using real-world time, `reset` resets counts, `remove` removes tracked hoppers, and `count`, `hr`, `min`, or `sec` set the InfoDisplay mode. Alias: **`/ct`**.'
        });
    }

    counterCommand(origin, channel, action) {
        const player = origin.getSource();
        const selectedChannel = channel ?? 'all';

        if (action === void 0) {
            if (selectedChannel === 'all')
                queryAll(player);
            else
                query(player, selectedChannel);
            return { status: CustomCommandStatus.Success };
        }

        if (action === 'realtime') {
            if (selectedChannel === 'all')
                queryAll(player, { useRealTime: true });
            else
                query(player, selectedChannel, { useRealTime: true });
        } else if (action === 'reset') {
            if (selectedChannel === 'all')
                resetAll(player);
            else
                reset(player, selectedChannel);
        } else if (action === 'remove') {
            if (selectedChannel === 'all')
                removeAll(player);
            else
                remove(player, selectedChannel);
        } else if (ITEM_COUNTER_MODES.includes(action)) {
            if (selectedChannel === 'all')
                setAllMode(player, action);
            else
                setMode(player, selectedChannel, action);
        } else {
            return {
                status: CustomCommandStatus.Failure,
                message: 'commands.generic.invalidaction'
            };
        }

        return { status: CustomCommandStatus.Success };
    }
}

function query(sender, color, { useRealTime = false } = {}) {
    sender.sendMessage(counterChannels.getQueryOutput(color, useRealTime));
}

function queryAll(sender, { useRealTime = false } = {}) {
    sender?.sendMessage(counterChannels.getAllQueryOutput(useRealTime));
}

function reset(sender, color) {
    counterChannels.resetCounts(color);
    sender.sendMessage({ translate: 'commands.counter.reset.single', with: [formatColorStr(color)] });
    broadcastActionBar({ translate: 'commands.counter.reset.single.actionbar', with: [sender.name, formatColorStr(color)] }, sender);
}

function resetAll(sender) {
    counterChannels.resetAllCounts();
    sender.sendMessage({ translate: 'commands.counter.reset.all' });
    broadcastActionBar({ translate: 'commands.counter.reset.all.actionbar', with: [sender.name] }, sender);
}

function setMode(sender, color, mode) {
    counterChannels.setMode(color, mode);
    sender.sendMessage({ translate: 'commands.counter.mode.single', with: [formatColorStr(color), mode] });
    broadcastActionBar({ translate: 'commands.counter.mode.single.actionbar', with: [sender.name, formatColorStr(color), mode] }, sender);
}

function setAllMode(sender, mode) {
    counterChannels.setAllModes(mode);
    sender.sendMessage({ translate: 'commands.counter.mode.all', with: [mode] });
    broadcastActionBar({ translate: 'commands.counter.mode.all.actionbar', with: [sender.name, mode] }, sender);
}

function removeAll(sender) {
    counterChannels.removeAllHoppers();
    sender.sendMessage({ translate: 'commands.counter.remove.all' });
    broadcastActionBar({ translate: 'commands.counter.remove.all.actionbar', with: [sender.name] }, sender);
}

function remove(sender, color) {
    counterChannels.removeHoppers(color);
    sender.sendMessage({ translate: 'commands.counter.remove.single', with: [formatColorStr(color)] });
    broadcastActionBar({ translate: 'commands.counter.remove.single.actionbar', with: [sender.name, formatColorStr(color)] }, sender);
}

export const counterCommand = new CounterCommand();

export { query, queryAll };
