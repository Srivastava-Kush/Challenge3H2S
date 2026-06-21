import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Health endpoint
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns 200 OK with status "ok"', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('includes a timestamp in ISO format', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('ts');
    expect(() => new Date(res.body.ts)).not.toThrow();
    expect(new Date(res.body.ts).toISOString()).toBe(res.body.ts);
  });

  it('returns JSON content-type', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 404 catch-all
// ─────────────────────────────────────────────────────────────────────────────
describe('Unknown routes', () => {
  it('GET /api/invalid-route returns 404', async () => {
    const res = await request(app).get('/api/invalid-route');
    expect(res.status).toBe(404);
  });

  it('GET /nonexistent returns 404', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
  });

  it('POST /api/unknown returns 404', async () => {
    const res = await request(app).post('/api/unknown').send({});
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Authentication security contracts — protected routes MUST reject unauthenticated requests
// ─────────────────────────────────────────────────────────────────────────────
describe('Auth security contracts (401 enforcement)', () => {
  it('GET /api/auth/profile without token returns 401', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/auth/profile without token returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/profile')
      .send({ displayName: 'Test User' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/history without token returns 401', async () => {
    const res = await request(app).get('/api/history');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/history without token returns 401', async () => {
    const res = await request(app)
      .post('/api/history')
      .send({ date: '2026-06', type: 'monthly', total: 120 });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('DELETE /api/history without token returns 401', async () => {
    const res = await request(app).delete('/api/history');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/ai/coach without token returns 401', async () => {
    const res = await request(app)
      .post('/api/ai/coach')
      .send({ emissions: { total: 120 } });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/ai/challenges without token returns 401', async () => {
    const res = await request(app)
      .post('/api/ai/challenges')
      .send({ emissions: { total: 120 } });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('401 response includes an error message string', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Input validation — history route
// ─────────────────────────────────────────────────────────────────────────────
describe('Input validation (history route)', () => {
  it('POST /api/history with invalid token returns 401, not 500', async () => {
    const res = await request(app)
      .post('/api/history')
      .set('Authorization', 'Bearer invalid-token-xyz')
      .send({ date: '2026-06', type: 'monthly', total: 120 });
    // Should be rejected at auth level — never reaches route logic
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Security headers (Helmet)
// ─────────────────────────────────────────────────────────────────────────────
describe('Security headers', () => {
  it('response includes X-Content-Type-Options header from Helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('response includes X-Frame-Options header from Helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});
