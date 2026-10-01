import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

// Quick hash function using WebCrypto API
async function hashPassword(password: string) {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

app.post('/api/signup', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) return c.json({ error: 'Missing fields' }, 400)

  const hashedPassword = await hashPassword(password)
  const id = crypto.randomUUID()

  try {
    // Create user table if not exists (in a real app, use migrations!)
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )
    `).run()

    await c.env.DB.prepare(
      "INSERT INTO users (id, email, password) VALUES (?, ?, ?)"
    ).bind(id, email, hashedPassword).run()

    return c.json({ user: { id, email } })
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) {
      return c.json({ error: 'Email already exists' }, 400)
    }
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/login', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) return c.json({ error: 'Missing fields' }, 400)

  try {
    const hashedPassword = await hashPassword(password)
    
    // Check if table exists
    const user = await c.env.DB.prepare(
      "SELECT id, email FROM users WHERE email = ? AND password = ?"
    ).bind(email, hashedPassword).first()

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    return c.json({ user })
  } catch (e: any) {
    return c.json({ error: 'User not found or DB error' }, 500)
  }
})

export default app
