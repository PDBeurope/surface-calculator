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
