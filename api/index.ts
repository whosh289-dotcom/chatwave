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
  
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Chatwave <noreply@yourdomain.com>',
      to,
      subject,
      html: body
    })
  });
}

app.post('/api/signup', async (c) => {
  const { email, password, username } = await c.req.json();
  if (!email || !password || !username) return c.json({ error: 'Missing fields' }, 400);

  const hashedPassword = await hashPassword(password);
  const id = crypto.randomUUID();
  const profileId = crypto.randomUUID();
  const token = crypto.randomUUID();

  try {
    // Ensure tables exist
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email_confirmed BOOLEAN NOT NULL DEFAULT 0,
        confirmation_token TEXT,
        reset_token TEXT,
        reset_token_expires DATETIME,
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
      "INSERT INTO users (id, email, password, email_confirmed, confirmation_token) VALUES (?, ?, ?, 0, ?)"
    ).bind(id, email, hashedPassword, token).run();

    // Insert profile with username
    await c.env.DB.prepare(
      "INSERT INTO profiles (id, user_id, display_name, username) VALUES (?, ?, ?, ?)"
    ).bind(profileId, id, username, username.toLowerCase()).run();

    const url = new URL(c.req.url);
    const confirmLink = `${url.origin}/auth?type=confirm&token=${token}`;
    
    await sendEmail(
      c.env, 
      email, 
      "Confirm your Chatwave account", 
      `Click here to confirm your email: <a href="${confirmLink}">${confirmLink}</a>`
    );

    return c.json({ user: { id, email, username } }, 200);
  } catch (e: any) {
    if (e.message.includes('UNIQUE') && e.message.includes('users')) {
      return c.json({ error: 'Email already exists' }, 400);
    }
    if (e.message.includes('UNIQUE') && e.message.includes('profiles')) {
      return c.json({ error: 'Username already taken' }, 400);
    }
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/confirm', async (c) => {
  const { token } = await c.req.json();
  if (!token) return c.json({ error: 'Missing token' }, 400);

  const res = await c.env.DB.prepare(
    "UPDATE users SET email_confirmed = 1, confirmation_token = NULL WHERE confirmation_token = ?"
  ).bind(token).run();

  if (res.meta.changes === 0) {
    return c.json({ error: 'Invalid or expired confirmation token' }, 400);
  }

  return c.json({ success: true }, 200);
});

app.post('/api/login', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: 'Missing fields' }, 400);

  try {
    const hashedPassword = await hashPassword(password);
    
    // Check if columns exist by selecting them (in case migration didn't run on an old db)
    // We will just try to fetch them. If email_confirmed doesn't exist, we assume they are confirmed (legacy).
    let user;
    try {
      user = await c.env.DB.prepare(
        "SELECT id, email, email_confirmed FROM users WHERE email = ? AND password = ?"
      ).bind(email, hashedPassword).first();
      
      if (user && user.email_confirmed === 0) {
        return c.json({ error: 'Please check your email and confirm your account before logging in.' }, 403);
      }
    } catch (err) {
      // legacy fallback if column doesn't exist
      user = await c.env.DB.prepare(
        "SELECT id, email FROM users WHERE email = ? AND password = ?"
      ).bind(email, hashedPassword).first();
    }

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    return c.json({ user: { id: user.id, email: user.email } }, 200);
  } catch (e: any) {
    return c.json({ error: 'DB error: ' + e.message }, 500);
  }
});

app.post('/api/forgot-password', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: 'Missing email' }, 400);

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1 hour

  try {
    const res = await c.env.DB.prepare(
      "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?"
    ).bind(token, expires, email).run();

    if (res.meta.changes > 0) {
      const url = new URL(c.req.url);
      const resetLink = `${url.origin}/auth?type=reset&token=${token}`;
      
      await sendEmail(
        c.env, 
        email, 
        "Reset your Chatwave password", 
        `Click here to reset your password: <a href="${resetLink}">${resetLink}</a>`
      );
    }

    // Always return success to prevent email enumeration
    return c.json({ success: true }, 200);
  } catch (e: any) {
    return c.json({ error: 'Database error' }, 500);
  }
});

app.post('/api/reset-password', async (c) => {
  const { token, password } = await c.req.json();
  if (!token || !password) return c.json({ error: 'Missing fields' }, 400);

  try {
    const user: any = await c.env.DB.prepare(
      "SELECT id, reset_token_expires FROM users WHERE reset_token = ?"
    ).bind(token).first();

    if (!user || new Date(user.reset_token_expires) < new Date()) {
      return c.json({ error: 'Invalid or expired reset token' }, 400);
    }

    const hashedPassword = await hashPassword(password);

    await c.env.DB.prepare(
      "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?"
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
    return env.ASSETS.fetch(request);
  }
}
