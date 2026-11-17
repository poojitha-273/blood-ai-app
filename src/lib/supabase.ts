import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://uycuocrqerkhycpnekdg.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_8QTpW_LbUOXi8zWWrviqQg_oIg47km0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
