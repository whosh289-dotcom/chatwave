// src/api/boostStatus.ts
import type { Bindings } from '../utils/types';

export default async (c: { env: Bindings }) => {
  const { BOOST_STATUS, DB } = c.env;
  const lastBoost = await BOOST_STATUS.get('lastBoost');
  // count approved public stickers
  const result = await DB.prepare('SELECT COUNT(*) as count FROM stickers WHERE approved = TRUE').first();
  const publicCount = (result?.count as number) ?? 0;
  return new Response(JSON.stringify({ publicStickerCount: publicCount, lastBoost }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
