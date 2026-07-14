// ── Email Service Tests ──
// Tests: sendEmail, sendPasswordResetEmail, sendVerificationEmail

/* ── Module-level mocks ── */
const mockSendMail = jest.fn(() => Promise.resolve({ messageId: 'test-msg-id' }));
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: (...args) => mockSendMail(...args),
  })),
}));

jest.mock('../config', () => ({
  email: {
    devMode: true,
    host: 'smtp.test.com',
    port: 587,
    secure: false,
    user: 'test@test.com',
    pass: 'secret',
    from: 'no-reply@insighthub.data',
    frontendUrl: 'http://localhost:3000',
  },
  passwordReset: {
    expiryMinutes: 30,
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sendEmail', () => {
  test('dev mode — returns devMode result without sending', async () => {
    // Re-require with devMode = true
    jest.resetModules();
    jest.mock('../config', () => ({
      email: { devMode: true, from: 'no-reply@insighthub.data', frontendUrl: 'http://localhost:3000' },
      passwordReset: { expiryMinutes: 30 },
    }));
    const { sendEmail } = require('../services/emailService');
    const result = await sendEmail('user@test.com', 'Test Subject', '<p>Hello</p>');
    expect(result.devMode).toBe(true);
    expect(result.to).toBe('user@test.com');
    expect(result.subject).toBe('Test Subject');
  });

  test('transport mode — sends email via nodemailer', async () => {
    jest.resetModules();
    jest.mock('../config', () => ({
      email: {
        devMode: false,
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        user: 'test@test.com',
        pass: 'secret',
        from: 'no-reply@insighthub.data',
        frontendUrl: 'http://localhost:3000',
      },
      passwordReset: { expiryMinutes: 30 },
    }));
    const { sendEmail } = require('../services/emailService');
    const result = await sendEmail('user@test.com', 'Real Subject', '<p>Body</p>');
    expect(result.messageId).toBe('test-msg-id');
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: 'Real Subject',
      })
    );
  });
});

describe('sendPasswordResetEmail', () => {
  test('dev mode — returns devMode result', async () => {
    jest.resetModules();
    jest.mock('../config', () => ({
      email: { devMode: true, from: 'no-reply@insighthub.data', frontendUrl: 'http://localhost:3000' },
      passwordReset: { expiryMinutes: 30 },
    }));
    const { sendPasswordResetEmail } = require('../services/emailService');
    const result = await sendPasswordResetEmail('user@test.com', 'reset-token-123', '张三');
    expect(result.devMode).toBe(true);
    expect(result.to).toBe('user@test.com');
    expect(result.subject).toContain('重置密码');
  });
});

describe('sendVerificationEmail', () => {
  test('dev mode — returns devMode result', async () => {
    jest.resetModules();
    jest.mock('../config', () => ({
      email: { devMode: true, from: 'no-reply@insighthub.data', frontendUrl: 'http://localhost:3000' },
      passwordReset: { expiryMinutes: 30 },
    }));
    const { sendVerificationEmail } = require('../services/emailService');
    const result = await sendVerificationEmail('user@test.com', 'verify-token-456', '李四');
    expect(result.devMode).toBe(true);
    expect(result.to).toBe('user@test.com');
    expect(result.subject).toContain('验证');
  });
});
