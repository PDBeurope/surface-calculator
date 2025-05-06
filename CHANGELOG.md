# Change Log
All notable changes to this project will be documented in this file, following the suggestions of [Keep a CHANGELOG](http://keepachangelog.com/). This project adheres to [Semantic Versioning](http://semver.org/) for its most widely used - and defacto - public interfaces.

## [Unreleased]

## [0.4.0] - 2025-05-06

- CLI syntax changed (`node lib/index.js X Y` -> `node lib/index.js --input-file X --output-dir Y`)
- Added --input parameter as alternative to --input-file
- Unzip outputs by default (use --zip to keep zipped)
- Fail when wrong assembly ID provided
- Option --version
- Docker container

## [0.3.1] - 2025-04-14

- Fixed bug (empty output when executed without --molj)

## [0.3.0] - 2025-03-14

- Option --metadata
- Option --molj
- Possibility to specify assembly ID in input file

## [0.2.0] - 2024-08-22

- Allow processing all chains together
- Option --granularity

## [0.1.0] - 2024-01-11

- Initial implementation
