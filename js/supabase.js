// ============================================================
// supabase.js — Supabase Client Initialization
// Reads credentials from localStorage (set by installer) first,
// then falls back to hardcoded defaults.
// Run install.html to configure your own Supabase project.
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Read config from localStorage (set by the CMS installer)
const _config = JSON.parse(localStorage.getItem('supabase_config') || 'null');

const SUPABASE_URL = _config?.url || 'https://xwzuxewhlhoogwvnutfk.supabase.co';
const SUPABASE_ANON_KEY = _config?.anon_key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3enV4ZXdobGhvb2d3dm51dGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2ODgxNjksImV4cCI6MjA2OTI2NDE2OX0.9FNylEbi9bSaGu2tu7-MYoEiyjkKHtDTell1UMmraWc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
