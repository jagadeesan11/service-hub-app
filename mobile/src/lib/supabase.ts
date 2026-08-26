import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { LargeSecureStore } from '@/lib/large-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.',
  );
}

// expo-secure-store has no native module on web, so LargeSecureStore (which
// relies on it) can't run there; supabase-js falls back to its own default
// (localStorage) when no storage adapter is provided.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
