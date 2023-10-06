import * as path from "path";

import dotenv from 'dotenv';
import sqlite3 from 'sqlite3'
import {Database, open} from 'sqlite'

dotenv.config();

let db: Database<sqlite3.Database>;

const blockchainSyncUrl = process.env.BLOCKCHAIN_SYNC_URL || 'http://xenminer.mooo.com:4447/getallblocks2';
const blockchainHeightUrl = process.env.BLOCKCHAIN_HEIGHT_URL || 'http://xenminer.mooo.com:4447/total_blocks';

(async () => {

    db = await open({
        filename: path.resolve('.', '.peers', '0', 'blockchain.db'),
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
    });

    const [ { height = 0 } = {} ] = await db.all('SELECT height FROM sys;');
    console.log('local height', height);
    let localHeight = height;
    const globalHeight = await fetch(blockchainHeightUrl);
    const { total_blocks } = await globalHeight.json();
    console.log('remote height', total_blocks);

    while (localHeight < total_blocks) {
        const res = await fetch(`${blockchainSyncUrl}/${localHeight + 1}`);
        const blocks = await res.json();
        // console.log('blocks', blocks.length);
        for (const block of blocks) {
            console.log('block', block);
            const { timestamp, prev_hash, merkle_root, records_json, block_hash } = block;
            process.exit(0);
            await db.run(`
                INSERT INTO blockchain (
                    timestamp,
                    prev_hash,
                    merkle_root,
                    records_json,
                    block_hash
                ) VALUES (?, ?, ?, ?, ?);
            `, timestamp, prev_hash, merkle_root, records_json, block_hash);
        }
        localHeight += blocks.length;
        await db.run('UPDATE sys SET height = ?;', localHeight);
        console.log('local height', localHeight);
    }

})().catch(console.error)
    .finally(() => db.close());