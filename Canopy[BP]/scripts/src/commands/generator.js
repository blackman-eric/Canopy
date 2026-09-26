import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus } from "@minecraft/server";
import { BooleanRule, PlayerCommandOrigin, VanillaCommand } from "../../lib/canopy/Canopy";
import { generatorChannels } from "../classes/GeneratorChannels";
import { ITEM_COUNTER_COLORS } from "../classes/ItemCounterChannels";
import { formatColorStr, broadcastActionBar } from "../../include/utils";

export const GENERATOR_CHANNELS = Object.freeze(['all', ...ITEM_COUNTER_COLORS]);

export const GENERATOR_ACTIONS = Object.freeze([
    'realtime',
    'reset',
    'remove'
]);

new BooleanRule({
    category: 'Rules',
    identifier: 'hopperGenerators',
    description: { translate: 'rules.hopperGenerators' },
    wikiDescription: 'Enables/disables the generator command and hopper generator functionality. Disabling this rule also resets all generators.',
    onEnableCallback: () => generatorChannels.enable(),
    onDisableCallback: () => generatorChannels.disable()
});

export class GeneratorCommand extends VanillaCommand {
    constructor() {
        super({
            name: 'canopy:generator',
            description: 'commands.generator',
            enums: [
                {
                    name: 'canopy:generatorChannel',
                    values: GENERATOR_CHANNELS
                },
                {
                    name: 'canopy:generatorAction',
                    values: GENERATOR_ACTIONS
                }
            ],
            optionalParameters: [
                {
                    name: 'canopy:generatorChannel',
                    type: CustomCommandParamType.Enum
                },
                {
                    name: 'canopy:generatorAction',
                    type: CustomCommandParamType.Enum
                }
            ],
            permissionLevel: CommandPermissionLevel.Any,
            allowedSources: [PlayerCommandOrigin],
            contingentRules: ['hopperGenerators'],
            aliases: ['canopy:gt'],
            callback: (origin, ...args) => this.generatorCommand(origin, ...args),
            wikiDescription: 'Displays hopper generator statistics for all channels or one wool-color channel. Use `all` to apply an action to every channel. `realtime` displays rates using real-world time, `reset` resets counts, and `remove` removes tracked hoppers. Alias: **`/gt`**.'
        });
    }

    generatorCommand(origin, channel, action) {
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
        } else {
            return {
                status: CustomCommandStatus.Failure,
                message: 'commands.generic.invalidaction'
            };
        }

        return { status: CustomCommandStatus.Success };
    }
}

function reset(sender, color) {
    generatorChannels.resetCounts(color);
    sender.sendMessage({ translate: 'commands.generator.reset.single', with: [formatColorStr(color)] });
    broadcastActionBar({ translate: 'commands.generator.reset.single.actionbar', with: [sender.name, formatColorStr(color)] }, sender);
}

function resetAll(sender) {
    generatorChannels.resetAllCounts();
    sender.sendMessage({ translate: 'commands.generator.reset.all' });
    broadcastActionBar({ translate: 'commands.generator.reset.all.actionbar', with: [sender.name] }, sender);
}

function query(sender, color, { useRealTime = false } = {}) {
    sender.sendMessage(generatorChannels.getQueryOutput(color, useRealTime));
}

function queryAll(sender, { useRealTime = false } = {}) {
    sender?.sendMessage(generatorChannels.getAllQueryOutput(useRealTime));
}

function remove(sender, color) {
    generatorChannels.removeHoppers(color);
    sender.sendMessage({ translate: 'commands.generator.remove.single', with: [formatColorStr(color)] });
    broadcastActionBar({ translate: 'commands.generator.remove.single.actionbar', with: [sender.name, formatColorStr(color)] }, sender);
}

function removeAll(sender) {
    generatorChannels.removeAllHoppers();
    sender.sendMessage({ translate: 'commands.generator.remove.all' });
    broadcastActionBar({ translate: 'commands.generator.remove.all.actionbar', with: [sender.name] }, sender);
}

export const generatorCommand = new GeneratorCommand();

export { query, queryAll };
