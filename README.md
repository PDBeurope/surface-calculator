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

node lib/index.js examples/input.txt ../outputs/ --quality medium --probe 1.4

# Run on local files:
node lib/index.js examples/input.txt ../outputs/ --quality medium --probe 1.4 --source 'file:///wherever/you/have/your/data/{id}.cif'
# {id} will get replaced by the entry ID (e.g. 1cbs)
```

### Input

The input file (see example in `examples/input.txt`) should contain a list of jobs to process (one job per line).

Each job can be either:
- `{entry_id},{auth_chain_id}` to process one polymer chain (e.g. `1bvy,F`)
- `{entry_id}` to process all polymer chains in the structure (e.g. `1bvy`)

Lines begining with # are ignored.
