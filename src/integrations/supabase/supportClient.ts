import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Separate client for website visitors' live-support chat. It holds an
 * *anonymous* Supabase session under its own storage key, so it never
 * touches the main app session (AuthProvider, staff/customer logins).
 * The anonymous session is only created when a visitor sends a message.
 */
export const supportClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    storageKey: 'serveos-support',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
