import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  ASSETS: { fetch: typeof fetch }
}

const app = new Hono<{ Bindings: Bindings }>()

async function hashPassword(password: string) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

app.post('/api/signup', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: 'Missing fields' }, 400);

  const hashedPassword = await hashPassword(password);
  const id = crypto.randomUUID();

  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await c.env.DB.prepare(
      "INSERT INTO users (id, email, password) VALUES (?, ?, ?)"
    ).bind(id, email, hashedPassword).run();

    return c.json({ user: { id, email } }, 200);
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) {
      return c.json({ error: 'Email already exists' }, 400);
    }
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/login', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: 'Missing fields' }, 400);

  try {
    const hashedPassword = await hashPassword(password);
    
    const user = await c.env.DB.prepare(
      "SELECT id, email FROM users WHERE email = ? AND password = ?"
    ).bind(email, hashedPassword).first();

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    return c.json({ user }, 200);
  } catch (e: any) {
    return c.json({ error: 'User not found or DB error' }, 500);
  }
});

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }
    // Fallback to static assets
    return env.ASSETS.fetch(request);
  }
}
