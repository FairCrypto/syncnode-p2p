import * as fs from 'fs/promises';
import * as path from 'path';
import { execa } from 'execa';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { createFromJSON } from '@libp2p/peer-id-factory'

// entry point

(async () => {

    const files = await fs.readdir('./.peers');
    const configs = await Promise.all(
        files.map(fn => fs.readFile(`./.peers/${fn}`, 'utf-8'))
    );
    const peers = await Promise.all(
        configs
            .map((data) =>  JSON.parse(data))
            .map((json) => createFromJSON(json))
    );
    const peerIds = await Promise.all(peers.map((peer) => peer.toString()));
    const sender = Math.floor(Math.random() * peerIds.length);

    for await (const file of files) {
        const proc = execa(
            'tsx',
            [
                path.resolve('.', 'src', 'node.ts'),
                files.indexOf(file).toString(),
                sender.toString(),
                ...peerIds
            ],
            {
                cwd: path.resolve('./'),
                all: true
            })
        console.log('STRT', files.indexOf(file), peerIds[files.indexOf(file)], proc.pid);
        proc.all?.on('data', (data) => console.log(uint8ArrayToString(data).replace(/\n/g, '')));
        // await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

})().catch(console.error)