// Integration tests never send real email: messages stay in the in-memory outbox.
import { env } from '../../src/config/env.js';

env.mail.transport = 'log';
