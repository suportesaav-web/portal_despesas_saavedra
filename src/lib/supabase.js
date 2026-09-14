import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gqatshashcohenmpcgqq.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_AJXjR8lhPdvF02kY3wbz4g_24v0GnqW';

export const supabase = createClient(supabaseUrl, supabaseKey);

