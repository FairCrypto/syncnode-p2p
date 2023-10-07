
// TEST TABLE
export const createTestTableSql = 'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);';
export const insertNameTestSql = 'INSERT INTO test (name) VALUES (?) ON CONFLICT DO NOTHING;';
export const selectTestSql = 'SELECT * FROM test;';
export const getRowTestSql = 'SELECT * FROM test WHERE id = ?;';
export const insertTestSql = 'INSERT INTO test (id, name) VALUES (?, ?) ON CONFLICT DO NOTHING;';
export const selectMaxHeightTestSql = 'SELECT MAX(id) as max_height FROM test;';

// BLOCKCHAIN TABLE
export const createBlockchainTableSql = `
        CREATE TABLE IF NOT EXISTS blockchain (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        prev_hash TEXT,
        merkle_root TEXT,
        records_json TEXT,
        block_hash TEXT)
    `;

export const getMaxHeightBlockchainSql = 'SELECT MAX(id) as max_height FROM blockchain;';
export const insertBlockchainSql = `
    INSERT INTO blockchain (id, timestamp, prev_hash, merkle_root, records_json, block_hash)
     VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING;
    `;

export const getRowBlockchainSql = 'SELECT * FROM blockchain WHERE id = ?;';

// SYS TABLE
export const createSysTableSql = `
        CREATE TABLE IF NOT EXISTS sys (
        Lock char(1) not null,
        height INTEGER,
        constraint PK_T1 PRIMARY KEY (Lock),
        constraint CK_T1_Locked CHECK (Lock='X')
    )`;
export const insertSysSql = 'INSERT INTO sys (Lock, height) VALUES ("X",0) ON CONFLICT DO NOTHING;';
export const updateSysSql = 'UPDATE sys SET height = ?;';
export const selectMaxHeightSysSql = 'SELECT height FROM sys;';