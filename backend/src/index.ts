import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

app.get('/', (c) => c.text('Chatwave API works!'))

// Example endpoint to get profiles
app.get('/profiles', async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM profiles").all()
  return c.json(results)
})

export default app
