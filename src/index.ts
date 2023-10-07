import * as fs from 'fs/promises';
import * as path from 'path';
import { execa } from 'execa';
import type { ExecaChildProcess } from 'execa';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

// entry point

(async () => {

    const files = await fs.readdir(path.resolve('.', '.peers'));

    const proc = execa(
        'tsx',
        [
            path.resolve('.', 'src', 'node.ts'),
            '0',
        ],
        {
            cwd: path.resolve('.', '.peers', '0'),
            all: true
        })
    console.log('SPAWN', 0, proc.pid);
    proc.all?.on('data', (data) => console.log(uint8ArrayToString(data).replace(/\n/g, '')));
    await new Promise((resolve) => setTimeout(resolve, 3_000));

    const processes: ExecaChildProcess[] = [];

    for await (const file of files.slice(1)) {
        const proc = execa(
            'tsx',
            [
                path.resolve('.', 'src', 'node.ts'),
                files.indexOf(file).toString(),
            ],
            {
                cwd: path.resolve('.', '.peers', file),
                all: true
            })
        processes.push(proc);
        console.log('SPAWN', files.indexOf(file), proc.pid);
        proc.all?.on('data', (data) => console.log(uint8ArrayToString(data).replace(/\n/g, '')));
        await new Promise((resolve) => setTimeout(resolve, 2_000));
    }

    // Simulates one of the nodes going offline
    // setTimeout(() => {
    //     processes[5].kill(15);
    // }, 20_000)

    while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
    }

})().catch(console.error)