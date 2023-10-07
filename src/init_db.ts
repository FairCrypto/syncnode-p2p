import * as path from "path";

import dotenv from 'dotenv';
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import {createBlockchainTableSql, getMaxHeightBlockchainSql} from "./sql";

dotenv.config();

(async () => {

    const db = await open({
        // filename: path.resolve('.', '.peers', '0', 'test.db'),
        filename: path.resolve('.', '.peers', '0', 'blockchain.db'),
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
    });
    // await db.exec(createTestTableSql);
    // console.log('data table created/exists');
    await db.exec(createBlockchainTableSql);
    console.log('blockchain table created/checked');

    const [ { max_height = 0 } = {} ] = await db.all(getMaxHeightBlockchainSql);
    console.log('max_height', max_height);

    await db.close();

})().catch(console.error)