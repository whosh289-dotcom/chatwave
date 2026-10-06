import type { D1Database } from '@cloudflare/workers-types';

/**
 * Fetch stickers from external sources defined in sticker-sources.json and store them in D1.
 * Batch insertion size is capped at 200 URLs per batch, with a total maximum of 500 URLs per run.
 * This function is used by the scheduled worker (not the boost endpoint) and does not update KV.
 */
export async function fetchAndStoreStickers(env: { DB: D1Database; ASSETS: any }): Promise<void> {
  const { DB, ASSETS } = env;
  try {
    // Use the built‑in assets fetcher; the path is relative to the worker root.
    const configRes = await ASSETS.fetch('sticker-sources.json');
    if (!configRes.ok) {
      console.error('Failed to load sticker-sources.json', configRes.status);
      return;
    }
    const sources: Array<{ name: string; url: string }> = await configRes.json();
    const maxUrls = 500;
    let processed = 0;
    for (const source of sources) {
      if (processed >= maxUrls) break;
      try {
        const resp = await fetch(source.url);
        const data = await resp.json();
        let urls: string[] = [];
        if (source.name.toLowerCase().includes('reddit')) {
          urls = (data.data?.children || [])
            .map((c: any) => c.data?.url)
            .filter((u: string) => u && (u.endsWith('.gif') || u.endsWith('.mp4')));
        } else if (source.name.toLowerCase().includes('tenor')) {
          urls = (data.results || [])
            .map((r: any) => r.media_formats?.gif?.url)
            .filter(Boolean);
        }
        // Truncate to remaining capacity
        const remaining = maxUrls - processed;
        if (urls.length > remaining) urls = urls.slice(0, remaining);
        // Insert in batches of ≤200
        for (let i = 0; i < urls.length; i += 200) {
          const batch = urls.slice(i, i + 200);
          const inserts = batch.map((url) => {
            const id = crypto.randomUUID();
            return DB.prepare(`INSERT INTO stickers (id, url, artist_name, approved) VALUES (?, ?, ?, FALSE)`)
              .bind(id, url, source.name)
              .run();
          });
          // Run inserts sequentially to avoid overwhelming the DB
          for (const p of inserts) await p;
          processed += batch.length;
          console.log(`Inserted batch of ${batch.length} URLs from ${source.name}. Total processed: ${processed}`);
        }
      } catch (e) {
        console.error('Error fetching from', source.name, e);
      }
    }
  } catch (e) {
    console.error('Error loading sticker sources', e);
  }
}
