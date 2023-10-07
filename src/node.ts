import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import {createLibp2p, Libp2p} from 'libp2p'
import { bootstrap } from '@libp2p/bootstrap';
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
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

import dotenv from 'dotenv';
import path from "path";
import {
    createBlockchainTableSql,
    getMaxHeightBlockchainSql,
    getRowBlockchainSql,
    insertBlockchainSql,
} from "./sql";

dotenv.config();
debug.enable('node:*');

// const host = process.env.HOST || '127.0.0.1';
const port = process.env.PORT || '10330';

const bootstrapHosts = process.env.BOOTSTRAP_HOSTS?.split(',') || [];
const bootstrapPorts = process.env.BOOTSTRAP_PORTS?.split(',') || [];
const bootstrapPeers = process.env.BOOTSTRAP_PEERS?.split(',') || [];

const BATCH_SIZE = Number(process.env.BATCH_SIZE || '2');
const DB_LOCATION = process.env.DB_LOCATION || './blockchain.db';

const wait = (s: number) => new Promise((resolve) => setTimeout(resolve, s * 1000));

const bootstrap0 = (libp2p: Libp2p, log: debug.Debugger) => async (nodeId: string) => {
    for await (const bpHost of bootstrapHosts) {
        const idx = bootstrapHosts.indexOf(bpHost);
        const listenerMa = multiaddr(`/ip4/${bpHost}/tcp/${bootstrapPorts[idx]}/p2p/${bootstrapPeers[idx]}`);
        const bootstrapNode = await createFromJSON({ id: bootstrapPeers[idx] })
        await libp2p.peerStore.patch(bootstrapNode, {multiaddrs: [listenerMa]});
        const conn = await libp2p.dial(bootstrapNode);
        log('CONN', nodeId, '<->', 'bootstrap', bootstrapPeers[idx]);
    }
}

const connect = (libp2p: Libp2p, log: debug.Debugger) => async (nodeId: string, peerId: string) => {
    // const listenerMa = multiaddr(`/ip4/${bpHost}/tcp/${bootstrapPorts[idx]}/p2p/${bootstrapPeers[idx]}`);
    const newNode = await createFromJSON({ id: peerId })
    await libp2p.peerStore.patch(newNode,
        {
            // multiaddrs: [newNode.multiaddrs[0]]
        }
    );
    const conn = await libp2p.dial(newNode);
    log('CONN', nodeId, '<->', 'discovered', peerId);
}

// app entry point
(async () => {
    
    const [peerIdx] = process.argv.slice(2)

    const log = debug('node:' + peerIdx);
    const error = debug('node:error:' + peerIdx);

    // console.log(host, port, bootstrapHosts, bootstrapPorts);

    const jsonString = await fs.readFile(path.resolve('.',`peer.json`), 'utf-8');
    const { id: peerId, privKey, pubKey } = JSON.parse(jsonString);

    const wanted = new Set<number>();

    const PEER_COUNT = 6;

    const options = {
        // add options
    }

    /*
    const processIds = async (json: string) => {
        const data = await db.all(selectTestSql);
        const ids = data.map(_ => _.id).map(Number)
        const offer = JSON.parse(json);
        const diff = offer.filter((id: number) => !ids.includes(id));
        if (diff.length > 0) {
            log(`DIFF ${peerIdx} ids:`, diff);
            const get = diff.slice(0, BATCH_SIZE);
            libp2p.services.pubsub.publish('get', new TextEncoder().encode(JSON.stringify(get)));
            // log(`SEND ${peerIdx} get:`, get);
        }
    }
     */

    const processGet = async (json: string) => {
        const get = JSON.parse(json);
        try {
            const data1 = await db.all(getRowBlockchainSql, Number(get[0]));
            libp2p.services.pubsub.publish('data', new TextEncoder().encode(JSON.stringify(data1)));
            // log(`SEND ${peerIdx} data:`, get);
        } catch (e: any) {
            // error('ERR', peerIdx, e.message);
        }
    }

    const processBlockHeight = async (json: string) => {
        const blockHeight = JSON.parse(json);
        try {
            const [ { max_height = 0 } = {} ] = await db.all(getMaxHeightBlockchainSql);
            if (blockHeight > max_height) {
                const delta = Math.min(blockHeight - max_height, BATCH_SIZE);
                // if (wanted.size < BATCH_SIZE) {
                    const want = Array.from({length: delta}, (_, i) => max_height + i + 1)
                        .filter((id: number) => !wanted.has(id));
                    if (want.length > 0) {
                        log('WANT block_id(s)', want);
                        want.forEach(w => wanted.add(w));
                        libp2p.services.pubsub.publish('get', new TextEncoder().encode(JSON.stringify(want)));
                    }
                // }
            } else {
                // log('CURR');
            }
            // log(`SEND ${peerIdx} data:`, get);
        } catch (e: any) {
            // error('ERR', peerIdx, e.message);
        }
    }

    const processData = async (json: string) => {
        const rows = JSON.parse(json);
        const relevant = rows
            .filter((row: any) => wanted.has(row.id))
            .map((row: any) => `block_id: ${row.id} merkle_root: ${row.merkle_root.slice(0, 6)}`)
            .join(', ');
        if (relevant.length > 0) {
            log('DATA', relevant);
        }
        for await (const row of rows) {
            if (wanted.has(row.id)) {
                await db.run(
                    insertBlockchainSql,
                    row.id,
                    row.timestamp,
                    row.prev_hash,
                    row.merkle_root,
                    row.records_json,
                    row.block_hash
                );
                wanted.delete(row.id);
            }
        }
    }

    const processPeers = async (json: string) => {
        const peersAvailable = JSON.parse(json);
        const peersExisting = libp2p.services.pubsub.getPeers();
        if (peersExisting.length < PEER_COUNT) {
            const id = Math.floor(Math.random() * peersAvailable.length);
            if (!peersExisting.includes(peersAvailable[id])) {
                // log('PEER', peerIdx, 'connecting to', peersAvailable[id]);
                // await connect(libp2p, log)(peerId, peersAvailable[id]);
            }
        }
    }

    const onMessage = async (message: CustomEvent<any>) => {
        const json = new TextDecoder().decode(message.detail.data);
        // log(`RECV ${peerIdx} ${message.detail.topic}:`, json);
        switch (message.detail.topic) {
            case 'ids':
                // check if we have the data ids and calc the diff
                // await processIds(json);
                break;
            case 'get':
                // see if we have the requested data and send it
                await processGet(json);
                break;
            case 'data':
                // see if we need the data and save it
                await processData(json);
                break;
            case 'block_height':
                // see if we need the data and save it
                await processBlockHeight(json);
                break;
            case 'peers':
                // see if we need the data and save it
                await processPeers(json);
                break;
        }
    }

    const subscribeToTopics = (topics: string[]) => {
        for (const topic of topics) {
            libp2p.services.pubsub.subscribe(topic)
        }
    }

    // Node logic
    const libp2p = await createLibp2p({
        peerId: await createFromJSON({ id: peerId, privKey, pubKey }),
        addresses: {
            listen: [`/ip4/0.0.0.0/tcp/${port}`]
        },
        peerDiscovery: (peerIdx !== '100') ? [
            bootstrap({
                list: bootstrapPeers.map((peer, idx) =>
                    `/ip4/${bootstrapHosts[idx]}/tcp/${bootstrapPorts[idx]}/p2p/${peer}`
                )
            })
        ] : undefined,
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
            pubsub: floodsub(),
            // pubsub: gossipsub(options),
            identify: identifyService()
        }
    });

    await wait(2);

    try {
        if (bootstrapHosts.length > 0) {
            // await bootstrap0(libp2p, log)(peerId);
        }
        // await connect(libp2p, log)(peerId, peerIdx, peerIds);
    } catch (e: any) {
        error('ERR', peerIdx, e.message);
        await wait(1);
        if (bootstrapHosts.length > 0) {
            // await bootstrap0(libp2p, log)(peerId);
        }
        // await connect(libp2p, log)(peerId, peerIdx, peerIds);
    }

    await wait(1);
    const db = await open({
        filename: path.resolve(DB_LOCATION),
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
    });

    try {
        libp2p.services.pubsub.addEventListener('message', onMessage);
    } catch (e: any) {
        // error('ERR', peerIdx, e.message);
        await wait(0.5);
        libp2p.services.pubsub.addEventListener('message', onMessage);
    }

    try {
        subscribeToTopics(['ids', 'get', 'data', 'block_height', 'peers']);
    } catch (e: any) {
        error('ERR', peerIdx, e.message);
        await wait(1);
        subscribeToTopics(['ids', 'get', 'data', 'block_height', 'peers']);
    }

    // if (peerIdx === '0') {
        setInterval(async () => {
            const peers = libp2p.services.pubsub.getPeers();
            // const subs = libp2p.services.pubsub.getSubscribers('ids');
            log('PSUB', peerIdx, peers);
            libp2p.services.pubsub.publish('peers', new TextEncoder().encode(JSON.stringify(peers)));
        }, 10_000);
    // }

    try {
        const [ { max_height = 0 } = {} ] = await db.all(getMaxHeightBlockchainSql);
        log('HGHT', max_height);
    } catch (e: any) {
        // error('ERR', peerIdx, e.message);
        if (e.message.includes('no such table')) {
            await db.exec(createBlockchainTableSql);

            const [ { max_height = 0 } = {} ] = await db.all(getMaxHeightBlockchainSql);
            log('HGHT', max_height);
        }
    }

    while (true) {
        // log('INFO', peerIdx, 'peers', await libp2p.peerStore.all().then(_ => _.length));

        try {
            const [ { max_height = 0 } = {} ] = await db.all(getMaxHeightBlockchainSql);
            libp2p.services.pubsub.publish(
                'block_height',
                new TextEncoder().encode(JSON.stringify(max_height))
            );
            // log(`SEND ${peerIdx} ids:`, ids);
        } catch (e: any) {
            // error('ERR', peerIdx, e.message);
            if (e.message.includes('no such table')) {
                await db.exec(createBlockchainTableSql);
            }
        }

        await wait(0.5);
    }

})().catch(console.error)
    .finally(() => console.log('done'));