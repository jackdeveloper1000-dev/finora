import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler, requestId } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import accountRoutes from './modules/account/account.routes.js';
import historyRoutes from './modules/history/history.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import { customerRouter as reviewRoutes, expertRouter } from './modules/review/review.routes.js';
import quickRoutes from './modules/quick/quick.routes.js';
import filingRoutes from './modules/filing/filing.routes.js';
import itrRoutes from './modules/itr/itr.routes.js';
import taxRoutes from './modules/tax/tax.routes.js';
import reconciliationRoutes from './modules/reconciliation/reconciliation.routes.js';
import taxFactsRoutes from './modules/taxfacts/taxfacts.routes.js';
import classificationRoutes from './modules/classification/classification.routes.js';
import documentsRoutes from './modules/documents/documents.routes.js';
import ledgerRoutes from './modules/ledger/ledger.routes.js';
import casesRoutes from './modules/cases/cases.routes.js';
import profileRoutes from './modules/profile/profile.routes.js';

const rateLimitResponse = (message) => ({ error: { code: 'RATE_LIMITED', message } });

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 30 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Too many attempts. Please try again later.'),
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 600 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Too many requests. Please slow down.'),
});

const noStore = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(env.isProd ? requestLogger : morgan('dev'));

  app.use('/api', healthRoutes);
  app.use('/api', apiLimiter, noStore);
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/cases', casesRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api', documentsRoutes);
  app.use('/api', ledgerRoutes);
  app.use('/api', classificationRoutes);
  app.use('/api', taxFactsRoutes);
  app.use('/api', reconciliationRoutes);
  app.use('/api', taxRoutes);
  app.use('/api', itrRoutes);
  app.use('/api', filingRoutes);
  app.use('/api', quickRoutes);
  app.use('/api', reviewRoutes);
  app.use('/api/expert', expertRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
