/**
 * Copyright (c) 2024-2025 EMBL - European Bioinformatics Institute, licensed under Apache 2.0, see LICENSE file for more info.
 *
 * @author Adam Midlik <midlik@gmail.com>
 */

import { Structure } from 'molstar/lib/commonjs/mol-model/structure';
import { Entities } from 'molstar/lib/commonjs/mol-model/structure/model/properties/common';


type EntityType = ReturnType<Entities['data']['type']['value']>;

export interface ChainMapping {
    /** Maps each label_asym_id to corresponding auth_asym_id */
    labelToAuth: { [label_asym_id: string]: string },
    /** Maps each auth_asym_id to corresponding polymer label_asym_id */
    authToLabel: { [auth_asym_id: string]: string },
}

export function getChainMapping(structure: Structure): ChainMapping {
    const entities = structure.model.entities.data;
    const nEntities = entities._rowCount;
    const entityTypes: { [entityId: string]: EntityType } = {};
    for (let iEntity = 0; iEntity < nEntities; iEntity++) {
        const id = entities.id.value(iEntity);
        const type = entities.type.value(iEntity);
        entityTypes[id] = type;
    }
    const chains = structure.model.atomicHierarchy.chains;
    const nChains = chains._rowCount;
    const authToLabel: { [auth_asym_id: string]: string } = {};
    const labelToAuth: { [label_asym_id: string]: string } = {};
    for (let iChain = 0; iChain < nChains; iChain++) {
        const auth_asym_id = chains.auth_asym_id.value(iChain);
        const label_asym_id = chains.label_asym_id.value(iChain);
        const label_entity_id = chains.label_entity_id.value(iChain);
        labelToAuth[label_asym_id] = auth_asym_id;
        if (entityTypes[label_entity_id] === 'polymer') {
            authToLabel[auth_asym_id] ??= label_asym_id;
        }
    }
    return { authToLabel, labelToAuth };
}

/** If `authChainId` is defined, return list of label_asym_ids for polymer chains with given `authChainId` (should be 1 element).
 * If `authChainId` is undefined, return list of label_asym_ids for all polymer chains. */
export function getPolymerLabelAsymIds(structure: Structure, authAsymId: string | undefined): string[] {
    const chainMapping = getChainMapping(structure);
    if (authAsymId !== undefined) {
        // specific chain
        const labelAsymId = chainMapping.authToLabel[authAsymId];
        if (labelAsymId) return [labelAsymId];
        else return [];
    } else {
        // all polymer chains
        return Object.values(chainMapping.authToLabel);
    }
}
