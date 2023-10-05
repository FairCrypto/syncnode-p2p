import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import {createLibp2p, Libp2p} from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import * as fs from 'fs/promises';
import { multiaddr } from '@multiformats/multiaddr'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { floodsub } from '@libp2p/floodsub'
import { mplex } from '@libp2p/mplex'
import {createFromJSON} from "@libp2p/peer-id-factory";
import {identifyService} from "libp2p/identify";
import debug from 'debug';

import dotenv from 'dotenv';

dotenv.config();
debug.enable('node:*');

const wait = (s: number) => new Promise((resolve) => setTimeout(resolve, s * 1000));

const connect = (libp2p: Libp2p, log: debug.Debugger) => async (peerId: string, peerIdx: string, peerIds: string[]) => {
    for await (const pId of peerIds) {
        const skip = Math.random() > 0.4;
        if (pId !== peerId && !skip) {
            const listenerMa = multiaddr(`/ip4/127.0.0.1/tcp/1033${peerIds.indexOf(pId)}/p2p/${pId}`);
            const otherData = await fs.readFile(`./.peers/${peerIds.indexOf(pId)}.json`, 'utf-8');
            const otherPeerId = JSON.parse(otherData);
            await libp2p.peerStore.patch(await createFromJSON(otherPeerId), {multiaddrs: [listenerMa]});
            const conn = await libp2p.dial(await createFromJSON(otherPeerId));
            // log('CONN', peerId, '<->', pId);
            log('CONN', peerIdx, '<->', peerIds.indexOf(pId));
        }
    }
}

const connect0 = (libp2p: Libp2p, log: debug.Debugger) => async (peerId: string, peerIdx: string, peerIds: string[]) => {
    const listenerMa = multiaddr(`/ip4/127.0.0.1/tcp/10330/p2p/${peerIds[0]}`);
    const otherData = await fs.readFile(`./.peers/0.json`, 'utf-8');
    const otherPeerId = JSON.parse(otherData);
    await libp2p.peerStore.patch(await createFromJSON(otherPeerId), {multiaddrs: [listenerMa]});
    const conn = await libp2p.dial(await createFromJSON(otherPeerId));
    // log('CONN', peerId, '<->', pId);
    log('CONN', peerIdx, '<->', 0);
}

// app entry point
(async () => {
    
    const [peerIdx, sender, ...peerIds] = process.argv.slice(2)
    const log = debug('node:' + peerIdx);
    const error = debug('node:error:' + peerIdx);

    const jsonString = await fs.readFile(`./.peers/${peerIdx}.json`, 'utf-8');
    const { id: peerId, privKey, pubKey } = JSON.parse(jsonString);

    let data: string | null = null;

    const options = {
        // add options
    }

    const libp2p = await createLibp2p({
        peerId: await createFromJSON({ id: peerId, privKey, pubKey }),
        addresses: {
            listen: ['/ip4/0.0.0.0/tcp/1033' + peerIdx]
        },
        transports: [
            tcp(),
            // webSockets()
        ],
        streamMuxers: [
            yamux(),
            // mplex()
        ],
        connectionEncryption: [
            noise()
        ],
        services: {
            // pubsub: floodsub(),
            pubsub: gossipsub(options),
            identify: identifyService()
        }
    });

    await wait(1);

    try {
        if (peerIdx !== '0') {
            await connect0(libp2p, log)(peerId, peerIdx, peerIds);
        }
        // await connect(libp2p, log)(peerId, peerIdx, peerIds);
    } catch (e: any) {
        error('ERR', peerIdx, e.message);
        await wait(1);
        if (peerIdx !== '0') {
            await connect0(libp2p, log)(peerId, peerIdx, peerIds);
        }
        // await connect(libp2p, log)(peerId, peerIdx, peerIds);
    }

    await wait(1)

    try {
        libp2p.services.pubsub.addEventListener('message', async (message) => {
            data = new TextDecoder().decode(message.detail.data);
            log(`RECV ${peerIdx} ${message.detail.topic}:`, data);
        }, { once: false })
    } catch (e: any) {
        console.error('ERR', peerIdx, e.message);
        await wait(0.5);
        libp2p.services.pubsub.addEventListener('message', async (message) => {
            data = new TextDecoder().decode(message.detail.data);
            log(`RECV ${peerIdx} ${message.detail.topic}:`, data);
        }, { once: false })
    }

    try {
        libp2p.services.pubsub.subscribe('fruit')
    } catch (e: any) {
        error('ERR', peerIdx, e.message);
        await new Promise((resolve) => setTimeout(resolve, 500));
        libp2p.services.pubsub.subscribe('fruit')
    }

    if (peerIdx === sender.toString()) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        data = 'banana';
        try {
            log(
                'PSUB', peerIdx,
                libp2p.services.pubsub.getPeers().length,
                libp2p.services.pubsub.getSubscribers('fruit').length,
            );
            libp2p.services.pubsub.publish('fruit', new TextEncoder().encode(data))
            log(`SEND ${peerIdx} fruit:`, data);
        } catch (e: any) {
            error('ERR', peerIdx, e.message);
            await wait(0.5);
            libp2p.services.pubsub.publish('fruit', new TextEncoder().encode(data))
            log(`SEND ${peerIdx} fruit:`, data);
        }

    }

    while (true) {
        log('INFO', peerIdx, 'peers', await libp2p.peerStore.all().then(_ => _.length));
        if (peerIdx === sender) {
            const fruit = Math.random().toString(36).substring(7);
            log(
                'PSUB', peerIdx,
                libp2p.services.pubsub.getPeers().length,
                libp2p.services.pubsub.getSubscribers('fruit').length,
            );
            libp2p.services.pubsub.publish('fruit', new TextEncoder().encode(fruit))
            log(`SEND ${peerIdx} fruit:`, fruit);
        }
        await wait(5);
    }

})().catch(console.error)
    .finally(() => console.log('done'));