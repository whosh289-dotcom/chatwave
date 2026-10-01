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
    
    const user = await env.DB.prepare(
      "SELECT id, email FROM users WHERE email = ? AND password = ?"
    ).bind(email, hashedPassword).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ user }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'User not found or DB error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
