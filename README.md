# surface-calculator

A simple Molstar-based command-line program to compute molecular surfaces and save in Wavefront (.obj) format.

## Dependencies

- [Node](https://nodejs.org/)


## Installation

### From NPM registry

```sh
npm install -g surface-calculator
```

### From source code

```sh
git clone https://github.com/midlik/surface-calculator
cd surface-calculator
npm install
npm run build
```

## Usage

NOTE: The following examples assume you installed SurfaceCalculator globally with `npm install -g surface-calculator`. 
If you installed locally in the current directory (`npm install surface-calculator`), use `npx surface-calculator` instead of `surface-calculator`. 
If you cloned the git repository and built it, use `node ./lib/index.js` instead of `surface-calculator`.

```sh
surface-calculator --help

surface-calculator --input 1bvy-A 1bvy-B 1bvy-F --output-dir ../outputs/ --quality medium --probe 1.4

surface-calculator --input-file examples/input.txt --output-dir ../outputs/ --quality medium --probe 1.4

# Run on local files:
surface-calculator --input-file examples/input.txt --output-dir ../outputs/ --quality medium --probe 1.4 --source 'file:///wherever/you/have/your/data/{id}.cif'
# {id} will get replaced by the entry ID (e.g. 1bvy)
```

### Input

Input can be specified by either `--input` or `--input-file` parameter.

#### `--input`

This parameter can specify any number of *jobs* to process. 
Each job can be either:

- `{entry_id}` to process all polymer chains in the deposited model structure (e.g. `1e94`)
- `{entry_id}-{auth_chain_id}` to process one polymer chain in the deposited model structure (e.g. `1e94-E`)
- `{entry_id}_{assembly_id}` to process all polymer chains in the specified assembly structure (e.g. `1e94_3`)
- `{entry_id}_{assembly_id}-{auth_chain_id}` to process one polymer chain in the specified assembly structure (e.g. `1e94_3-E`)

#### `--input-file`

This parameter specifies a file from which the list of jobs should be read (one job per line). 
Job syntax is exactly the same as for `--input` parameter.
Lines begining with # are ignored.

See example in `examples/input.txt`.
