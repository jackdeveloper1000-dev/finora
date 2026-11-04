import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { base32Decode, base32Encode, generateSecret, otpauthUrl, totpCode, verifyTotp } from '../src/utils/totp.js';

// RFC 6238 Appendix B: secret is the ASCII string "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('base32', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 7, 8, 9]);
    assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
  });

  it('matches the known encoding of the RFC test secret', () => {
    assert.equal(RFC_SECRET, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });
});

describe('totp', () => {
  it('matches the RFC 6238 test vectors (8 digits)', () => {
    assert.equal(totpCode(RFC_SECRET, 59_000, 8), '94287082');
    assert.equal(totpCode(RFC_SECRET, 1_111_111_109_000, 8), '07081804');
    assert.equal(totpCode(RFC_SECRET, 1_234_567_890_000, 8), '89005924');
  });

  it('produces the 6-digit form of the same value', () => {
    assert.equal(totpCode(RFC_SECRET, 59_000), '287082');
  });

  it('verifies the current code and one step either side, but not further', () => {
    const now = 1_700_000_000_000;
    const code = totpCode(RFC_SECRET, now);
    assert.equal(verifyTotp(RFC_SECRET, code, now), true);
    assert.equal(verifyTotp(RFC_SECRET, code, now + 30_000), true);
    assert.equal(verifyTotp(RFC_SECRET, code, now + 90_000), false);
  });

  it('rejects malformed input', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', null, undefined]) assert.equal(verifyTotp(RFC_SECRET, bad), false);
  });

  it('generates distinct secrets and a scannable URL', () => {
    assert.notEqual(generateSecret(), generateSecret());
    assert.match(otpauthUrl({ secret: 'ABC', account: 'a@b.com' }), /^otpauth:\/\/totp\/Finora:a%40b\.com\?secret=ABC&issuer=Finora/);
  });
});
