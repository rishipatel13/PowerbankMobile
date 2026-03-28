import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const ExpoAsyncStorage = Platform.OS === 'web' && typeof window === 'undefined' ? null : AsyncStorage;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(ExpoAsyncStorage ? { storage: ExpoAsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
