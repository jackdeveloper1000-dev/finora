import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  dateStrings: true,
  timezone: 'Z',
});

export const query = async (sql, params = {}) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

export const queryOne = async (sql, params = {}) => (await query(sql, params))[0] ?? null;

export const transaction = async (work) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const run = async (sql, params = {}) => (await conn.execute(sql, params))[0];
    const result = await work(run);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// Table/column names must be code constants; only values are parameterized.
export const bulkInsert = async (run, table, columns, rows, { ignore = false, chunkSize = 200 } = {}) => {
  let affected = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const params = {};
    const values = rows
      .slice(i, i + chunkSize)
      .map((row, r) => `(${columns.map((col, c) => { params[`p${r}_${c}`] = row[col] ?? null; return `:p${r}_${c}`; }).join(',')})`)
      .join(',');
    const result = await run(`INSERT ${ignore ? 'IGNORE ' : ''}INTO ${table} (${columns.join(',')}) VALUES ${values}`, params);
    affected += result.affectedRows;
  }
  return affected;
};

pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));
