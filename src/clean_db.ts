import * as path from "path";

import dotenv from 'dotenv';

import fs from "fs/promises";
import { stdin as input, stdout as output } from 'node:process';
import * as readline from "node:readline/promises";

const rl = readline.createInterface({ input, output });

dotenv.config();

(async () => {
    await rl.question('WARNING: this will remove all blockchain.db files in .peers. Press any key to continue or Ctrl+C to abort.');
    const files = await fs.readdir('./.peers');

    for await (const file of files) {
        const fn = path.resolve('.', '.peers', file, 'blockchain.db');
        try {
            await fs.rm(fn);
            console.log('removed', fn);
        } catch (e) {
            console.log('missing', fn);
        }
    }
})().catch(console.error)
    .finally(() => rl.close());