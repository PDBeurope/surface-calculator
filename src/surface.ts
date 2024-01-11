import fs from 'fs';
import { Download, ParseCif } from 'molstar/lib/commonjs/mol-plugin-state/transforms/data';
import { ModelFromTrajectory, StructureComponent, StructureFromModel, TrajectoryFromMmCif } from 'molstar/lib/commonjs/mol-plugin-state/transforms/model';
import { StructureRepresentation3D } from 'molstar/lib/commonjs/mol-plugin-state/transforms/representation';
import { PluginContext } from 'molstar/lib/commonjs/mol-plugin/context';
import { GeometryControls } from 'molstar/lib/commonjs/extensions/geo-export/controls';
import { MolScriptBuilder } from 'molstar/lib/commonjs/mol-script/language/builder';
import { VisualQuality, VisualQualityNames } from 'molstar/lib/commonjs/mol-geo/geometry/base';
import { getChainMapping } from './chain-mapping';


export interface StructureRef {
    url: string,
    authChainId: string,
}

export type QualityLevel = Exclude<VisualQuality, 'custom'>;
export const QualityLevels = VisualQualityNames.filter(x => x !== 'custom');

export interface SurfaceOptions {
    probeRadius: number,
    quality: QualityLevel,
}
export const DefaultSurfaceOptions: SurfaceOptions = {
    probeRadius: 1.4,
    quality: 'high',
};

export async function computeSurface(plugin: PluginContext, structureRef: StructureRef, options?: Partial<SurfaceOptions>) {
    const structure = await plugin.build()
        .toRoot()
        .apply(Download, { url: structureRef.url, isBinary: structureRef.url.toLowerCase().endsWith('.bcif') })
        .apply(ParseCif, {})
        .apply(TrajectoryFromMmCif, {})
        .apply(ModelFromTrajectory, { modelIndex: 0 })
        .apply(StructureFromModel, { type: { name: 'model', params: {} } })
        .commit();

    if (!structure.data) throw new Error('structure.data is undefined');
    const chainMapping = getChainMapping(structure.data);
    const labelAsymId = chainMapping.authToLabel[structureRef.authChainId];

    const expr = MolScriptBuilder.struct.generator.atomGroups({
        'chain-test': MolScriptBuilder.core.rel.eq([MolScriptBuilder.struct.atomProperty.macromolecular.label_asym_id(), labelAsymId]),
    });

    const component = await plugin.build()
        .to(structure)
        .apply(StructureComponent, { type: { name: 'expression', params: expr } })
        .commit();
    const surface = await plugin.build()
        .to(component)
        .apply(StructureRepresentation3D, {
            type: {
                name: 'molecular-surface',
                params: {
                    quality: options?.quality ?? DefaultSurfaceOptions.quality,
                    probeRadius: options?.probeRadius ?? DefaultSurfaceOptions.probeRadius,
                    sizeFactor: 1,
                },
            }
        })
        .commit();
}

export async function exportGeometry(plugin: PluginContext, filename: string) {
    const geo = new GeometryControls(plugin);
    geo.behaviors.params.next({ format: 'obj' });
    const data = await geo.exportGeometry();
    const buffer = await data.blob.arrayBuffer();
    fs.writeFileSync(filename, Buffer.from(buffer));
}
