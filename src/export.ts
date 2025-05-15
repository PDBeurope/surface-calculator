/**
 * Copyright (c) 2024-2025 EMBL - European Bioinformatics Institute, licensed under Apache 2.0, see LICENSE file for more info.
 *
 * @author Adam Midlik <midlik@gmail.com>
 */

import fs from 'fs';
import path from 'path';

import { GeometryControls } from 'molstar/lib/commonjs/extensions/geo-export/controls';
import { Vec3 } from 'molstar/lib/commonjs/mol-math/linear-algebra';
import { PluginContext } from 'molstar/lib/commonjs/mol-plugin/context';
import { Unzip } from 'molstar/lib/commonjs/mol-util/zip/zip';


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

/** JSON.stringify object of objects of arrays, with putting each array on separate line (dumb implementation but enough for what we need). */
function niceJsonStringify(data: Record<string, Record<string, any[]>>) {
    return JSON.stringify(data)
        .replace(/("\w*":)\{/g, '\n  $1 {')
        .replace(/("\w*":)\[/g, '\n    $1 [')
        .replace(/\]\}/g, ']\n  }')
        .replace(/\}\}/g, '}\n}\n');
}

/** Save object of objects of arrays in JSON, with putting each array on separate line (dumb implementation but enough for what we need). */
export function saveNiceJson(data: Record<string, Record<string, any[]>>, filename: string): void {
    fs.writeFileSync(filename, niceJsonStringify(data), { encoding: 'utf8' });
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
