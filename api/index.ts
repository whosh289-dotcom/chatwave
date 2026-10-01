import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  ASSETS: { fetch: typeof fetch }
  RESEND_API_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

async function hashPassword(password: string) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendEmail(env: Bindings, to: string, subject: string, body: string) {
  if (!env.RESEND_API_KEY) {
    console.log(`[MOCK EMAIL SENT TO ${to}] Subject: ${subject}`);
    console.log(`Body:\n${body}`);
    return;
  }
  
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to,
      subject,
      html: body
    })
  });

  if (!res.ok) {
    console.error("Resend Error:", await res.text());
  }
}

app.post('/api/signup', async (c) => {
  const { username, password, securityQuestion, securityAnswer } = await c.req.json();
  if (!username || !password || !securityQuestion || !securityAnswer) {
    return c.json({ error: 'Missing fields' }, 400);
  }

  const hashedPassword = await hashPassword(password);
  const hashedAnswer = await hashPassword(securityAnswer.toLowerCase().trim());
  const id = crypto.randomUUID();
  const profileId = crypto.randomUUID();

  try {
    // Ensure tables exist (fallback)
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        security_question TEXT NOT NULL,
        security_answer TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        display_name TEXT,
        username TEXT UNIQUE,
        avatar_url TEXT,
        bio TEXT,
        phone TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Insert user
    await c.env.DB.prepare(
      "INSERT INTO users (id, username, password, security_question, security_answer) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, username.toLowerCase(), hashedPassword, securityQuestion, hashedAnswer).run();

    // Insert profile
    await c.env.DB.prepare(
      "INSERT INTO profiles (id, user_id, display_name, username) VALUES (?, ?, ?, ?)"
    ).bind(profileId, id, username, username.toLowerCase()).run();

    return c.json({ user: { id, username } }, 200);
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) {
      return c.json({ error: 'Username already exists' }, 400);
    }
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json();
  if (!username || !password) return c.json({ error: 'Missing fields' }, 400);

  try {
    const hashedPassword = await hashPassword(password);
    
    const user: any = await c.env.DB.prepare(
      "SELECT id, username FROM users WHERE username = ? AND password = ?"
    ).bind(username.toLowerCase(), hashedPassword).first();

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    return c.json({ user: { id: user.id, username: user.username } }, 200);
  } catch (e: any) {
    return c.json({ error: 'DB error: ' + e.message }, 500);
  }
});

app.post('/api/forgot-password', async (c) => {
  const { username } = await c.req.json();
  if (!username) return c.json({ error: 'Missing username' }, 400);

  try {
    const user: any = await c.env.DB.prepare(
      "SELECT security_question FROM users WHERE username = ?"
    ).bind(username.toLowerCase()).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ securityQuestion: user.security_question }, 200);
  } catch (e: any) {
    return c.json({ error: 'Database error' }, 500);
  }
});

app.post('/api/reset-password', async (c) => {
  const { username, securityAnswer, newPassword } = await c.req.json();
  if (!username || !securityAnswer || !newPassword) return c.json({ error: 'Missing fields' }, 400);

  try {
    const hashedAnswer = await hashPassword(securityAnswer.toLowerCase().trim());
    
    const user: any = await c.env.DB.prepare(
      "SELECT id FROM users WHERE username = ? AND security_answer = ?"
    ).bind(username.toLowerCase(), hashedAnswer).first();

    if (!user) {
      return c.json({ error: 'Incorrect security answer' }, 400);
    }

    const hashedPassword = await hashPassword(newPassword);

    await c.env.DB.prepare(
      "UPDATE users SET password = ? WHERE id = ?"
    ).bind(hashedPassword, user.id).run();

    return c.json({ success: true }, 200);
  } catch (e: any) {
    return c.json({ error: 'Database error' }, 500);
  }
});

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }
    
    // Fallback to static assets
    let response = await env.ASSETS.fetch(request);
    
    // If asset not found (like /auth SPA route), return index.html
    if (response.status === 404 || response.status === 403) {
      const indexUrl = new URL('/', request.url);
      response = await env.ASSETS.fetch(new Request(indexUrl));
    }
    
    return response;
  }
}
