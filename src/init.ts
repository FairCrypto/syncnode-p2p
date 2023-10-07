import * as fs from "fs/promises";
import * as path from "path";

import {createLibp2p} from "libp2p";
import {tcp} from "@libp2p/tcp";
import {yamux} from "@chainsafe/libp2p-yamux";
import {mplex} from "@libp2p/mplex";
import {noise} from "@chainsafe/libp2p-noise";
import { toString } from "uint8arrays";

import dotenv from 'dotenv';
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

dotenv.config();

(async () => {

    const libp2p = await createLibp2p({
        addresses: {
            listen: ['/ip4/0.0.0.0/tcp/0']
        },
        transports: [
            tcp(),
            // webSockets()
        ],
        streamMuxers: [
            yamux(), mplex()
        ],
        connectionEncryption: [
            noise()
        ]
    });
    const peerId = {
        privKey: toString(libp2p.peerId.privateKey!!, 'base64pad'),
        publicKey: toString(libp2p.peerId.publicKey!!, 'base64pad'),
        id: libp2p.peerId.toString()
    };

    const files = await fs.readdir('./.peers');
    const dir = `./.peers/${files.length}`;
    await fs.mkdir(dir, {recursive: true});
    const fn = path.resolve(dir, 'peer.json');
    await fs.writeFile(fn, JSON.stringify(peerId, null, 2));
    console.log('created', fn);
    const db = await open({
        filename: path.resolve(dir, 'blockchain.db'),
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
    });
    await db.exec('VACUUM;');
    libp2p.stop();
    await db.close();

})().catch(console.error)