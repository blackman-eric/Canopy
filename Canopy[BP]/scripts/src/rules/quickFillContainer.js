import { BlockComponentTypes, ButtonState, EntityComponentTypes, GameMode, InputButton, system, world } from "@minecraft/server";
import { AbilityRule } from "../../lib/canopy/Canopy";
import { QuickFillClipboardController } from "../classes/quickfill/QuickFillClipboardController";
import { QuickFillContainerPolicy } from "../classes/quickfill/QuickFillContainerPolicy";

class QuickFillContainer extends AbilityRule {
    bannedContainers = ['minecraft:beacon', 'minecraft:jukebox', 'minecraft:lectern'];
    
    constructor() {
        super({
            identifier: 'quickFillContainer',
            wikiDescription: 'With an arrow in the top left of your inventory (slot 9), interact with a container while holding an item to move matching items into it; sneak to reverse. Break a block container or attack a supported storage entity to copy it. With the clipboard active, interact to paste, sneak + interact to remove, and sneak + break/attack to deactivate it.',
            onEnableCallback: () => {
                world.beforeEvents.playerInteractWithBlock.subscribe(this.onPlayerInteractWithBlockBound);
                world.beforeEvents.playerBreakBlock.subscribe(this.onPlayerBreakBlockBound);
                world.beforeEvents.playerInteractWithEntity.subscribe(this.onPlayerInteractWithEntityBound);
                world.beforeEvents.entityHurt.subscribe(this.onEntityHurtBound);
            },
            onDisableCallback: () => {
                world.beforeEvents.playerInteractWithBlock.unsubscribe(this.onPlayerInteractWithBlockBound);
                world.beforeEvents.playerBreakBlock.unsubscribe(this.onPlayerBreakBlockBound);
                world.beforeEvents.playerInteractWithEntity.unsubscribe(this.onPlayerInteractWithEntityBound);
                world.beforeEvents.entityHurt.unsubscribe(this.onEntityHurtBound);
            }
        }, { slotNumber: 9 });
        this.onPlayerInteractWithBlockBound = this.onPlayerInteractWithBlock.bind(this);
        this.onPlayerBreakBlockBound = this.onPlayerBreakBlock.bind(this);
        this.onPlayerInteractWithEntityBound = this.onPlayerInteractWithEntity.bind(this);
        this.onEntityHurtBound = this.onEntityHurt.bind(this);
    }

    getBlockContainer(player, block) {
        if (block?.typeId === 'minecraft:ender_chest')
            return player.getComponent(EntityComponentTypes.EnderInventory)?.container;
        return block?.getComponent(BlockComponentTypes.Inventory)?.container;
    }

    getEntityContainer(entity) {
        const inventory = entity?.getComponent(EntityComponentTypes.Inventory);
        if (!inventory?.container)
            return;
        if (!['minecraft:donkey', 'minecraft:mule', 'minecraft:llama', 'minecraft:trader_llama'].includes(entity.typeId))
            return;
        if (inventory.containerType !== 'horse' || !entity.hasComponent(EntityComponentTypes.IsChested))
            return;
        return inventory.container;
    }

    onPlayerInteractWithBlock(event) {
        const player = event.player;
        const block = event.block;
        if (!player || !this.isEnabledForPlayer(player) || this.bannedContainers.includes(block?.typeId))
            return;

        const blockInv = this.getBlockContainer(player, block);
        const playerInv = player.getComponent(EntityComponentTypes.Inventory)?.container;
        if (!playerInv || !blockInv)
            return;

        const handItemStack = event.itemStack;
        const clipboard = QuickFillClipboardController.get(player);
        if (!clipboard && (QuickFillContainerPolicy.isClipboardOnly(block) || !handItemStack || !QuickFillContainerPolicy.canInsertItem(block, handItemStack)))
            return;
        event.cancel = true;

        const playerIsSneaking = player.inputInfo.getButtonState(InputButton.Sneak) === ButtonState.Pressed;
        system.run(() => {
            if (clipboard) {
                QuickFillClipboardController.apply(player, block, clipboard, playerIsSneaking, blockInv);
                return;
            }
            if (playerIsSneaking)
                this.transferToPlayer(player, block, handItemStack, blockInv);
            else if (player.getGameMode() === GameMode.Creative)
                this.fillCreative(player, block, handItemStack, blockInv);
            else
                this.transferToContainer(player, block, handItemStack, blockInv);
        });
    }

    onPlayerBreakBlock(event) {
        const player = event.player;
        const block = event.block;
        if (!player || !this.isEnabledForPlayer(player) || this.bannedContainers.includes(block?.typeId))
            return;

        const blockInv = this.getBlockContainer(player, block);
        if (!blockInv)
            return;

        const playerIsSneaking = player.inputInfo.getButtonState(InputButton.Sneak) === ButtonState.Pressed;
        if (playerIsSneaking && !QuickFillClipboardController.get(player))
            return;

        event.cancel = true;
        system.run(() => {
            if (playerIsSneaking) {
                QuickFillClipboardController.deactivate(player);
                return;
            }
            QuickFillClipboardController.copy(player, block, blockInv);
        });
    }

    onPlayerInteractWithEntity(event) {
        const player = event.player;
        const entity = event.target;
        if (!player || !this.isEnabledForPlayer(player))
            return;

        const entityInv = this.getEntityContainer(entity);
        const playerInv = player.getComponent(EntityComponentTypes.Inventory)?.container;
        if (!playerInv || !entityInv)
            return;

        const handItemStack = event.itemStack;
        const clipboard = QuickFillClipboardController.get(player);
        if (!clipboard && (!handItemStack || !QuickFillContainerPolicy.canInsertItem(entity, handItemStack)))
            return;
        event.cancel = true;

        const playerIsSneaking = player.inputInfo.getButtonState(InputButton.Sneak) === ButtonState.Pressed;
        system.run(() => {
            if (clipboard) {
                QuickFillClipboardController.apply(player, entity, clipboard, playerIsSneaking, entityInv);
                return;
            }
            if (playerIsSneaking)
                this.transferToPlayer(player, entity, handItemStack, entityInv);
            else if (player.getGameMode() === GameMode.Creative)
                this.fillCreative(player, entity, handItemStack, entityInv);
            else
                this.transferToContainer(player, entity, handItemStack, entityInv);
        });
    }

    onEntityHurt(event) {
        const player = event.damageSource?.damagingEntity;
        const entity = event.hurtEntity;
        if (player?.typeId !== 'minecraft:player' || event.damageSource?.damagingProjectile || !this.isEnabledForPlayer(player))
            return;

        const entityInv = this.getEntityContainer(entity);
        if (!entityInv)
            return;

        const playerIsSneaking = player.inputInfo.getButtonState(InputButton.Sneak) === ButtonState.Pressed;
        if (playerIsSneaking && !QuickFillClipboardController.get(player))
            return;

        event.cancel = true;
        system.run(() => {
            if (playerIsSneaking) {
                QuickFillClipboardController.deactivate(player);
                return;
            }
            QuickFillClipboardController.copy(player, entity, entityInv);
        });
    }

    fillCreative(player, target, itemStack, targetInv = this.getBlockContainer(player, target)) {
        if (!targetInv)
            return;

        let filledSlots = 0;
        for (let slot = 0; slot < targetInv.size; slot++) {
            if (!QuickFillContainerPolicy.canInsertItem(target, itemStack, slot))
                continue;

            const current = targetInv.getItem(slot);
            if (current && !current.isStackableWith(itemStack))
                continue;
            if (current && current.amount >= current.maxAmount)
                continue;

            const maxAmount = current?.maxAmount ?? itemStack.maxAmount;
            const replacement = current?.clone() ?? itemStack.clone();
            replacement.amount = maxAmount;
            try {
                targetInv.setItem(slot, replacement);
                filledSlots++;
            } catch {
                continue;
            }
        }

        const destinationFull = !filledSlots && targetInv.emptySlotsCount === 0;
        this.sendFeedbackMessage(true, player, target, itemStack, filledSlots, destinationFull);
    }

    transferToPlayer(player, target, itemStack, targetInv = this.getBlockContainer(player, target)) {
        const playerInv = player.getComponent(EntityComponentTypes.Inventory)?.container;
        if (!targetInv || !playerInv)
            return;
        const changedSlots = this.transferAllItemType(targetInv, playerInv, itemStack.typeId);
        const destinationFull = !changedSlots && playerInv.emptySlotsCount === 0 && this.hasItemType(targetInv, itemStack.typeId);
        this.sendFeedbackMessage(false, player, target, itemStack, changedSlots, destinationFull);
    }

    transferToContainer(player, target, itemStack, targetInv = this.getBlockContainer(player, target)) {
        const playerInv = player.getComponent(EntityComponentTypes.Inventory)?.container;
        if (!targetInv || !playerInv)
            return;
        const changedSlots = this.transferAllItemType(playerInv, targetInv, itemStack.typeId, target);
        const destinationFull = !changedSlots && targetInv.emptySlotsCount === 0;
        this.sendFeedbackMessage(true, player, target, itemStack, changedSlots, destinationFull);
    }

    hasItemType(container, itemTypeId) {
        for (let slot = 0; slot < container.size; slot++) {
            if (container.getItem(slot)?.typeId === itemTypeId)
                return true;
        }
        return false;
    }

    transferAllItemType(fromContainer, toContainer, itemTypeId, target) {
        const changedTargetSlots = target ? new Set() : undefined;
        let changedSourceSlots = 0;
        for (let slotIndex = 0; slotIndex < fromContainer.size; slotIndex++) {
            const currFromItem = fromContainer.getItem(slotIndex);
            if (currFromItem?.typeId !== itemTypeId)
                continue;

            const originalAmount = currFromItem.amount;
            const untransferred = target ? this.addItemToTarget(target, toContainer, currFromItem, changedTargetSlots) : toContainer.addItem(currFromItem);
            if (originalAmount === (untransferred?.amount ?? 0))
                continue;

            fromContainer.setItem(slotIndex, untransferred ?? null);
            changedSourceSlots++;
        }
        return target ? changedTargetSlots.size : changedSourceSlots;
    }

    addItemToTarget(target, container, itemStack, changedSlots) {
        let remainingAmount = itemStack.amount;
        for (let slot = 0; slot < container.size && remainingAmount > 0; slot++) {
            if (!QuickFillContainerPolicy.canInsertItem(target, itemStack, slot))
                continue;

            const current = container.getItem(slot);
            if (!current || !current.isStackableWith(itemStack) || current.amount >= current.maxAmount)
                continue;

            const added = Math.min(current.maxAmount - current.amount, remainingAmount);
            const replacement = current.clone();
            replacement.amount += added;
            try {
                container.setItem(slot, replacement);
                changedSlots.add(slot);
                remainingAmount -= added;
            } catch {
                continue;
            }
        }

        for (let slot = 0; slot < container.size && remainingAmount > 0; slot++) {
            if (container.getItem(slot) || !QuickFillContainerPolicy.canInsertItem(target, itemStack, slot))
                continue;

            const replacement = itemStack.clone();
            replacement.amount = Math.min(remainingAmount, itemStack.maxAmount);
            try {
                container.setItem(slot, replacement);
                changedSlots.add(slot);
                remainingAmount -= replacement.amount;
            } catch {
                continue;
            }
        }

        if (remainingAmount === 0)
            return;
        const remaining = itemStack.clone();
        remaining.amount = remainingAmount;
        return remaining;
    }

    sendFeedbackMessage(isFilling, player, target, itemStack, changedSlots, destinationFull = false) {
        if (!changedSlots) {
            if (destinationFull) {
                player.onScreenDisplay.setActionBar(isFilling
                    ? '§7Quick Fill: no available space in container.'
                    : '§7Quick Fill: player inventory is full.');
                return;
            }

            player.onScreenDisplay.setActionBar(`§7Quick Fill: nothing to ${isFilling ? 'fill' : 'remove'}.`);
            return;
        }

        const feedback = { rawtext: [] };
        if (isFilling) {
            feedback.rawtext.push({
                translate: 'rules.quickFillContainer.filled',
                with: { rawtext: [
                    { translate: target.localizationKey },
                    { translate: itemStack.localizationKey }
                ]}
            });
        } else {
            feedback.rawtext.push({
                translate: 'rules.quickFillContainer.taken',
                with: { rawtext: [
                    { translate: itemStack.localizationKey },
                    { translate: target.localizationKey }
                ]}
            });
        }
        const slotText = changedSlots === 1 ? 'slot' : 'slots';
        feedback.rawtext.push({ text: ` (§a${changedSlots}§7 ${slotText})` });
        player.onScreenDisplay.setActionBar(feedback);
    }
}

export const quickFillContainer = new QuickFillContainer();
