#!/usr/bin/env node

/**
 * Copyright (c) 2024-2025 EMBL - European Bioinformatics Institute, licensed under Apache 2.0, see LICENSE file for more info.
 *
 * @author Adam Midlik <midlik@gmail.com>
 */

import { main, parseArguments } from './main';


parseArguments().then(args => main(args));
