process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "memory://";
process.env.SESSION_SECRET = "test-marrakech-super-secret-key-32chars!";
process.env.ADMIN_PASSWORD = "MarrakechAdmin2026!";
process.env.ADMIN_USERNAME = "presenter";
process.env.PORT = "0";

await import("./integration.test");
