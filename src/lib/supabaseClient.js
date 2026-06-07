import { createClient } from "@supabase/supabase-js";

// Valores de respaldo para que la app funcione aunque Vercel no inyecte las variables.
// La anon key es pública en apps frontend; lo que nunca debe ponerse aquí es la service_role/secret key.
const FALLBACK_SUPA_URL = "https://uetuoxtfccrbymwlsssx.supabase.co";
const FALLBACK_SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InVldHVveHRmY2NyYnltd2xzc3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjExMDIsImV4cCI6MjA5NTE5NzEwMn0.-A_cY0w1_V4UPeMXmFWStJ52xhWvHL5ecGtEEcBd1XA";

const SUPA_URL = (import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPA_URL).trim();
const SUPA_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPA_KEY).trim();

const supabase = createClient(SUPA_URL, SUPA_KEY);

export {
  FALLBACK_SUPA_URL,
  FALLBACK_SUPA_KEY,
  SUPA_URL,
  SUPA_KEY,
  supabase
};
