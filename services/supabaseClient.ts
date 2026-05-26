import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are missing. ' +
    'The application is running in mock-compatibility mode.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseTemp = createClient(supabaseUrl, supabaseAnonKey, { 
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'temp_user_reg' } 
});
