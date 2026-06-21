import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Backend API Tests', () => {
  it('GET /health should return 200 OK and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('ts');
  });

  it('GET /api/unknown-route should return 404', async () => {
    const res = await request(app).get('/api/invalid-route');
    expect(res.status).toBe(404);
  });

});
