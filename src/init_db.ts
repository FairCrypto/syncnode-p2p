import * as path from "path";

import dotenv from 'dotenv';
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

dotenv.config();

const createTestTableSql = 'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);';
const createBlockchainTableSql = `
        CREATE TABLE IF NOT EXISTS blockchain (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        prev_hash TEXT,
        merkle_root TEXT,
        records_json TEXT,
        block_hash TEXT)
    `;
const createSysTableSql = `
        CREATE TABLE IF NOT EXISTS sys (
        Lock char(1) not null,
        height INTEGER,
        constraint PK_T1 PRIMARY KEY (Lock),
        constraint CK_T1_Locked CHECK (Lock='X')
    )`;
const insertTestSql = 'INSERT INTO test (name) VALUES (?) ON CONFLICT DO NOTHING;';
const insertSysSql = 'INSERT INTO sys (Lock, height) VALUES ("X",0) ON CONFLICT DO NOTHING;';


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
    const sys = await db.all('SELECT height FROM sys;');
    console.log('sys', sys);

    // const check = await db.all('SELECT * FROM test WHERE id = ?;', 1);
    // console.log('test check', check);

    await db.close();

})().catch(console.error)