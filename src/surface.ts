/**
 * Copyright (c) 2024-2025 EMBL - European Bioinformatics Institute, licensed under Apache 2.0, see LICENSE file for more info.
 *
 * @author Adam Midlik <midlik@gmail.com>
 */

import fs from 'fs';
import path from 'path';

import { GeometryControls } from 'molstar/lib/commonjs/extensions/geo-export/controls';
import { VisualQuality, VisualQualityNames } from 'molstar/lib/commonjs/mol-geo/geometry/base';
import { type GraphicsRenderObject } from 'molstar/lib/commonjs/mol-gl/render-object';
import { utf8Read, utf8Write } from 'molstar/lib/commonjs/mol-io/common/utf8';
import { Vec3 } from 'molstar/lib/commonjs/mol-math/linear-algebra';
import { Unit } from 'molstar/lib/commonjs/mol-model/structure';
import { ResidueHydrophobicity } from 'molstar/lib/commonjs/mol-model/structure/model/types';
import { Download, ParseCif } from 'molstar/lib/commonjs/mol-plugin-state/transforms/data';
import { ModelFromTrajectory, StructureComponent, StructureFromModel, TrajectoryFromMmCif } from 'molstar/lib/commonjs/mol-plugin-state/transforms/model';
import { StructureRepresentation3D } from 'molstar/lib/commonjs/mol-plugin-state/transforms/representation';
import { PluginContext } from 'molstar/lib/commonjs/mol-plugin/context';
import { MolScriptBuilder } from 'molstar/lib/commonjs/mol-script/language/builder';
import { StateObjectCell } from 'molstar/lib/commonjs/mol-state';
import { Unzip } from 'molstar/lib/commonjs/mol-util/zip/zip';
import { getPolymerLabelAsymIds } from './chain-mapping';


export interface StructureRef {
    /** URL of structure data file */
    url: string,
    /** Assembly ID (`undefined` means deposited model) */
    assemblyId: string | undefined,
    /** auth_asym_id of selected chain (or `undefined` to process all chains) */
    authChainId: string | undefined,
}

export type QualityLevel = Exclude<VisualQuality, 'custom'>;
export const QualityLevels = VisualQualityNames.filter(x => x !== 'custom');

export type Granularity = 'structure' | 'chain';
export const Granularities = ['structure', 'chain'] as Granularity[];

export interface SurfaceOptions {
    probeRadius: number,
    quality: QualityLevel,
    granularity: Granularity,
}
export const DefaultSurfaceOptions: SurfaceOptions = {
    probeRadius: 1.4,
    quality: 'high',
    granularity: 'structure',
};

export async function computeSurface(plugin: PluginContext, structureRef: StructureRef, options?: Partial<SurfaceOptions>) {
    const structure = await plugin.build()
        .toRoot()
        .apply(Download, { url: structureRef.url, isBinary: structureRef.url.toLowerCase().endsWith('.bcif') })
        .apply(ParseCif, {})
        .apply(TrajectoryFromMmCif, {})
        .apply(ModelFromTrajectory, { modelIndex: 0 })
        .apply(StructureFromModel, {
            type: structureRef.assemblyId ? { name: 'assembly', params: { id: structureRef.assemblyId } } : { name: 'model', params: {} },
        })
        .commit();

    if (!structure.data) throw new Error('structure.data is undefined');
    const labelAsymIds = getPolymerLabelAsymIds(structure.data, structureRef.authChainId);

    checkStructureAssemblyId(plugin.state.data.selectQ(q => q.byRef(structure.ref)).at(0), structureRef.assemblyId);

    const expr = MolScriptBuilder.struct.generator.atomGroups({
        'chain-test': MolScriptBuilder.core.set.has([
            MolScriptBuilder.set(...labelAsymIds),
            MolScriptBuilder.struct.atomProperty.macromolecular.label_asym_id(),
        ]),
    });

    const component = await plugin.build()
        .to(structure)
        .apply(StructureComponent, { type: { name: 'expression', params: expr } })
        .commit();
    if (!component.data || component.data.isEmpty) console.warn(`WARNING: Structure is empty (URL: ${structureRef.url}, chain: ${structureRef.authChainId ?? 'all chains'})`);

    const surface = await plugin.build()
        .to(component)
        .apply(StructureRepresentation3D, {
            type: {
                name: 'molecular-surface',
                params: {
                    quality: options?.quality ?? DefaultSurfaceOptions.quality,
                    probeRadius: options?.probeRadius ?? DefaultSurfaceOptions.probeRadius,
                    sizeFactor: 1,
                    visuals: (options?.granularity ?? DefaultSurfaceOptions.granularity) === 'structure' ? ['structure-molecular-surface-mesh'] : ['molecular-surface-mesh'],
                },
            },
        })
        .commit();
    return {
        structure: surface.data!.sourceData,
        meshes: surface.data!.repr.renderObjects.filter(obj => obj.type === 'mesh') as GraphicsRenderObject<'mesh'>[],
    };
}

function checkStructureAssemblyId(structureCell: StateObjectCell | undefined, assemblyId: string | undefined) {
    if (!structureCell) throw new Error('Structure cell does not exist');
    if (assemblyId === undefined) return; // Deposited structure

    const params = structureCell.transform.params;
    if (params.type.name !== 'assembly' || params.type.params.id !== assemblyId) {
        throw new Error(`Wrong structure: you wanted assembly ${assemblyId}, Molstar created assembly ${params.type.params.id}. Check you specified assembly ID of an existing assembly.`);
    }
}

/** Export current 3D canvas geometry and return as ZIP data  */
async function exportGeometry(plugin: PluginContext): Promise<Buffer<ArrayBuffer>> {
    plugin.canvas3d?.commit(true); // need to commit canvas3d before it is exported
    const geo = new GeometryControls(plugin);
    geo.behaviors.params.next({ format: 'obj' });
    const data = await geo.exportGeometry();
    const buffer = await data.blob.arrayBuffer();
    return Buffer.from(buffer);
}

/** Export current 3D canvas geometry to individual .mtl and .obj files (these file extensions will be added to `filename`).
 * If `firstVertex` is given, shift vertex coordinates in .obj file to align the first vertex with this. */
export async function saveGeometryFiles(plugin: PluginContext, filename: string, firstVertex?: Vec3): Promise<void> {
    const zipped = await exportGeometry(plugin);
    const unzipped = await Unzip(zipped).run();
    for (const key in unzipped) {
        let data = unzipped[key];
        if (!(data instanceof Uint8Array)) throw new Error(`Unzipped file ${key} is not Uint8Array`);
        const ext = path.extname(key);
        if (ext === '.obj' && firstVertex !== undefined) {
            data = applyMeshShift(data, firstVertex);
        }
        fs.writeFileSync(filename + ext, data);
    }
}

export function getSurfaceMetadata(surface: Awaited<ReturnType<typeof computeSurface>>) {
    const unitOffsets = getUnitOffsets(surface.structure.units);
    const group_properties = getGroupProps(surface.structure.units);
    const vertex_properties = getVertexProps(surface.meshes, unitOffsets);
    return { group_properties, vertex_properties };
}

/** Return group offsets for struct units, i.e. j-th atom in i-th unit has total index `getUnitOffsets(units)[i] + j`. */
function getUnitOffsets(units: readonly Unit[]) {
    const offsets: Record<number, number> = {};
    let offset = 0;
    for (let iUnit = 0; iUnit < units.length; iUnit++) {
        offsets[iUnit] = offset;
        offset += units[iUnit].elements.length;
    }
    return offsets;
}

/** Return group properties (value per group) */
function getGroupProps(units: readonly Unit[]) {
    const props = {
        atom_id: [] as number[],
        label_atom_id: [] as string[],
        label_comp_id: [] as string[],
        label_seq_id: [] as number[],
        label_asym_id: [] as string[],
        auth_asym_id: [] as string[],
        label_entity_id: [] as string[],
        residue_hydrophobicity_DGwif: [] as (number | null)[],
    };
    for (const unit of units) {
        const h = unit.model.atomicHierarchy;
        const conf = unit.model.atomicConformation;
        for (let i = 0; i < unit.elements.length; i++) { // eslint-disable-line @typescript-eslint/prefer-for-of
            const iElement = unit.elements[i];
            const iResidue = h.residueAtomSegments.index[iElement];
            const iChain = h.chainAtomSegments.index[iElement];

            props.atom_id.push(conf.atomId.value(iElement));
            props.label_atom_id.push(h.atoms.label_atom_id.value(iElement));
            props.label_comp_id.push(h.atoms.label_comp_id.value(iElement));
            props.label_seq_id.push(h.residues.label_seq_id.value(iResidue));
            props.label_asym_id.push(h.chains.label_asym_id.value(iChain));
            props.auth_asym_id.push(h.chains.auth_asym_id.value(iChain));
            props.label_entity_id.push(h.chains.label_entity_id.value(iChain));

            const label_comp_id = h.atoms.label_comp_id.value(iElement);
            props.residue_hydrophobicity_DGwif.push(hydrophobicity(label_comp_id, 'DGwif'));
        }
    }
    return props;
}

function hydrophobicity(label_comp_id: string, type: 'DGwif' | 'DGwoct' | 'Oct-IF') { // DGwif = DG water-membrane, DGwoct = DG water-octanol, Oct-IF = DG difference
    return (ResidueHydrophobicity as Partial<Record<string, number[]>>)[label_comp_id]?.[scaleIndexMap.DGwif] ?? null;
}
const scaleIndexMap = { 'DGwif': 0, 'DGwoct': 1, 'Oct-IF': 2 };


/** Return vertex properties (value per vertex) */
function getVertexProps(meshes: GraphicsRenderObject<'mesh'>[], unitOffsets: Record<number, number>) {
    const props = {
        group_index: [] as number[],
        // debug TODO remove
        x: [] as number[],
        y: [] as number[],
        z: [] as number[],
    };
    for (let iMesh = 0; iMesh < meshes.length; iMesh++) {
        const mesh = meshes[iMesh];
        const groups = mesh.values.aGroup.ref.value;
        const positions = mesh.values.aPosition.ref.value;

        // Clipping `groups` array because in practice it contains many more elements than just one-per-vertex (don't know why)
        const metadataVertexCount: number | undefined = (mesh.values.meta.ref.value as any)?.originalData?.vertexCount;
        const nVertices = (metadataVertexCount !== undefined) ? Math.min(metadataVertexCount, groups.length) : groups.length;

        for (let iVertex = 0; iVertex < nVertices; iVertex++) {
            const groupIndexWithinMesh = groups[iVertex];
            const groupIndex = unitOffsets[iMesh] + groupIndexWithinMesh;
            props.group_index.push(groupIndex);
            props.x.push(positions[iVertex * 3 + 0]);
            props.y.push(positions[iVertex * 3 + 1]);
            props.z.push(positions[iVertex * 3 + 2]);
        }
    }
    return props;
}

/** Return vertex properties (value per vertex) */
export function getFirstVertex(meshes: GraphicsRenderObject<'mesh'>[]): Vec3 | undefined {
    const mesh = meshes[0];
    if (!mesh) return undefined;
    const positions = mesh.values.aPosition.ref.value;
    if (positions.length < 3) return undefined;
    return Vec3.fromArray(Vec3(), positions, 0);
}

/** JSON.stringify object of objects of arrays, with putting each array on separate line (dumb implementation but enough for what we need). */
export function niceJsonStringify(data: Record<string, Record<string, any[]>>) {
    return JSON.stringify(data)
        .replace(/("\w*":)\{/g, '\n  $1 {')
        .replace(/("\w*":)\[/g, '\n    $1 [')
        .replace(/\]\}/g, ']\n  }')
        .replace(/\}\}/g, '}\n}\n');
}

/** Shift vertices in Wavefront .obj file so that the first vertex is at coordinates `firstVertex` */
function applyMeshShift(objData: Uint8Array, firstVertex: Vec3): Uint8Array {
    const str = Buffer.from(objData).toString('utf8');
    const lines = str.split('\n');
    const out: string[] = [];
    let shift: Vec3 | undefined = undefined;
    for (const line of lines) {
        if (line.startsWith('v ')) {
            const [_, x, y, z] = line.split(/\s+/);
            const xyz = Vec3.create(Number.parseFloat(x), Number.parseFloat(y), Number.parseFloat(z));
            if (!shift) {
                shift = Vec3.sub(Vec3(), firstVertex, xyz);
            }
            Vec3.add(xyz, xyz, shift);
            out.push(`v ${xyz[0].toFixed(3)} ${xyz[1].toFixed(3)} ${xyz[2].toFixed(3)}`);
        } else {
            out.push(line);
        }
    }
    return Buffer.from(out.join('\n'), 'utf8');
}
