import assert from 'node:assert/strict';
import net from 'node:net';
import { after, describe, it } from 'node:test';
import { decryptBytes, encryptBytes } from '../src/utils/crypto.js';
import { scanBuffer } from '../src/utils/malwareScan.js';

const EICAR = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

describe('file encryption at rest', () => {
  const plain = Buffer.from('date,narration,amount\n2026-04-01,SALARY ACME,85000');

  it('round-trips and never stores readable content', () => {
    const stored = encryptBytes(plain);
    assert.ok(!stored.includes('SALARY'));
    assert.deepEqual(decryptBytes(stored), plain);
  });

  it('uses a fresh IV every time', () => {
    assert.notDeepEqual(encryptBytes(plain), encryptBytes(plain));
  });

  it('detects tampering', () => {
    const stored = encryptBytes(plain);
    stored[stored.length - 1] ^= 0xff;
    assert.throws(() => decryptBytes(stored));
  });

  it('still opens files stored before encryption existed', () => {
    assert.deepEqual(decryptBytes(plain), plain);
  });
});

// Minimal clamd: reads an INSTREAM until the zero-length chunk, then replies.
const startFakeClamd = () =>
  new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let received = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        received = Buffer.concat([received, chunk]);
        if (received.subarray(-4).equals(Buffer.alloc(4))) {
          socket.end(received.includes('VIRUS') ? 'stream: Fake.Virus FOUND\0' : 'stream: OK\0');
        }
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });

describe('malware scanning', () => {
  const servers = [];
  after(() => servers.forEach((s) => s.close()));

  it('flags the EICAR test string even with no scanner configured', async () => {
    const result = await scanBuffer(EICAR, { provider: 'none' });
    assert.equal(result.clean, false);
  });

  it('passes ordinary files when no scanner is configured', async () => {
    assert.equal((await scanBuffer(Buffer.from('hello'), { provider: 'none' })).clean, true);
  });

  it('speaks the clamd INSTREAM protocol for clean and infected files', async () => {
    const server = await startFakeClamd();
    servers.push(server);
    const config = { provider: 'clamav', host: '127.0.0.1', port: server.address().port, failClosed: true };

    assert.equal((await scanBuffer(Buffer.from('a harmless statement'), config)).clean, true);
    const infected = await scanBuffer(Buffer.from('xx VIRUS xx'), config);
    assert.equal(infected.clean, false);
    assert.equal(infected.signature, 'Fake.Virus');
  });

  it('streams large files in chunks', async () => {
    const server = await startFakeClamd();
    servers.push(server);
    const config = { provider: 'clamav', host: '127.0.0.1', port: server.address().port, failClosed: true };
    assert.equal((await scanBuffer(Buffer.alloc(300_000, 97), config)).clean, true);
  });

  it('fails closed when the scanner is unreachable', async () => {
    const config = { provider: 'clamav', host: '127.0.0.1', port: 1, failClosed: true };
    await assert.rejects(scanBuffer(Buffer.from('x'), config), { code: 'SCAN_UNAVAILABLE', status: 503 });
  });

  it('can be configured to fail open', async () => {
    const config = { provider: 'clamav', host: '127.0.0.1', port: 1, failClosed: false };
    const result = await scanBuffer(Buffer.from('x'), config);
    assert.equal(result.clean, true);
    assert.equal(result.skipped, true);
  });
});
