import { Hono } from 'hono'
import { scrapeAndStoreGifs } from '../src/utils/scrapeGifs'
import { fetchAndStoreStickers } from '../src/tasks/fetch-stickers';

type Bindings = {
  DB: D1Database
  ASSETS: { fetch: typeof fetch }
  RESEND_API_KEY?: string
  ADMIN_TOKEN?: string
  BOOST_STATUS?: KVNamespace
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

app.get('/api/users/search', async (c) => {
  const q = c.req.query('q');
  if (!q || q.length < 2) return c.json({ users: [] }, 200);

  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id as user_id, username as display_name, username FROM users WHERE username LIKE ? LIMIT 10"
    ).bind(`%${q}%`).all();

    return c.json({ users: results }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


app.post('/api/users/block', async (c) => {
  const { blockerId, blockedId } = await c.req.json();
  if (!blockerId || !blockedId) return c.json({ error: 'Missing ids' }, 400);

  try {
    await c.env.DB.prepare(
      "INSERT INTO blocked_users (id, blocker_id, blocked_id) VALUES (?, ?, ?)"
    ).bind(crypto.randomUUID(), blockerId, blockedId).run();
    return c.json({ success: true }, 200);
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) return c.json({ success: true }, 200); // Already blocked
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/conversations', async (c) => {
  const { isPrivate, groupName, selectedUserIds, ownerId } = await c.req.json();
  
  const id = crypto.randomUUID();
  try {
    // 1. Create conversation
    await c.env.DB.prepare(
      "INSERT INTO conversations (id, is_private, owner_id, name) VALUES (?, ?, ?, ?)"
    ).bind(id, isPrivate ? 1 : 0, ownerId, groupName || null).run();

    // 2. Add owner
    await c.env.DB.prepare(
      "INSERT INTO conversation_participants (id, conversation_id, user_id, role) VALUES (?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), id, ownerId, 'owner').run();

    // Add all selected users as members immediately
    for (const userId of selectedUserIds) {
      await c.env.DB.prepare(
        "INSERT INTO conversation_participants (id, conversation_id, user_id, role) VALUES (?, ?, ?, ?)"
      ).bind(crypto.randomUUID(), id, userId, 'member').run();
    }

    return c.json({ conversationId: id }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});



app.delete('/api/messages/:id', async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare("DELETE FROM messages WHERE id = ?").bind(id).run();
    return c.json({ success: true }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


app.delete('/api/messages/conversation/:id', async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare("DELETE FROM messages WHERE conversation_id = ?").bind(id).run();
    return c.json({ success: true }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.put('/api/messages/:id', async (c) => {
  const id = c.req.param('id');
  const { content } = await c.req.json();
  try {
    await c.env.DB.prepare("UPDATE messages SET content = ? WHERE id = ?").bind(content, id).run();
    return c.json({ success: true }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/conversations/leave', async (c) => {
  const { conversationId, userId } = await c.req.json();
  if (!conversationId || !userId) return c.json({ error: 'Missing fields' }, 400);

  try {
    await c.env.DB.prepare(
      "DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?"
    ).bind(conversationId, userId).run();
    return c.json({ success: true }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


app.get('/api/stickers', async (c) => {
  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS stickers (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        artist_name TEXT,
        user_id TEXT,
        approved BOOLEAN DEFAULT TRUE
      )
    `).run();

    const userId = c.req.query('userId');
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM stickers WHERE (user_id IS NULL OR user_id = ?) AND (approved = 1 OR approved = TRUE OR approved IS NULL)"
    ).bind(userId || '').all();
    return c.json(results || [], 200);
  } catch (e: any) {
    console.error('Stickers fetch error:', e);
    return c.json([], 200);
  }
});

// Real-time public GIF search from free open public endpoints (Scrapes public Tenor & Wikimedia, zero Giphy)
app.get('/api/gifs/search', async (c) => {
  const query = (c.req.query('q') || 'trending').trim().toLowerCase().replace(/\s+/g, '-');
  
  try {
    // 1. Scrape live from public Tenor search page (Zero Giphy, no API key needed)
    const targetUrl = `https://tenor.com/search/${encodeURIComponent(query)}-gifs`;
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (res.ok) {
      const html = await res.text();
      const regex = /https:\/\/media\.tenor\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.gif/g;
      const matches = Array.from(new Set(html.match(regex) || []));

      if (matches.length > 0) {
        const results = matches.slice(0, 30).map((url, i) => {
          const parts = url.split('/');
          const filename = parts[parts.length - 1].replace('.gif', '').replace(/[-_]+/g, ' ');
          return {
            id: `tenor-${i}-${crypto.randomUUID()}`,
            url,
            artist_name: filename || query
          };
        });
        return c.json(results, 200);
      }
    }
  } catch (err) {
    console.error('Tenor web scrape failed:', err);
  }

  try {
    // 2. Fallback: Wikimedia Commons public animated GIF search
    const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=filemime:image/gif+${encodeURIComponent(query)}&gsrlimit=20&prop=imageinfo&iiprop=url`;
    const res = await fetch(wikiUrl);
    if (res.ok) {
      const data: any = await res.json();
      const pages = Object.values(data?.query?.pages || {});
      const gifs = pages
        .map((p: any) => {
          const info = p?.imageinfo?.[0];
          if (!info?.url) return null;
          const title = (p?.title || '').replace(/^File:/, '').replace(/\.gif$/i, '');
          return {
            id: `wiki-${p?.pageid || crypto.randomUUID()}`,
            url: info.url,
            artist_name: title || 'Wikimedia'
          };
        })
        .filter(Boolean);

      if (gifs.length > 0) {
        return c.json(gifs, 200);
      }
    }
  } catch (err) {
    console.error('Wikimedia GIF search failed:', err);
  }

  return c.json([], 200);
});

app.post('/api/stickers', async (c) => {
  try {
    const { url, artistName, userId } = await c.req.json();
    if (!url || !userId) return c.json({ error: 'Missing fields' }, 400);

    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS stickers (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        artist_name TEXT,
        user_id TEXT,
        approved BOOLEAN DEFAULT TRUE
      )
    `).run();

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO stickers (id, url, artist_name, user_id, approved) VALUES (?, ?, ?, ?, TRUE)"
    ).bind(id, url, artistName || 'Custom Sticker', userId).run();
    return c.json({ success: true, id }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Boost endpoint to scrape GIFs from public sources and add as public stickers
app.post('/api/boost', async (c) => {
  scrapeAndStoreGifs(c.env.DB).catch((err) => console.error('Boost scrape error:', err));
  return c.json({ message: 'Boost started, scraping GIFs…' }, 200);
});

// Admin endpoints for pending stickers
app.get('/api/admin/stickers/pending', async (c) => {
  const token = c.req.header('x-admin-token');
  if (token !== c.env.ADMIN_TOKEN) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const { results } = await c.env.DB.prepare(`SELECT * FROM stickers WHERE approved = FALSE`).all();
    return c.json({ pending: results || [] }, 200);
  } catch (e: any) {
    return c.json({ pending: [] }, 200);
  }
});

app.post('/api/admin/stickers/approve', async (c) => {
  const token = c.req.header('x-admin-token');
  if (token !== c.env.ADMIN_TOKEN) return c.json({ error: 'Unauthorized' }, 401);
  const { ids } = await c.req.json();
  if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: 'No IDs provided' }, 400);
  const placeholders = ids.map(() => '?').join(',');
  await c.env.DB.prepare(`UPDATE stickers SET approved = TRUE WHERE id IN (${placeholders})`).bind(...ids).run();
  return c.json({ success: true }, 200);
});

app.post('/api/conversations/read', async (c) => {
  const { conversationId, userId } = await c.req.json();
  try {
    await c.env.DB.prepare(
      "UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?"
    ).bind(conversationId, userId).run();
    return c.json({ success: true }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/users/heartbeat', async (c) => {
  try {
    const { userId } = await c.req.json();
    if (userId) {
      await c.env.DB.prepare("UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(userId).run();
    }
    return c.json({ success: true }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/conversations', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'Missing userId' }, 400);

  try {
    // Keep user presence updated on each poll
    await c.env.DB.prepare("UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(userId).run().catch(() => {});

    const { results: participations } = await c.env.DB.prepare(
      "SELECT conversation_id, last_read_at FROM conversation_participants WHERE user_id = ?"
    ).bind(userId).all();

    if (!participations.length) return c.json({ conversations: [] }, 200);

    const convIds = participations.map((p: any) => p.conversation_id);
    const placeholders = convIds.map(() => '?').join(',');

    const { results: convs } = await c.env.DB.prepare(
      `SELECT id, is_private, name FROM conversations WHERE id IN (${placeholders})`
    ).bind(...convIds).all();

    const { results: allParts } = await c.env.DB.prepare(
      `SELECT conversation_id, user_id, last_read_at FROM conversation_participants WHERE conversation_id IN (${placeholders})`
    ).bind(...convIds).all();

    const userIds = Array.from(new Set(allParts.map((p: any) => p.user_id)));
    const userPlaceholders = userIds.map(() => '?').join(',');
    const { results: profiles } = await c.env.DB.prepare(
      `SELECT id as user_id, username as display_name, last_seen_at FROM users WHERE id IN (${userPlaceholders})`
    ).bind(...userIds).all();

    const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));

    const { results: allMsgs } = await c.env.DB.prepare(
      `SELECT id, conversation_id, content, created_at, sender_id FROM messages WHERE conversation_id IN (${placeholders}) ORDER BY created_at DESC`
    ).bind(...convIds).all();

    const previews = participations.map((part: any) => {
      const convId = part.conversation_id;
      const convData = convs.find((c: any) => c.id === convId);
      const otherParts = allParts.filter((p: any) => p.conversation_id === convId && p.user_id !== userId);
      const otherUsers = otherParts.map((p: any) => {
        const profile = profileMap.get(p.user_id) || { display_name: "Unknown", user_id: p.user_id, last_seen_at: null };
        return { ...profile, last_read_at: p.last_read_at };
      });
      const msgsForConv = allMsgs.filter((m: any) => m.conversation_id === convId);
      const lastMsg = msgsForConv[0]; 

      return {
        id: convId,
        name: convData?.name || null,
        otherUsers,
        lastMessage: lastMsg ? { content: lastMsg.content, created_at: lastMsg.created_at } : undefined,
        is_private: convData?.is_private || false,
        memberCount: allParts.filter((p: any) => p.conversation_id === convId).length,
        unread: 0,
        pinned: false,
        muted: false,
        lastReadAt: part.last_read_at,
      };
    }).filter((p: any) => p.otherUsers.length > 0 || p.memberCount > 1);

    return c.json({ conversations: previews }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/messages/:conversationId', async (c) => {
  const convId = c.req.param('conversationId');
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
    ).bind(convId).all();
    return c.json({ messages: results }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/messages', async (c) => {
  const { conversationId, senderId, content, gifUrl } = await c.req.json();
  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      "INSERT INTO messages (id, conversation_id, sender_id, content, gif_url) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, conversationId, senderId, content, gifUrl || null).run();
    return c.json({ success: true, id }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/sessions', async (c) => {
  const auth = c.req.header("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const { results: sessionData } = await c.env.DB.prepare(
      "SELECT user_id FROM sessions WHERE id = ?"
    ).bind(token).all();
    
    if (!sessionData.length) return c.json({ error: 'Unauthorized' }, 401);
    const userId = sessionData[0].user_id;

    const { results: sessions } = await c.env.DB.prepare(
      "SELECT id, device_info, last_active, created_at FROM sessions WHERE user_id = ? ORDER BY last_active DESC"
    ).bind(userId).all();

    return c.json({ sessions, currentToken: token }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.delete('/api/sessions/:id', async (c) => {
  const sessionId = c.req.param('id');
  const auth = c.req.header("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const { results: sessionData } = await c.env.DB.prepare(
      "SELECT user_id FROM sessions WHERE id = ?"
    ).bind(token).all();
    if (!sessionData.length) return c.json({ error: 'Unauthorized' }, 401);

    await c.env.DB.prepare(
      "DELETE FROM sessions WHERE id = ? AND user_id = ?"
    ).bind(sessionId, sessionData[0].user_id).run();

    return c.json({ success: true }, 200);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
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
  },
  async scheduled(event: any, env: Bindings, ctx: ExecutionContext) {
    try {
      await fetchAndStoreStickers(env as any);
    } catch (e) {
      console.error('Scheduled sticker fetch failed:', e);
    }
  }
}
