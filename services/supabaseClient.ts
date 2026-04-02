import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key is missing from environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseTemp = createClient(supabaseUrl, supabaseAnonKey, { 
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'temp_user_reg' } 
});
