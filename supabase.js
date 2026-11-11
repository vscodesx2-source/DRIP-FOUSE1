
// ==========================================
// DRIP FOUSE - SUPABASE CONFIGURATION
// ==========================================

const SUPABASE_URL =
    "https://phvnhpbjhsdkuilpukrd.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_WWnhCCdYR3MaXJoT1giPPw_pQT-tmPe";

const { createClient } = supabase;

export const db = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    }
);

console.log(
    "DRIP FOUSE: Supabase initialized successfully!"
);
