// Import necessary modules
const { NextRequest, NextResponse } = require('next/server');
const middleware = require('../src/middleware');

// Mock logger to avoid actual logging during tests
jest.mock('../src/lib/logger', () => ({
  debug: jest.fn(),
}));

describe('Middleware Authentication Tests', () => {
  test('should bypass authentication for /events endpoint', async () => {
    const req = new NextRequest('http://localhost/events');
    const res = await middleware(req);
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).not.toBe(401); // Ensure not unauthorized
  });

  test('should enforce authentication for protected routes', async () => {
    const req = new NextRequest('http://localhost/api/user');
    const res = await middleware(req);
    expect(res.status).toBe(401); // Expect unauthorized for protected route
  });
});