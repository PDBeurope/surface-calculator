#!/usr/bin/env node

/**
 * Copyright (c) 2024-2026 EMBL - European Bioinformatics Institute, licensed under Apache 2.0, see LICENSE file for more info.
 *
 * @author Adam Midlik <midlik@gmail.com>
 */

import { main, parseArguments } from './main';


(async function () {
    try {
        const args = await parseArguments();
        await main(args);
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
})();
