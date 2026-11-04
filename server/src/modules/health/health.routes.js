import { Router } from 'express';
import { queryOne } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

// Liveness: the process is up. Cheap, no dependencies.
router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Readiness: dependencies work. Use this for load balancer / orchestrator checks.
router.get('/health/ready', asyncHandler(async (_req, res) => {
  const checks = { database: false, taxRules: false };
  try {
    await queryOne('SELECT 1 AS ok');
    checks.database = true;
    checks.taxRules = Number((await queryOne('SELECT COUNT(*) AS total FROM tax_rulesets WHERE is_active = 1')).total) > 0;
  } catch {
    // reported through `checks` below
  }
  const ready = Object.values(checks).every(Boolean);
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'degraded', checks });
}));

export default router;
