import * as fs from "fs/promises";

import {createLibp2p} from "libp2p";
import {tcp} from "@libp2p/tcp";
import {yamux} from "@chainsafe/libp2p-yamux";
import {mplex} from "@libp2p/mplex";
import {noise} from "@chainsafe/libp2p-noise";
import { toString } from "uint8arrays";

import dotenv from 'dotenv';

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
    const fn = `./.peers/${files.length}.json`;
    await fs.writeFile(fn, JSON.stringify(peerId, null, 2));
    console.log('created', fn);
    libp2p.stop();

})().catch(console.error)