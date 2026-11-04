import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { bootstrapDatabase } from './lib/seed';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import patientRoutes from './routes/patients';
import appointmentRoutes from './routes/appointments';
import leadRoutes from './routes/leads';
import campaignRoutes from './routes/campaigns';
import treatmentRoutes from './routes/treatment';
import invoiceRoutes from './routes/invoices';
import collectionRoutes from './routes/collections';
import webhookRoutes from './routes/webhooks';
import dashboardRoutes from './routes/dashboard';
import visitRoutes from './routes/visits';
import reportRoutes from './routes/reports';
import settingsRoutes from './routes/settings';
import scheduleRoutes from './routes/schedule';
import integrationRoutes from './routes/integrations';
import formRoutes, { publicFormsRouter } from './routes/forms';
import { startMetaLeadSyncJob } from './lib/metaSyncJob';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use('/api/public', cors({ origin: true }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || configuredOrigins.length === 0 || configuredOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(
  express.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  })
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'saatci-backend' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'saatci-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/treatment', treatmentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/public/forms', publicFormsRouter);

app.use(errorHandler);

async function start() {
  try {
    await bootstrapDatabase();
  } catch (error) {
    console.error('[bootstrap] başlangıç verisi hazırlanamadı:', error);
  }
  app.listen(PORT, () => {
    console.log(`Saatci CRM Backend running on http://localhost:${PORT}`);
    startMetaLeadSyncJob();
  });
}

start();

export default app;
