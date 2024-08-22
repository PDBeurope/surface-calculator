/**
 *
 * @author Adam Midlik <midlik@gmail.com>
 *
 * Command-line application for computing molecular surfaces
 * Build: npm run build
 * Run:   node lib/index.js examples/input.txt ../outputs --source 'https://www.ebi.ac.uk/pdbe/entry-files/download/{id}_updated.cif' --quality medium --probe 1.4
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
import { loadInputDataset } from './input';
import { DefaultSurfaceOptions, QualityLevel, QualityLevels, computeSurface, exportGeometry } from './surface';


setFSModule(fs);

const DEFAULT_SOURCE = 'https://www.ebi.ac.uk/pdbe/entry-files/download/{id}_updated.cif';

/** Command line argument values for `main` */
interface Args {
    input: string,
    output_dir: string,
    source?: string,
    quality?: QualityLevel,
    probe?: number,
}

/** Return parsed command line arguments for `main` */
function parseArguments(): Args {
    const parser = new ArgumentParser({ description: 'Command-line application for computing molecular surfaces' });
    parser.add_argument('input', { help: 'Input file with the list of chains to process (each line is either {entry_id},{auth_chain_id} or {entry_id} (to process all polymer chains))' });
    parser.add_argument('output_dir', { help: 'Path for output directory' });
    parser.add_argument('--source', { help: `Template for creating the URL of input structure file for a specify entry. {id} will be replaced by actual entry ID. Can use http:// or https:// or file:// protocol. Structure files can be in .cif or .bcif format. Default: ${DEFAULT_SOURCE}` });
    parser.add_argument('--quality', { choices: QualityLevels, help: `Surface quality level. Default: ${DefaultSurfaceOptions.quality}` });
    parser.add_argument('--probe', { type: Number, help: `Probe radius. Default: ${DefaultSurfaceOptions.probeRadius}` });
    const args = parser.parse_args();
    return { ...args };
}

/** Main workflow */
async function main(args: Args): Promise<void> {
    const dataset = loadInputDataset(args.input);
    const plugin = await createHeadlessPlugin();
    fs.mkdirSync(args.output_dir, { recursive: true });

    for (const chainRef of dataset) {
        const filename = (chainRef.chainId !== undefined) ? `${chainRef.entryId}-${chainRef.chainId}` : chainRef.entryId;
        console.log(`Processing ${filename}`);

        const url = (args.source ?? DEFAULT_SOURCE).replace('{id}', chainRef.entryId);
        await computeSurface(plugin, { url, authChainId: chainRef.chainId }, { quality: args.quality, probeRadius: args.probe });
        await plugin.saveStateSnapshot(path.join(args.output_dir, `${filename}.molj`)); // DEBUG
        await exportGeometry(plugin, path.join(args.output_dir, `${filename}.zip`));
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

/** Parse integer, fail early. */
function parseIntStrict(str: string): number {
    if (str === '') throw new Error('Is empty string');
    const result = Number(str);
    if (isNaN(result)) throw new Error('Is NaN');
    if (Math.floor(result) !== result) throw new Error('Is not integer');
    return result;
}

/** Replace the file extension in `filename` by `extension`. If `filename` has no extension, add it. */
function withExtension(filename: string, extension: string): string {
    const oldExtension = path.extname(filename);
    return filename.slice(0, -oldExtension.length) + extension;
}


main(parseArguments());
