// Brings an older Finora database up to date. Safe to run more than once.
// It handles the changes that CREATE TABLE IF NOT EXISTS cannot, then runs the normal schema for new tables.
import mysql from 'mysql2/promise';
import { env } from './env.js';

const conn = await mysql.createConnection({ ...env.db, multipleStatements: false });
const db = env.db.database;
const done = (message) => console.log(`  ${message}`);

const tableExists = async (table) => {
  const [rows] = await conn.query('SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ?', [db, table]);
  return rows.length > 0;
};
const columnExists = async (table, column) => {
  const [rows] = await conn.query('SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?', [db, table, column]);
  return rows.length > 0;
};

console.log(`Updating database "${db}"`);
const hadVerificationTable = await tableExists('email_verifications');

if (await tableExists('users')) {
  if (!(await columnExists('users', 'google_sub'))) {
    await conn.query('ALTER TABLE users ADD COLUMN google_sub VARCHAR(40) NULL UNIQUE AFTER mfa_enabled');
    done('added users.google_sub');
  }
}

// The first expert-review table was a placeholder. Replace it only if nobody has used it.
if ((await tableExists('expert_reviews')) && !(await columnExists('expert_reviews', 'request_note'))) {
  const [[{ total }]] = await conn.query('SELECT COUNT(*) AS total FROM expert_reviews');
  if (Number(total) > 0) {
    console.error('expert_reviews has data in the old format; not touching it. Ask for help before continuing.');
    process.exit(1);
  }
  await conn.query('DROP TABLE expert_reviews');
  done('replaced the old expert_reviews table (it was empty)');
}
await conn.end();

await import('./initDb.js');

// Accounts that existed before email verification was introduced must not be locked out.
if (!hadVerificationTable) {
  const again = await mysql.createConnection({ ...env.db });
  const [result] = await again.query('UPDATE users SET email_verified = 1 WHERE email_verified = 0 AND email IS NOT NULL');
  done(`marked ${result.affectedRows} existing account(s) as verified`);
  await again.end();
}
console.log('Database is up to date.');
