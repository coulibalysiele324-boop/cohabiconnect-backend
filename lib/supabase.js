import { createClient } from '@supabase/supabase-js'

const supabaseUrl    = process.env.SUPABASE_URL
const supabaseKey    = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquantes.')
}

// Client avec service_role — utilisé uniquement côté serveur (API routes)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})
