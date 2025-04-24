# surface-calculator

A simple Molstar-based command-line program to compute molecular surfaces and save in Wavefront (.obj) format.

## Dependencies

- [Node](https://nodejs.org/)


## Installation

```sh
git clone https://github.com/midlik/surface-calculator
cd surface-calculator
npm install
npm run build
```

## Usage

```sh
node lib/index.js --help

node lib/index.js --input 1bvy-A 1bvy-B 1bvy-F --output-dir ../outputs/ --quality medium --probe 1.4

node lib/index.js --input-file examples/input.txt --output-dir ../outputs/ --quality medium --probe 1.4

# Run on local files:
node lib/index.js --input-file examples/input.txt --output-dir ../outputs/ --quality medium --probe 1.4 --source 'file:///wherever/you/have/your/data/{id}.cif'
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
