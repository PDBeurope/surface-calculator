/**
 * Copyright (c) 2024-2025 EMBL - European Bioinformatics Institute, licensed under Apache 2.0, see LICENSE file for more info.
 *
 * @author Adam Midlik <midlik@gmail.com>
 */

import { ArgumentParser } from 'argparse';
import fs from 'fs';
import gl from 'gl';
import path from 'path';

import { GeometryExport } from 'molstar/lib/commonjs/extensions/geo-export';
import { HeadlessPluginContext } from 'molstar/lib/commonjs/mol-plugin/headless-plugin-context';
import { DefaultPluginSpec, PluginSpec } from 'molstar/lib/commonjs/mol-plugin/spec';
import { ExternalModules } from 'molstar/lib/commonjs/mol-plugin/util/headless-screenshot';
import { setFSModule } from 'molstar/lib/commonjs/mol-util/data-source';
import { createFilename, loadInputDataset, parseChainRef } from './input';
import { DefaultSurfaceOptions, Granularities, Granularity, QualityLevel, QualityLevels, computeSurface, getFirstVertex, getSurfaceMetadata, niceJsonStringify, saveGeometryFiles, saveGeometryZip } from './surface';


setFSModule(fs);

const DEFAULT_SOURCE = 'https://www.ebi.ac.uk/pdbe/entry-files/download/{id}_updated.cif';


/** Command line argument values for `main` */
export interface Args {
    input?: string[],
    input_file?: string,
    output_dir: string,
    source?: string,
    quality?: QualityLevel,
    probe?: number,
    granularity?: Granularity,
    zip?: boolean,
    metadata?: boolean,
    molj?: boolean,
}


/** Return parsed command line arguments for `main` */
export async function parseArguments(): Promise<Args> {
    const parser = new ArgumentParser({ description: 'Command-line application for computing molecular surfaces' });

    // Required params:
    const inputGroup = parser.add_mutually_exclusive_group({ required: true });
    inputGroup.add_argument('--input', { nargs: '*', help: 'Chains to process. Each argument is {entry_id}_{assembly_id}-{auth_chain_id} (omit _{assembly_id} to process deposited model; omit -{auth_chain_id} to process all polymer chains). Example: --input 1e94 1e94-E 1e94_3 1e94_3-E' });
    inputGroup.add_argument('--input-file', { help: 'Input file with the list of chains to process. Each line is {entry_id}_{assembly_id}-{auth_chain_id} (omit _{assembly_id} to process deposited model; omit -{auth_chain_id} to process all polymer chains)' });
    parser.add_argument('--output-dir', { required: true, help: 'Path for output directory' });

    // Optional params:
    parser.add_argument('--source', { help: `Template for creating the URL of input structure file for a specify entry. {id} will be replaced by actual entry ID. Can use http:// or https:// or file:// protocol. Structure files can be in .cif or .bcif format. Default: ${DEFAULT_SOURCE}` });
    parser.add_argument('--quality', { choices: QualityLevels, help: `Surface quality level. Default: ${DefaultSurfaceOptions.quality}` });
    parser.add_argument('--probe', { type: Number, help: `Probe radius. Default: ${DefaultSurfaceOptions.probeRadius}` });
    parser.add_argument('--granularity', { choices: Granularities, help: `'structure' to calculate surface of the structure as a whole, 'chain' to calculate surface of each chain separately. Default: ${DefaultSurfaceOptions.granularity}` });
    parser.add_argument('--zip', { action: 'store_true', help: 'Output surface data zipped in {filename}.zip file, instead of {filename}.mtl and {filename}.obj' });
    parser.add_argument('--metadata', { action: 'store_true', help: 'Output additional file {filename}.metadata.json with mesh vertex metadata' });
    parser.add_argument('--molj', { action: 'store_true', help: 'Output additional file {filename}.molj with Molstar session, mostly for debugging' });
    parser.add_argument('--version', { action: 'version', version: await getVersion(), help: 'Print version info and exit.' });

    const args = parser.parse_args();
    return { ...args };
}


/** Main workflow */
export async function main(args: Args): Promise<void> {
    const dataset = args.input ? args.input.map(parseChainRef) : args.input_file ? loadInputDataset(args.input_file) : [];
    const plugin = await createHeadlessPlugin();
    fs.mkdirSync(args.output_dir, { recursive: true });

    for (const chainRef of dataset) {
        const filename = createFilename(chainRef);
        console.log(`Processing ${filename}`);

        const url = (args.source ?? DEFAULT_SOURCE).replace('{id}', chainRef.entryId);
        const surface = await computeSurface(plugin, { url, assemblyId: chainRef.assemblyId, authChainId: chainRef.chainId }, { quality: args.quality, probeRadius: args.probe, granularity: args.granularity });
        const firstVertex = getFirstVertex(surface.meshes);

        if (args.molj) {
            await plugin.saveStateSnapshot(path.join(args.output_dir, `${filename}.molj`));
        }

        if (args.zip) {
            throw new Error('NotImplementedError: mesh shift for zipped file');
            await saveGeometryZip(plugin, path.join(args.output_dir, `${filename}.zip`));
        } else {
            await saveGeometryFiles(plugin, path.join(args.output_dir, filename), firstVertex);
        }

        if (args.metadata) {
            const surfaceMetadata = getSurfaceMetadata(surface);
            fs.writeFileSync(path.join(args.output_dir, `${filename}.metadata.json`), niceJsonStringify(surfaceMetadata), { encoding: 'utf8' });
        }

        await plugin.clear();
    }

    plugin.dispose();
}


/** Return a new and initiatized HeadlessPlugin */
async function createHeadlessPlugin(): Promise<HeadlessPluginContext> {
    const externalModules: ExternalModules = { gl };
    const spec = DefaultPluginSpec();
    spec.behaviors.push(PluginSpec.Behavior(GeometryExport));
    const plugin = new HeadlessPluginContext(externalModules, spec, { width: 100, height: 100 }, {});
    try {
        await plugin.init();
    } catch (error) {
        plugin.dispose();
        throw error;
    }
    return plugin;
}


export async function getVersion() {
    try {
        const packageJson = await require('../package.json'); // eslint-disable-line @typescript-eslint/no-require-imports
        return packageJson.version ?? '0.0.0';
    } catch {
        console.error('Failed to import package.json to retrieve version info');
        return '0.0.0';
    }
}
