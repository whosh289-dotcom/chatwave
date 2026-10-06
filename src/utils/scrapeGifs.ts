import type { D1Database } from '@cloudflare/workers-types';

/**
 * Simple GIF scraper that fetches GIF URLs from a whitelist of public sources
 * and inserts them into the `stickers` table as public stickers (user_id = NULL).
 *
 * The function is designed to be called in a fire‑and‑forget manner from a
 * request handler, respecting Cloudflare Workers 30 s execution limit.
 */
export async function scrapeAndStoreGifs(db: D1Database): Promise<void> {
  // Sources to fetch – expand as needed.
  const sources = [fetchRedditGifs, fetchTenorGifs];

  // Collect all GIFs from each source.
  const allGifs = (await Promise.all(sources.map((fn) => fn()))).flat();

  // Deduplicate by URL.
  const uniqueGifs = Array.from(new Map(allGifs.map((g) => [g.url, g])).values());

  // Insert each new GIF if it does not already exist.
  for (const gif of uniqueGifs) {
    // Simple existence check.
    const { results } = await db
      .prepare('SELECT id FROM stickers WHERE url = ?')
      .bind(gif.url)
      .all();
    if (results && results.length > 0) continue;

    const id = crypto.randomUUID();
    await db
      .prepare(
        'INSERT INTO stickers (id, url, artist_name, user_id) VALUES (?, ?, ?, NULL)'
      )
      .bind(id, gif.url, gif.artist)
      .run();
  }
}

/** Fetch GIF URLs from Reddit's r/gifs JSON feed. */
async function fetchRedditGifs(): Promise<Array<{ url: string; artist: string }>> {
  const endpoint = 'https://www.reddit.com/r/gifs.json?limit=50';
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return [];
    const data = await res.json();
    const posts = data?.data?.children ?? [];
    const gifs: Array<{ url: string; artist: string }> = [];
    for (const post of posts) {
      const url: string = post?.data?.url_overridden_by_dest || '';
      if (url && url.endsWith('.gif')) {
        gifs.push({ url, artist: 'Reddit r/gifs' });
      }
    }
    return gifs;
  } catch (e) {
    console.error('Reddit fetch error:', e);
    return [];
  }
}

/** Fetch GIF URLs from Tenor's public endpoint. */
async function fetchTenorGifs(): Promise<Array<{ url: string; artist: string }>> {
  const endpoint = 'https://g.tenor.com/v1/trending?limit=30&media_filter=minimal';
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return [];
    const data = await res.json();
    const gifs: Array<{ url: string; artist: string }> = [];
    for (const item of data?.results ?? []) {
      const media = item?.media?.[0];
      const gifUrl = media?.gif?.url || media?.mp4?.url;
      if (gifUrl) {
        gifs.push({ url: gifUrl, artist: 'Tenor' });
      }
    }
    return gifs;
  } catch (e) {
    console.error('Tenor fetch error:', e);
    return [];
  }
}
