import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { env } from './env.js';

const schemaPath = new URL('../../../schema.sql', import.meta.url);

const conn = await mysql.createConnection({ ...env.db, database: undefined, multipleStatements: true });
await conn.query((await readFile(schemaPath, 'utf8')).replace(/^﻿/, ''));
await conn.end();
console.log(`Database "${env.db.database}" is ready.`);
