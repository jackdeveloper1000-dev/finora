import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { pool, queryOne, query } from './db.js';

const [email, name, role = 'expert'] = process.argv.slice(2);
if (!email || !name || !['expert', 'admin'].includes(role)) {
  console.error('Usage: npm run user:staff -- <email> "<Full name>" [expert|admin]');
  process.exit(1);
}

const existing = await queryOne('SELECT id FROM users WHERE email = :email', { email });
if (existing) {
  await query('UPDATE users SET role = :role WHERE id = :id', { role, id: existing.id });
  console.log(`${email} is now ${role}. Their password is unchanged.`);
} else {
  const password = randomBytes(9).toString('base64url');
  await query(
    'INSERT INTO users (name, email, password_hash, role, is_verified, email_verified) VALUES (:name, :email, :hash, :role, 1, 1)',
    { name, email, hash: await bcrypt.hash(password, 12), role },
  );
  console.log(`Created ${role} ${email}\nTemporary password: ${password}\nThey must sign in and turn on two-factor sign-in before they can review returns.`);
}
await pool.end();
