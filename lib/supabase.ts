import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jlsjrtqjqharnzkuxqqj.supabase.co";
const supabasePublishableKey = "sb_publishable_1WcDmX7lQOaRBUCiSEJ3Ig_qpWUhrBR";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
