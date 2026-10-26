import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// REPLACE THESE WITH YOUR SUPABASE VALUES!
export const SUPABASE_URL = 'https://dkuzcchuquvhiqlhmhjn.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_u3_9bJSxckrEltJKdSqJpA_2X72Hddi';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});