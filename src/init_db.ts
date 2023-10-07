import * as path from "path";

import dotenv from 'dotenv';
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import {createBlockchainTableSql, createSysTableSql, insertSysSql, selectMaxHeightSysSql} from "./sql";

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

    await db.exec(createSysTableSql);
    console.log('sys table created/checked');

    // await db.run(insertTestSql, ['test']);
    // await db.run(insertTestSql, ['test2']);
    // await db.run(insertTestSql, ['test3']);
    // const res = await db.all('SELECT * FROM test;');
    // console.log('test data added', res);

    await db.run(insertSysSql);
    const sys = await db.all(selectMaxHeightSysSql);
    console.log('sys', sys);

    // const check = await db.all('SELECT * FROM test WHERE id = ?;', 1);
    // console.log('test check', check);

    await db.close();

})().catch(console.error)