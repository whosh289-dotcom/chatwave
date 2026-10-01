async function hashPassword(password: string) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context: any) {
  const { request, env } = context;
  try {
    const { email, password } = await request.json();
    if (!email || !password) return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });

    const hashedPassword = await hashPassword(password);
    const id = crypto.randomUUID();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await env.DB.prepare(
      "INSERT INTO users (id, email, password) VALUES (?, ?, ?)"
    ).bind(id, email, hashedPassword).run();

    return new Response(JSON.stringify({ user: { id, email } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) {
      return new Response(JSON.stringify({ error: 'Email already exists' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
