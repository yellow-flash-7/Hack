import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/src/app.js';
import { connectDB, prisma } from '../../server/src/config/db.js';

describe('ELOV Integration Tests: REST API Endpoints', () => {
  const app = createApp();

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/health returns healthy system status and PostgreSQL engine', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('HEALTHY');
    expect(res.body.database.status).toBe('CONNECTED');
    expect(res.body.database.engine).toContain('PostgreSQL');
  });

  it('GET /api/documents returns verified document library', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/stats returns verified dashboard metrics', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalClaims).toBeGreaterThan(0);
    expect(res.body.data.totalDocuments).toBeGreaterThan(0);
  });

  it('POST /api/verification-runs executes full verification pipeline', async () => {
    const res = await request(app)
      .post('/api/verification-runs')
      .send({
        title: 'API Integration Test Run',
        rawAnswer: 'Global solar capacity grew by 32% in 2023 [Clean_Energy_Transition_Report_2024.pdf, p. 1].',
        mode: 'BALANCED',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.run).toBeDefined();
    expect(res.body.data.report).toBeDefined();
    expect(res.body.data.report.overallVerdict).toBe('VERIFIED');
  });

  it('GET /api/reviews returns review queue tasks', async () => {
    const res = await request(app).get('/api/reviews');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
