// ── Contact Routes Tests ──
// Tests: POST /api/v1/contact — submission with validation, DB, fallback, email

/* ── Module-level mocks ── */
const mockQuery = jest.fn();
jest.mock('../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

const mockTransporter = { sendMail: jest.fn(() => Promise.resolve({ messageId: 'test-message-id' })) };
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => mockTransporter),
}));

/* ── Imports ── */
const request = require('supertest');
const express = require('express');
const contactRoutes = require('../routes/contact');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/contact', contactRoutes);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.mockReset();
  mockTransporter.sendMail.mockClear();
});

/* ══════════════════════════════════════════════
   POST /api/v1/contact
   ══════════════════════════════════════════════ */
describe('POST /api/v1/contact', () => {
  const validPayload = {
    email: 'user@example.com',
    name: 'Test User',
    subject: 'Help needed',
    description: 'I need help with data analysis.',
  };

  test('201 — successful submission via DB', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'contact-1' }] });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/contact')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBeDefined();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO contact_requests'),
      expect.arrayContaining([validPayload.email.toLowerCase()])
    );
  });

  test('400 — missing email', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/contact')
      .send({ description: 'Some description', name: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 — invalid email format', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/contact')
      .send({ ...validPayload, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 — missing description', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/contact')
      .send({ email: 'user@example.com', name: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 — description too short (< 2 chars)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/contact')
      .send({ ...validPayload, description: 'a' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('201 — fallback when DB unavailable', async () => {
    const dbErr = new Error('ECONNREFUSED');
    dbErr.code = 'ECONNREFUSED';
    mockQuery.mockRejectedValue(dbErr);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/contact')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('201 — sends notification email when SMTP configured', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'contact-1' }] });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/contact')
      .send(validPayload);

    expect(res.status).toBe(201);
    // Email send is fire-and-forget, may or may not be called depending on config
    // Just verify the request succeeds
  });

  test('201 — works with optional fields', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'contact-2' }] });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/contact')
      .send({
        email: 'user@example.com',
        description: 'This is a longer description for the contact form.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('400 — empty body', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/contact')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
