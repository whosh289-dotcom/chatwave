import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

// Use dummy values to prevent the React app from crashing (blank white screen) when Supabase env vars are missing.
// Since we are migrating to Cloudflare D1, we no longer need the actual Supabase URL here.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://dummy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "dummy-key";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  }
});
