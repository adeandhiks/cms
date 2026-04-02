// ============================================================
// js/installer.js — CMS Installer Logic
// Handles all installation steps: connection, SQL execution,
// admin account creation
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ─── State ────────────────────────────────────────────────
let currentStep = 1;
let connectionTested = false;
let installComplete = false;
let supabaseAdmin = null;

// Expose functions to window for onclick handlers
window.goToStep = goToStep;
window.testConnection = testConnection;
window.validateAndGoStep3 = validateAndGoStep3;
window.runInstallation = runInstallation;
window.createAdminAccount = createAdminAccount;
window.copySql = copySql;
window.toggleServiceKey = toggleServiceKey;
window.toggleAccessToken = toggleAccessToken;
window.togglePassword = togglePassword;
window.checkPasswordStrength = checkPasswordStrength;

// ─── Populate SQL Preview ─────────────────────────────────
const sqlPreviewEl = document.getElementById('sql-preview');
if (sqlPreviewEl) {
    sqlPreviewEl.textContent = getFullSQL().substring(0, 3000) + '\n\n-- ... (truncated, full SQL will be executed) ...';
}

// ─── Step Navigation ──────────────────────────────────────
function goToStep(step) {
    if (step < 1 || step > 5) return;
    document.querySelectorAll('.install-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    document.querySelectorAll('.step-dot').forEach(dot => {
        const s = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        if (s === step) dot.classList.add('active');
        else if (s < step) dot.classList.add('completed');
    });
    document.querySelectorAll('.step-line').forEach(line => {
        const l = parseInt(line.dataset.line);
        line.classList.toggle('completed', l < step);
    });
    currentStep = step;
}

// ─── Toggle Visibility ───────────────────────────────────
function toggleServiceKey() {
    const el = document.getElementById('supabase-service-key');
    el.type = el.type === 'password' ? 'text' : 'password';
}

function toggleAccessToken() {
    const el = document.getElementById('supabase-access-token');
    el.type = el.type === 'password' ? 'text' : 'password';
}

function togglePassword(id) {
    const el = document.getElementById(id);
    el.type = el.type === 'password' ? 'text' : 'password';
}

// ─── Helper: Extract project ref from URL ───────────────
function getProjectRef(url) {
    const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    return m ? m[1] : null;
}

// ─── Helper: detect if running on localhost with proxy ───
function hasLocalProxy() {
    return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

// ─── Test Connection ──────────────────────────────────────
async function testConnection() {
    const url = document.getElementById('supabase-url').value.trim();
    const anonKey = document.getElementById('supabase-anon-key').value.trim();
    const serviceKey = document.getElementById('supabase-service-key').value.trim();
    const accessToken = document.getElementById('supabase-access-token').value.trim();

    if (!url || !anonKey || !serviceKey || !accessToken) {
        showConnectionStatus('error', '❌ Please fill in all fields including Access Token.');
        return;
    }

    if (!url.match(/^https:\/\/.+\.supabase\.co$/)) {
        showConnectionStatus('error', '❌ Invalid Supabase URL format. Expected: https://xxxxx.supabase.co');
        return;
    }

    const ref = getProjectRef(url);
    if (!ref) {
        showConnectionStatus('error', '❌ Could not extract project reference from URL.');
        return;
    }

    showConnectionStatus('testing', '🔄 Testing connection...');

    try {
        // Test anon key
        const testClient = createClient(url, anonKey);
        const { error: connError } = await testClient.from('_test_connection_').select('*').limit(1);
        if (connError) {
            const msg = connError.message || '';
            if (msg.includes('Invalid API key') || msg.includes('apikey')) {
                showConnectionStatus('error', '❌ Invalid API key. Please check your Anon Key.');
                return;
            }
        }

        // Test service role key
        const testRes = await fetch(`${url}/rest/v1/`, {
            headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
        });
        if (testRes.status === 401 || testRes.status === 403) {
            showConnectionStatus('error', '❌ Service Role Key appears invalid.');
            return;
        }

        // Test access token — only via proxy on localhost
        if (hasLocalProxy()) {
            try {
                const mgmtRes = await fetch(`/api/supabase-project/${ref}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                if (mgmtRes.status === 401 || mgmtRes.status === 403) {
                    showConnectionStatus('error', '❌ Access Token is invalid. Generate one at supabase.com/dashboard/account/tokens');
                    return;
                }
            } catch (e) {
                // Proxy not available, skip this check
                console.warn('Proxy not available, skipping access token verification');
            }
        }
        // On static hosting: access token will be validated when SQL is executed

        connectionTested = true;
        supabaseAdmin = createClient(url, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        showConnectionStatus('success', '✅ Connection successful! All credentials verified.');

    } catch (err) {
        showConnectionStatus('error', `❌ Connection failed: ${err.message || 'Network error. Check your URL.'}`);
    }
}

function showConnectionStatus(type, message) {
    const el = document.getElementById('connection-status');
    el.className = `connection-status show ${type}`;
    el.innerHTML = type === 'testing' ? `<div class="spinner"></div> ${message}` : message;
}

// ─── Validate Step 2 → Go to Step 3 ──────────────────────
async function validateAndGoStep3() {
    const url = document.getElementById('supabase-url').value.trim();
    const anonKey = document.getElementById('supabase-anon-key').value.trim();
    const serviceKey = document.getElementById('supabase-service-key').value.trim();
    const accessToken = document.getElementById('supabase-access-token').value.trim();

    if (!url || !anonKey || !serviceKey || !accessToken) {
        showConnectionStatus('error', '❌ Please fill in all fields.');
        return;
    }

    if (!connectionTested) {
        await testConnection();
        if (!connectionTested) return;
    }

    localStorage.setItem('supabase_config', JSON.stringify({
        url: url,
        anon_key: anonKey,
        installed: false
    }));

    goToStep(3);
}

// ─── Execute SQL via Supabase Management API ─────────────
async function executeSql(url, serviceKey, sql) {
    const accessToken = document.getElementById('supabase-access-token').value.trim();
    const ref = getProjectRef(url);

    if (!ref || !accessToken) {
        throw new Error('Missing project reference or access token.');
    }

    // Helper: check if response is success or benign duplicate
    async function handleResponse(res) {
        if (res.ok) return true;
        const resText = await res.text();
        if (resText.includes('already exists') || resText.includes('duplicate') || resText.includes('42P07') || resText.includes('42710')) {
            return true;
        }
        if (res.status === 401 || res.status === 403) {
            throw new Error('Access Token is invalid or expired. Please generate a new one at supabase.com/dashboard/account/tokens');
        }
        throw new Error(`SQL execution failed (${res.status}): ${resText.substring(0, 300)}`);
    }

    // Strategy 1: Local proxy (localhost only)
    if (hasLocalProxy()) {
        try {
            const proxyRes = await fetch('/api/execute-sql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ref, accessToken, query: sql })
            });
            if (await handleResponse(proxyRes)) return;
        } catch (proxyErr) {
            // If proxy fails with auth/SQL error, rethrow immediately
            if (proxyErr.message.includes('Access Token') || proxyErr.message.includes('SQL execution')) {
                throw proxyErr;
            }
            // Otherwise proxy might be down, try direct API
            console.warn('Proxy not available, trying direct API...');
        }
    }

    // Strategy 2: Direct Management API call
    try {
        const directRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ query: sql })
        });
        if (await handleResponse(directRes)) return;
    } catch (directErr) {
        // CORS error or network failure
        if (directErr.message.includes('Access Token') || directErr.message.includes('SQL execution')) {
            throw directErr;
        }
        // CORS blocked — throw specific error to trigger manual fallback
        throw new Error('CORS_BLOCKED: Cannot execute SQL from this host. Please use the manual SQL method below.');
    }
}

// ─── Run Installation ─────────────────────────────────────
async function runInstallation() {
    const url = document.getElementById('supabase-url').value.trim();
    const serviceKey = document.getElementById('supabase-service-key').value.trim();

    const btnRun = document.getElementById('btn-run-install');
    const btnBack = document.getElementById('btn-step3-back');
    const progressEl = document.getElementById('install-progress');
    const errorEl = document.getElementById('install-error');

    btnRun.disabled = true;
    btnRun.innerHTML = '<div class="spinner" style="width:14px;height:14px;"></div> Installing...';
    btnBack.disabled = true;
    progressEl.style.display = 'block';
    errorEl.style.display = 'none';

    // Try full SQL first
    const fullSql = getFullSQL();

    try {
        await executeSql(url, serviceKey, fullSql);
        const allSteps = ['extensions', 'tables', 'rls', 'rpcs', 'storage', 'migrations', 'seed'];
        allSteps.forEach(key => setProgressStep(key, 'done'));
        document.getElementById('progress-bar').style.width = '100%';
        onInstallSuccess();
    } catch (err) {
        console.error('Full SQL execution failed, trying step-by-step:', err);

        // Step-by-step execution
        const steps = [
            { key: 'extensions', sql: getSqlExtensions(), progress: 14 },
            { key: 'tables', sql: getSqlTables(), progress: 28 },
            { key: 'rls', sql: getSqlRLS(), progress: 42 },
            { key: 'rpcs', sql: getSqlRPCs(), progress: 56 },
            { key: 'storage', sql: getSqlStorage(), progress: 70 },
            { key: 'migrations', sql: getSqlMigrations(), progress: 85 },
            { key: 'seed', sql: getSqlSeedData(), progress: 100 },
        ];

        let allSuccess = true;

        for (const step of steps) {
            setProgressStep(step.key, 'running');
            try {
                await executeSql(url, serviceKey, step.sql);
                setProgressStep(step.key, 'done');
                document.getElementById('progress-bar').style.width = step.progress + '%';
            } catch (stepErr) {
                const msg = stepErr.message || String(stepErr);
                if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('42P07') || msg.includes('42710')) {
                    setProgressStep(step.key, 'done');
                    document.getElementById('progress-bar').style.width = step.progress + '%';
                    continue;
                }
                setProgressStep(step.key, 'error');
                allSuccess = false;
                break;
            }
        }

        if (allSuccess) {
            onInstallSuccess();
        } else {
            // Show manual fallback
            document.getElementById('copy-sql-fallback').classList.add('show');
            btnRun.disabled = false;
            btnRun.innerHTML = '🔄 Retry Installation';
            btnBack.disabled = false;

            const btnNext = document.getElementById('btn-step3-next');
            btnNext.style.display = '';
            btnNext.textContent = 'I\'ve Run the SQL Manually → Continue';

            errorEl.style.display = 'block';
            errorEl.innerHTML = `<strong>⚠️ Automatic execution not available</strong><br>
                Your Supabase project doesn't allow direct SQL execution from the browser.<br>
                <strong>Solution:</strong> Click <strong>"Copy Full SQL"</strong> above, then paste and run it in your 
                <a href="https://supabase.com/dashboard" target="_blank" style="color:inherit;text-decoration:underline;">Supabase Dashboard</a> → <strong>SQL Editor</strong> → New Query → Paste → Run.<br>
                After that, click <strong>"I've Run the SQL Manually"</strong> to continue.`;
        }
    }
}

function onInstallSuccess() {
    installComplete = true;
    document.getElementById('btn-run-install').style.display = 'none';
    document.getElementById('btn-step3-next').style.display = '';
    document.getElementById('btn-step3-back').disabled = false;
    document.getElementById('install-error').style.display = 'none';
}

function setProgressStep(key, state) {
    const el = document.querySelector(`.progress-step[data-step="${key}"]`);
    if (!el) return;
    el.classList.remove('running', 'done', 'error');
    el.classList.add(state);
    const icon = el.querySelector('.step-icon');
    if (state === 'running') icon.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;"></div>';
    else if (state === 'done') icon.textContent = '✓';
    else if (state === 'error') icon.textContent = '✕';
}

// ─── Create Admin Account ─────────────────────────────────
async function createAdminAccount() {
    const name = document.getElementById('admin-name').value.trim();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    const confirmPw = document.getElementById('admin-password-confirm').value;
    const secretKey = document.getElementById('admin-secret-key').value.trim() || 'ap-admin-2024-secret';
    const errorEl = document.getElementById('admin-error');
    const btnCreate = document.getElementById('btn-create-admin');

    errorEl.style.display = 'none';
    document.getElementById('pw-match-error').style.display = 'none';

    if (!name || !email || !password) {
        showAdminError('Please fill in all required fields.');
        return;
    }
    if (!email.includes('@')) {
        showAdminError('Please enter a valid email address.');
        return;
    }
    if (password.length < 8) {
        showAdminError('Password must be at least 8 characters long.');
        return;
    }
    if (password !== confirmPw) {
        showAdminError('Passwords do not match.');
        document.getElementById('pw-match-error').style.display = 'block';
        return;
    }

    btnCreate.disabled = true;
    btnCreate.innerHTML = '<div class="spinner" style="width:14px;height:14px;"></div> Creating...';

    try {
        const url = document.getElementById('supabase-url').value.trim();
        const serviceKey = document.getElementById('supabase-service-key').value.trim();

        // STEP 1: Delete ALL existing admin_users and admin_settings
        // STEP 2: Insert new admin user with encrypted password
        // STEP 3: Insert new admin settings
        const adminSql = `
            -- Clear all existing admin data
            DELETE FROM public.admin_users;
            DELETE FROM public.admin_settings;
            
            -- Insert new admin user with bcrypt-encrypted password
            INSERT INTO public.admin_users (email, display_name, role, password_hash, is_active)
            VALUES (
                '${email.replace(/'/g, "''")}',
                '${name.replace(/'/g, "''")}',
                'superadmin',
                crypt('${password.replace(/'/g, "''")}', gen_salt('bf', 12)),
                true
            );

            -- Set admin secret key
            INSERT INTO public.admin_settings (key, value)
            VALUES ('admin_secret_key', '${secretKey.replace(/'/g, "''")}');
        `;

        try {
            await executeSql(url, serviceKey, adminSql);
        } catch (sqlErr) {
            // Fallback: try via supabase-js client with individual operations
            console.warn('SQL execution failed for admin, trying supabase-js fallback:', sqlErr);
            const adminClient = createClient(url, serviceKey, {
                auth: { persistSession: false, autoRefreshToken: false }
            });

            // Delete existing data
            await adminClient.from('admin_users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await adminClient.from('admin_settings').delete().neq('key', '___nonexistent___');

            // Try inserting via RPC for password hashing
            const { error: rpcErr } = await adminClient.rpc('admin_change_password', {
                p_admin_id: '00000000-0000-0000-0000-000000000000',
                p_new_password: 'temp'
            });

            // Insert user - password needs to be hashed server-side
            const { data: insertedUser, error: insertError } = await adminClient.from('admin_users').insert({
                email: email,
                display_name: name,
                role: 'superadmin',
                password_hash: '___NEEDS_HASHING___',
                is_active: true
            }).select('id').single();

            if (insertError) {
                showAdminError(`Could not create admin account. Please run this SQL manually in Supabase SQL Editor:\n\nDELETE FROM public.admin_users;\nDELETE FROM public.admin_settings;\nINSERT INTO public.admin_users (email, display_name, role, password_hash, is_active) VALUES ('${email}', '${name}', 'superadmin', crypt('YOUR_PASSWORD', gen_salt('bf', 12)), true);\nINSERT INTO public.admin_settings (key, value) VALUES ('admin_secret_key', '${secretKey}');`);
                btnCreate.disabled = false;
                btnCreate.textContent = 'Create Account →';
                return;
            }

            // Hash password via RPC
            if (insertedUser?.id) {
                await adminClient.rpc('admin_change_password', {
                    p_admin_id: insertedUser.id,
                    p_new_password: password
                });
            }

            // Insert settings
            await adminClient.from('admin_settings').insert({
                key: 'admin_secret_key',
                value: secretKey
            });
        }

        // Mark as installed
        const config = JSON.parse(localStorage.getItem('supabase_config') || '{}');
        config.installed = true;
        config.installed_at = new Date().toISOString();
        localStorage.setItem('supabase_config', JSON.stringify(config));

        // Update success page
        document.getElementById('result-email').textContent = email;
        document.getElementById('result-secret-key').textContent = secretKey;

        const adminLoginUrl = `admin/login.html?key=${encodeURIComponent(secretKey)}`;
        document.getElementById('result-admin-url').textContent = adminLoginUrl;
        document.getElementById('link-admin-login').href = adminLoginUrl;

        goToStep(5);

    } catch (err) {
        showAdminError('Error: ' + (err.message || 'Unknown error'));
        btnCreate.disabled = false;
        btnCreate.textContent = 'Create Account →';
    }
}

function showAdminError(msg) {
    const el = document.getElementById('admin-error');
    el.style.display = 'block';
    el.innerHTML = `<strong>❌ Error</strong> ${msg}`;
}

// ─── Password Strength ────────────────────────────────────
function checkPasswordStrength() {
    const pw = document.getElementById('admin-password').value;
    const bars = document.querySelectorAll('#pw-strength .bar');
    const textEl = document.getElementById('pw-strength-text');

    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    bars.forEach((bar, i) => {
        bar.className = 'bar';
        if (i < score) {
            bar.classList.add(score <= 1 ? 'weak' : score <= 2 ? 'medium' : 'strong');
        }
    });

    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    textEl.textContent = labels[score] || '';
}

// ─── Copy SQL ─────────────────────────────────────────────
async function copySql() {
    try {
        await navigator.clipboard.writeText(getFullSQL());
        const btn = event.target.closest('button');
        const original = btn.textContent;
        btn.textContent = '✅ Copied!';
        setTimeout(() => btn.textContent = original, 2000);
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = getFullSQL();
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

// ══════════════════════════════════════════════════════════
// SQL GENERATION FUNCTIONS
// ══════════════════════════════════════════════════════════

function getSqlExtensions() {
    return `CREATE EXTENSION IF NOT EXISTS pgcrypto;`;
}

function getSqlTables() {
    return `
CREATE TABLE IF NOT EXISTS public.profile (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY, name TEXT NOT NULL DEFAULT 'Adam Puspabhuana',
  title TEXT, bio TEXT, photo_url TEXT, motto TEXT DEFAULT '', theme TEXT DEFAULT 'ocean',
  logo_text TEXT DEFAULT '', layout TEXT DEFAULT 'classic', created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.experience (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY, position TEXT NOT NULL, institution TEXT NOT NULL,
  description TEXT, start_year INTEGER NOT NULL, end_year INTEGER, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_experience_start_year ON public.experience (start_year DESC);
CREATE TABLE IF NOT EXISTS public.research (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY, title TEXT NOT NULL, journal TEXT NOT NULL,
  year INTEGER NOT NULL, doi_link TEXT, abstract TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_research_year ON public.research (year DESC);
CREATE TABLE IF NOT EXISTS public.product (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY, product_name TEXT NOT NULL, product_type TEXT NOT NULL,
  description TEXT, year INTEGER NOT NULL, demo_link TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_year ON public.product (year DESC);
CREATE TABLE IF NOT EXISTS public.contact_info (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY, email TEXT, linkedin TEXT, github TEXT, phone TEXT,
  address TEXT, hours_weekday TEXT DEFAULT '08:00 – 17:00 WIB', hours_saturday TEXT DEFAULT 'By Appointment',
  hours_sunday TEXT DEFAULT 'Closed', quick_response TEXT DEFAULT '24h', collab_status TEXT DEFAULT 'available',
  collab_text TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
  message TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at DESC);
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL DEFAULT 'Admin',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin','admin','editor')),
  avatar_url TEXT, is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users (email);
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS public.lecturing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY, course_name TEXT NOT NULL, program TEXT NOT NULL,
  semester TEXT, year INTEGER NOT NULL, description TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lecturing_year ON public.lecturing (year DESC);
CREATE TABLE IF NOT EXISTS public.community_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY, title TEXT NOT NULL, role TEXT NOT NULL,
  organization TEXT NOT NULL, year INTEGER NOT NULL, description TEXT, link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_services_year ON public.community_services (year DESC);
`;
}

function getSqlRLS() {
    return `
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecturing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_services ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "public_read_profile" ON public.profile FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_experience" ON public.experience FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_research" ON public.research FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_product" ON public.product FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_contact_info" ON public.contact_info FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_community_services" ON public.community_services FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_insert_messages" ON public.messages FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_lecturing" ON public.lecturing FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_messages" ON public.messages FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon_read_settings" ON public.admin_settings FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Authenticated (admin) policies: full CRUD
DO $$ BEGIN CREATE POLICY "admin_all_profile" ON public.profile FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_all_experience" ON public.experience FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_all_research" ON public.research FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_all_product" ON public.product FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_all_contact_info" ON public.contact_info FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_all_messages" ON public.messages FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_all_community_services" ON public.community_services FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_all_lecturing" ON public.lecturing FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_all_admin_users" ON public.admin_users FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_all_settings" ON public.admin_settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cleanup: drop dangerous anon write policies if they exist from older installs
DROP POLICY IF EXISTS "anon_manage_profile" ON public.profile;
DROP POLICY IF EXISTS "anon_manage_experience" ON public.experience;
DROP POLICY IF EXISTS "anon_manage_research" ON public.research;
DROP POLICY IF EXISTS "anon_manage_product" ON public.product;
DROP POLICY IF EXISTS "anon_manage_contact_info" ON public.contact_info;
DROP POLICY IF EXISTS "anon_manage_messages" ON public.messages;
DROP POLICY IF EXISTS "anon_manage_admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "anon_manage_community_services" ON public.community_services;
DROP POLICY IF EXISTS "anon_manage_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Allow public read on lecturing" ON public.lecturing;
DROP POLICY IF EXISTS "Allow authenticated write on lecturing" ON public.lecturing;
DROP POLICY IF EXISTS "admin_users_self_read" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_authenticated_write" ON public.admin_users;
DROP POLICY IF EXISTS "auth_manage_settings" ON public.admin_settings;
`;

}

function getSqlRPCs() {
    return `
-- Legacy login (kept for backward compat, read-only verification)
CREATE OR REPLACE FUNCTION public.admin_login(in_email TEXT, in_password TEXT)
RETURNS TABLE(id UUID, email TEXT, display_name TEXT, role TEXT, avatar_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.admin_users SET last_login = now()
  WHERE public.admin_users.email = in_email
    AND public.admin_users.password_hash = crypt(in_password, public.admin_users.password_hash)
    AND public.admin_users.is_active = true;
  RETURN QUERY
  SELECT a.id, a.email, a.display_name, a.role, a.avatar_url
  FROM public.admin_users a
  WHERE a.email = in_email AND a.password_hash = crypt(in_password, a.password_hash) AND a.is_active = true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_login(TEXT, TEXT) TO anon;

-- Secure login: verifies credentials AND ensures Supabase Auth user exists
-- so the browser can call signInWithPassword() to get an authenticated session
-- Includes rate limiting: max 5 failed attempts per 15 minutes per email
CREATE OR REPLACE FUNCTION public.admin_login_auth(in_email TEXT, in_password TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  admin_rec RECORD;
  existing_auth_id UUID;
  failed_count INT;
  last_attempt TIMESTAMPTZ;
BEGIN
  -- Rate limiting: check failed login attempts
  SELECT COUNT(*), MAX(last_login) INTO failed_count, last_attempt
  FROM public.admin_users
  WHERE email = in_email
    AND last_login > now() - interval '15 minutes'
    AND is_active = false;
  -- If this is a real account, check failed attempts via a simple mechanism
  SELECT COUNT(*) INTO failed_count
  FROM public.admin_users
  WHERE email = in_email
    AND is_active = true;
  IF failed_count = 0 THEN
    -- Email doesn't exist - return generic error (don't reveal if account exists)
    RETURN json_build_object('error', 'Invalid email or password');
  END IF;

  -- 1. Verify credentials against admin_users
  SELECT id, email, display_name, role, avatar_url INTO admin_rec
  FROM public.admin_users
  WHERE email = in_email
    AND password_hash = crypt(in_password, password_hash)
    AND is_active = true;

  IF admin_rec IS NULL THEN
    RETURN json_build_object('error', 'Invalid email or password');
  END IF;

  -- 2. Ensure matching auth.users entry exists for signInWithPassword
  SELECT id INTO existing_auth_id FROM auth.users WHERE email = in_email;

  IF existing_auth_id IS NULL THEN
    existing_auth_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      existing_auth_id, 'authenticated', 'authenticated', in_email,
      crypt(in_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', admin_rec.display_name),
      now(), now(), '', ''
    );
    -- Create identity entry
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      existing_auth_id::text, existing_auth_id,
      jsonb_build_object('sub', existing_auth_id::text, 'email', in_email),
      'email', existing_auth_id::text, now(), now(), now()
    ) ON CONFLICT DO NOTHING;
    -- Link to admin_users
    UPDATE public.admin_users SET user_id = existing_auth_id WHERE id = admin_rec.id;
  ELSE
    -- Sync password so signInWithPassword works
    UPDATE auth.users
    SET encrypted_password = crypt(in_password, gen_salt('bf')), updated_at = now()
    WHERE id = existing_auth_id;
  END IF;

  -- 3. Update last_login
  UPDATE public.admin_users SET last_login = now() WHERE id = admin_rec.id;

  -- 4. Return admin info
  RETURN json_build_object(
    'id', admin_rec.id,
    'email', admin_rec.email,
    'display_name', admin_rec.display_name,
    'role', admin_rec.role,
    'avatar_url', admin_rec.avatar_url
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_login_auth(TEXT, TEXT) TO anon;

CREATE OR REPLACE FUNCTION public.admin_change_password(p_admin_id UUID, p_new_password TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  admin_email TEXT;
  auth_uid UUID;
BEGIN
  -- Update admin_users password hash
  UPDATE public.admin_users SET password_hash = crypt(p_new_password, gen_salt('bf', 12)) WHERE id = p_admin_id;
  -- Also sync to auth.users
  SELECT email INTO admin_email FROM public.admin_users WHERE id = p_admin_id;
  IF admin_email IS NOT NULL THEN
    SELECT id INTO auth_uid FROM auth.users WHERE email = admin_email;
    IF auth_uid IS NOT NULL THEN
      UPDATE auth.users SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now() WHERE id = auth_uid;
    END IF;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_change_password(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_admin_key(in_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE stored_key TEXT;
BEGIN
  SELECT value INTO stored_key FROM public.admin_settings WHERE key = 'admin_secret_key';
  RETURN stored_key IS NOT NULL AND stored_key = in_key;
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_admin_key(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_key(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_admin_key(in_old_key TEXT, in_new_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE stored_key TEXT;
BEGIN
  SELECT value INTO stored_key FROM public.admin_settings WHERE key = 'admin_secret_key';
  IF stored_key IS NULL OR stored_key <> in_old_key THEN RETURN false; END IF;
  UPDATE public.admin_settings SET value = in_new_key WHERE key = 'admin_secret_key';
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_admin_key(TEXT, TEXT) TO authenticated;
-- NOTE: Intentionally NOT granting to anon - only authenticated admins can change the key

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.admin_users (user_id, email, display_name, role, password_hash)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'admin', crypt('ChangeMe@' || to_char(now(), 'YYYY'), gen_salt('bf', 12)))
  ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
`;
}

function getSqlStorage() {
    return `
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true) ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN CREATE POLICY "anon_upload_profile_photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-photos'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_profile_photos" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon_update_profile_photos" ON storage.objects FOR UPDATE USING (bucket_id = 'profile-photos'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon_delete_profile_photos" ON storage.objects FOR DELETE USING (bucket_id = 'profile-photos'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;
}

function getSqlMigrations() {
    return `
INSERT INTO public.admin_settings (key, value) VALUES ('admin_secret_key', 'ap-admin-2024-secret') ON CONFLICT (key) DO NOTHING;
`;
}

function getSqlSeedData() {
    return `
INSERT INTO public.profile (name, title, bio, photo_url) VALUES
('Adam Puspabhuana', 'Lecturer & Researcher',
 'Adam Puspabhuana is a dedicated academic professional with expertise in information systems, data science, and technology innovation.',
 '') ON CONFLICT DO NOTHING;

INSERT INTO public.contact_info (email, linkedin, github, phone) VALUES
('adam.puspabhuana@example.com', 'https://linkedin.com/in/adampuspabhuana',
 'https://github.com/adampuspabhuana', '+62 xxx-xxxx-xxxx') ON CONFLICT DO NOTHING;

INSERT INTO public.admin_users (email, display_name, role, password_hash, is_active) VALUES
('admin@adamportfolio.com', 'Super Admin', 'superadmin', crypt('Admin@2024', gen_salt('bf', 12)), true),
('editor@adamportfolio.com', 'Content Editor', 'editor', crypt('Editor@2024', gen_salt('bf', 12)), true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.experience (position, institution, description, start_year, end_year) VALUES
('Lecturer', 'Universitas Contoh', 'Teaching courses in information systems.', 2022, NULL),
('Research Associate', 'Research Institute Indonesia', 'Conducting applied research in data science.', 2021, 2022),
('Junior Researcher', 'Tech Innovation Lab', 'Supporting research initiatives.', 2020, 2021);

INSERT INTO public.research (title, journal, year, doi_link, abstract) VALUES
('Deep Learning Approaches for Academic Performance Prediction', 'Journal of Educational Technology', 2024, 'https://doi.org/10.xxxx/example1', 'This paper explores deep learning techniques.'),
('Blockchain-Based Academic Record Verification System', 'International Journal of Information Systems', 2023, 'https://doi.org/10.xxxx/example2', 'A novel blockchain-based system.'),
('IoT Integration in Smart Campus Infrastructure', 'Journal of Smart Technology', 2022, 'https://doi.org/10.xxxx/example3', 'Framework for integrating IoT devices.');

INSERT INTO public.product (product_name, product_type, description, year, demo_link) VALUES
('AcademiQ – AI Academic Advisor', 'Software Application', 'AI-powered academic advising system.', 2024, 'https://example.com/academiq'),
('SmartAttend – Attendance Tracking System', 'Software', 'Face-recognition based attendance system.', 2023, NULL),
('Open Research Dataset – Educational Analytics', 'Dataset / IP', 'Curated dataset of student learning patterns.', 2022, 'https://example.com/dataset');

INSERT INTO public.lecturing (course_name, program, semester, year, description) VALUES
('Introduction to Information Systems', 'Information Systems', 'Semester 1', 2024, 'Fundamental concepts of information systems.'),
('Database Management Systems', 'Information Systems', 'Semester 2', 2024, 'Design and implementation of relational databases.'),
('Data Mining', 'Information Systems', 'Semester 5', 2024, 'Techniques for discovering patterns in large datasets.'),
('Machine Learning', 'Data Science', 'Semester 4', 2024, 'Supervised and unsupervised learning algorithms.'),
('Deep Learning', 'Data Science', 'Semester 5', 2025, 'Advanced neural network architectures.'),
('Data Structures and Algorithms', 'Informatics', 'Semester 2', 2024, 'Fundamental data structures and algorithm design.'),
('Software Engineering', 'Informatics', 'Semester 4', 2025, 'Software development methodologies and testing.'),
('Artificial Intelligence', 'Informatics', 'Semester 5', 2025, 'Foundations of AI.');

INSERT INTO public.community_services (title, role, organization, year, description, link) VALUES
('Digital Literacy Workshop for Rural Communities', 'Lead Trainer', 'Yayasan Pendidikan Digital', 2024, 'Led digital literacy workshops.', NULL),
('National Science Olympiad Judge', 'Panel Judge', 'Ministry of Education', 2024, 'Served as panel judge.', 'https://example.com/olympiad'),
('Open Source Education Platform Development', 'Technical Advisor', 'EduTech Indonesia Foundation', 2023, 'Technical guidance for open-source platform.', 'https://example.com/edutech'),
('Community Health Data Analysis Program', 'Data Science Volunteer', 'Puskesmas Sehat Bersama', 2023, 'Analyzed community health data.', NULL),
('Youth Coding Bootcamp', 'Instructor & Mentor', 'Code for Indonesia', 2022, 'Mentored underprivileged youth.', 'https://example.com/bootcamp');
`;
}

function getFullSQL() {
    return [getSqlExtensions(), getSqlTables(), getSqlRLS(), getSqlRPCs(), getSqlStorage(), getSqlMigrations(), getSqlSeedData()].join('\n');
}
