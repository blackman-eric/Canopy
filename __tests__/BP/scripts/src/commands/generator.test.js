import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomCommandStatus, Player } from '@minecraft/server';
import { PlayerCommandOrigin } from '../../../../../Canopy[BP]/scripts/lib/canopy/Canopy';

vi.mock('../../../../../Canopy[BP]/scripts/src/classes/GeneratorChannels', () => ({
    generatorChannels: {
        enable: vi.fn(),
        disable: vi.fn(),
        getQueryOutput: vi.fn(() => ({ text: 'single' })),
        getAllQueryOutput: vi.fn(() => ({ text: 'all' })),
        resetCounts: vi.fn(),
        resetAllCounts: vi.fn(),
        removeHoppers: vi.fn(),
        removeAllHoppers: vi.fn()
    }
}));

vi.mock('../../../../../Canopy[BP]/scripts/include/utils', () => ({
    broadcastActionBar: vi.fn(),
    formatColorStr: vi.fn(color => color)
}));

import { generatorChannels } from '../../../../../Canopy[BP]/scripts/src/classes/GeneratorChannels';
import {
    GENERATOR_ACTIONS,
    GENERATOR_CHANNELS,
    generatorCommand
} from '../../../../../Canopy[BP]/scripts/src/commands/generator';

describe('GeneratorCommand registration', () => {
    it('registers the native generator command and gt alias', () => {
        expect(generatorCommand.customCommand.name).toBe('canopy:generator');
        expect(generatorCommand.customCommand.aliases).toEqual(['canopy:gt']);
        expect(generatorCommand.customCommand.contingentRules).toEqual(['hopperGenerators']);
    });

    it('uses channel then action as the optional parameter order', () => {
        expect(generatorCommand.customCommand.optionalParameters.map(parameter => parameter.name)).toEqual([
            'canopy:generatorChannel',
            'canopy:generatorAction'
        ]);
    });

    it('keeps actions out of the channel enum', () => {
        expect(GENERATOR_CHANNELS).toContain('all');
        expect(GENERATOR_CHANNELS).toContain('red');
        expect(GENERATOR_CHANNELS).not.toContain('realtime');
        expect(GENERATOR_CHANNELS).not.toContain('reset');
        expect(GENERATOR_CHANNELS).not.toContain('remove');
    });

    it('includes all supported actions', () => {
        expect(GENERATOR_ACTIONS).toEqual([
            'realtime',
            'reset',
            'remove'
        ]);
    });
});

describe('GeneratorCommand dispatch', () => {
    let player;
    let origin;

    beforeEach(() => {
        vi.clearAllMocks();

        player = new Player();
        player.name = 'TestPlayer';

        origin = new PlayerCommandOrigin({
            sourceEntity: player
        });
    });

    it('queries all channels when no arguments are supplied', () => {
        expect(generatorCommand.generatorCommand(origin)).toEqual({
            status: CustomCommandStatus.Success
        });

        expect(generatorChannels.getAllQueryOutput).toHaveBeenCalledWith(false);
    });

    it('queries one channel when only a channel is supplied', () => {
        generatorCommand.generatorCommand(origin, 'red');

        expect(generatorChannels.getQueryOutput).toHaveBeenCalledWith('red', false);
    });

    it('uses real-world time for all channels', () => {
        generatorCommand.generatorCommand(origin, 'all', 'realtime');

        expect(generatorChannels.getAllQueryOutput).toHaveBeenCalledWith(true);
    });

    it('uses real-world time for one channel', () => {
        generatorCommand.generatorCommand(origin, 'blue', 'realtime');

        expect(generatorChannels.getQueryOutput).toHaveBeenCalledWith('blue', true);
    });

    it('resets all channels', () => {
        generatorCommand.generatorCommand(origin, 'all', 'reset');

        expect(generatorChannels.resetAllCounts).toHaveBeenCalledOnce();
    });

    it('resets one channel', () => {
        generatorCommand.generatorCommand(origin, 'green', 'reset');

        expect(generatorChannels.resetCounts).toHaveBeenCalledWith('green');
    });

    it('removes all tracked hoppers', () => {
        generatorCommand.generatorCommand(origin, 'all', 'remove');

        expect(generatorChannels.removeAllHoppers).toHaveBeenCalledOnce();
    });

    it('removes tracked hoppers from one channel', () => {
        generatorCommand.generatorCommand(origin, 'cyan', 'remove');

        expect(generatorChannels.removeHoppers).toHaveBeenCalledWith('cyan');
    });
});
