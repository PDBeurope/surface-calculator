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
import { createFilename, loadInputDataset } from './input';
import { DefaultSurfaceOptions, Granularities, Granularity, QualityLevel, QualityLevels, computeSurface, exportGeometry, getSurfaceMetadata, niceJsonStringify } from './surface';


setFSModule(fs);

const DEFAULT_SOURCE = 'https://www.ebi.ac.uk/pdbe/entry-files/download/{id}_updated.cif';

/** Command line argument values for `main` */
interface Args {
    input: string,
    output_dir: string,
    source?: string,
    quality?: QualityLevel,
    probe?: number,
    granularity?: Granularity,
    metadata?: boolean,
    molj?: boolean,
}

/** Return parsed command line arguments for `main` */
function parseArguments(): Args {
    const parser = new ArgumentParser({ description: 'Command-line application for computing molecular surfaces' });
    parser.add_argument('input', { help: 'Input file with the list of chains to process. Each line is {entry_id}_{assembly_id}-{auth_chain_id} (omit _{assembly_id} to process deposited model; omit -{auth_chain_id} to process all polymer chains)' });
    parser.add_argument('output_dir', { help: 'Path for output directory' });
    parser.add_argument('--source', { help: `Template for creating the URL of input structure file for a specify entry. {id} will be replaced by actual entry ID. Can use http:// or https:// or file:// protocol. Structure files can be in .cif or .bcif format. Default: ${DEFAULT_SOURCE}` });
    parser.add_argument('--quality', { choices: QualityLevels, help: `Surface quality level. Default: ${DefaultSurfaceOptions.quality}` });
    parser.add_argument('--probe', { type: Number, help: `Probe radius. Default: ${DefaultSurfaceOptions.probeRadius}` });
    parser.add_argument('--granularity', { choices: Granularities, help: `'structure' to calculate surface of the structure as a whole, 'chain' to calculate surface of each chain separately. Default: ${DefaultSurfaceOptions.granularity}` });
    parser.add_argument('--metadata', { action: 'store_true', help: 'Output additional file {filename}.metadata.json with mesh vertex metadata' });
    parser.add_argument('--molj', { action: 'store_true', help: 'Output additional file {filename}.molj with Molstar session, mostly for debugging' });
    const args = parser.parse_args();
    return { ...args };
}

/** Main workflow */
async function main(args: Args): Promise<void> {
    const dataset = loadInputDataset(args.input);
    const plugin = await createHeadlessPlugin();
    fs.mkdirSync(args.output_dir, { recursive: true });

    for (const chainRef of dataset) {
        const filename = createFilename(chainRef);
        console.log(`Processing ${filename}`);

        const url = (args.source ?? DEFAULT_SOURCE).replace('{id}', chainRef.entryId);
        const surface = await computeSurface(plugin, { url, assemblyId: chainRef.assemblyId, authChainId: chainRef.chainId }, { quality: args.quality, probeRadius: args.probe, granularity: args.granularity });
        if (args.molj) {
            await plugin.saveStateSnapshot(path.join(args.output_dir, `${filename}.molj`));
        }
        await exportGeometry(plugin, path.join(args.output_dir, `${filename}.zip`));
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


main(parseArguments());
