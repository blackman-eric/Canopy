import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomCommandStatus, Player } from '@minecraft/server';
import { PlayerCommandOrigin } from '../../../../../Canopy[BP]/scripts/lib/canopy/Canopy';

vi.mock('../../../../../Canopy[BP]/scripts/src/classes/CounterChannels', () => ({
    counterChannels: {
        enable: vi.fn(),
        disable: vi.fn(),
        getQueryOutput: vi.fn(() => ({ text: 'single' })),
        getAllQueryOutput: vi.fn(() => ({ text: 'all' })),
        resetCounts: vi.fn(),
        resetAllCounts: vi.fn(),
        setMode: vi.fn(),
        setAllModes: vi.fn(),
        removeHoppers: vi.fn(),
        removeAllHoppers: vi.fn()
    }
}));

vi.mock('../../../../../Canopy[BP]/scripts/include/utils', () => ({
    broadcastActionBar: vi.fn(),
    formatColorStr: vi.fn(color => color)
}));

import { counterChannels } from '../../../../../Canopy[BP]/scripts/src/classes/CounterChannels';
import {
    COUNTER_ACTIONS,
    COUNTER_CHANNELS,
    counterCommand
} from '../../../../../Canopy[BP]/scripts/src/commands/counter';

describe('CounterCommand registration', () => {
    it('registers the native counter command and ct alias', () => {
        expect(counterCommand.customCommand.name).toBe('canopy:counter');
        expect(counterCommand.customCommand.aliases).toEqual(['canopy:ct']);
        expect(counterCommand.customCommand.contingentRules).toEqual(['hopperCounters']);
    });

    it('uses channel then action as the optional parameter order', () => {
        expect(counterCommand.customCommand.optionalParameters.map(parameter => parameter.name)).toEqual([
            'canopy:counterChannel',
            'canopy:counterAction'
        ]);
    });

    it('keeps actions out of the channel enum', () => {
        expect(COUNTER_CHANNELS).toContain('all');
        expect(COUNTER_CHANNELS).toContain('red');
        expect(COUNTER_CHANNELS).not.toContain('reset');
        expect(COUNTER_CHANNELS).not.toContain('realtime');
    });

    it('includes all supported actions and modes', () => {
        expect(COUNTER_ACTIONS).toEqual([
            'realtime',
            'reset',
            'remove',
            'count',
            'hr',
            'min',
            'sec'
        ]);
    });
});

describe('CounterCommand dispatch', () => {
    let player;
    let origin;

    beforeEach(() => {
        vi.clearAllMocks();
        player = new Player();
        player.name = 'TestPlayer';
        origin = new PlayerCommandOrigin({ sourceEntity: player });
    });

    it('queries all channels when no arguments are supplied', () => {
        expect(counterCommand.counterCommand(origin)).toEqual({
            status: CustomCommandStatus.Success
        });

        expect(counterChannels.getAllQueryOutput).toHaveBeenCalledWith(false);
    });

    it('queries one channel when only a channel is supplied', () => {
        counterCommand.counterCommand(origin, 'red');

        expect(counterChannels.getQueryOutput).toHaveBeenCalledWith('red', false);
    });

    it('uses real-world time for all channels', () => {
        counterCommand.counterCommand(origin, 'all', 'realtime');

        expect(counterChannels.getAllQueryOutput).toHaveBeenCalledWith(true);
    });

    it('uses real-world time for one channel', () => {
        counterCommand.counterCommand(origin, 'blue', 'realtime');

        expect(counterChannels.getQueryOutput).toHaveBeenCalledWith('blue', true);
    });

    it('resets all channels', () => {
        counterCommand.counterCommand(origin, 'all', 'reset');

        expect(counterChannels.resetAllCounts).toHaveBeenCalledOnce();
    });

    it('resets one channel', () => {
        counterCommand.counterCommand(origin, 'green', 'reset');

        expect(counterChannels.resetCounts).toHaveBeenCalledWith('green');
    });

    it('sets the mode for all channels', () => {
        counterCommand.counterCommand(origin, 'all', 'hr');

        expect(counterChannels.setAllModes).toHaveBeenCalledWith('hr');
    });

    it('sets the mode for one channel', () => {
        counterCommand.counterCommand(origin, 'pink', 'sec');

        expect(counterChannels.setMode).toHaveBeenCalledWith('pink', 'sec');
    });

    it('removes all tracked hoppers', () => {
        counterCommand.counterCommand(origin, 'all', 'remove');

        expect(counterChannels.removeAllHoppers).toHaveBeenCalledOnce();
    });

    it('removes tracked hoppers from one channel', () => {
        counterCommand.counterCommand(origin, 'cyan', 'remove');

        expect(counterChannels.removeHoppers).toHaveBeenCalledWith('cyan');
    });
});
