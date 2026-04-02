// ============================================================
// admin/admin.js — Shared Admin Dashboard Controller
// Auth guard, secret key, sidebar, toast, CRUD helpers
// ============================================================

import { supabase } from '../js/supabase.js';

// ── Secret Key Helper ─────────────────────────────────────────
// Returns the admin secret key from URL param or sessionStorage.
function _getSecretKey() {
    const urlKey = new URLSearchParams(window.location.search).get('key');
    if (urlKey) {
        sessionStorage.setItem('admin_key', urlKey);
        return urlKey;
    }
    return sessionStorage.getItem('admin_key') || null;
}

// ── Get admin link with key ───────────────────────────────────
// Appends ?key= to admin page links so navigation preserves access.
export function adminUrl(page) {
    const key = _getSecretKey();
    return key ? `${page}?key=${encodeURIComponent(key)}` : page;
}

// ── Require Secret Key ────────────────────────────────────────
// Verifies the secret key via RPC. Redirects to public site if invalid.
export async function requireSecretKey() {
    const key = _getSecretKey();
    if (!key) {
        window.location.href = '../index.html';
        return false;
    }

    try {
        const { data, error } = await supabase.rpc('verify_admin_key', { in_key: key });
        if (error) {
            const msg = error.message || '';
            // Only allow bypass if the RPC function genuinely doesn't exist yet (fresh install)
            if (msg.includes('does not exist') || msg.includes('Could not find')) {
                console.warn('verify_admin_key RPC not yet created, allowing access with provided key.');
                _rewriteSidebarLinks();
                return true;
            }
            // All other errors (including network) — deny access for security
            sessionStorage.removeItem('admin_key');
            window.location.href = '../index.html';
            return false;
        }
        if (data === false) {
            sessionStorage.removeItem('admin_key');
            window.location.href = '../index.html';
            return false;
        }
        _rewriteSidebarLinks();
        return true;
    } catch (e) {
        // Network/CORS error — deny access (do NOT allow bypass)
        console.error('Secret key verification failed:', e.message);
        sessionStorage.removeItem('admin_key');
        window.location.href = '../index.html';
        return false;
    }
}

// ── Rewrite sidebar links to include secret key ───────────────
function _rewriteSidebarLinks() {
    const key = _getSecretKey();
    if (!key) return;
    document.querySelectorAll('.sidebar-nav a[href]').forEach(link => {
        const href = link.getAttribute('href');
        // Only rewrite local admin links (not external or ../index.html)
        if (href && !href.startsWith('http') && !href.startsWith('../') && !href.includes('?key=')) {
            link.setAttribute('href', `${href}?key=${encodeURIComponent(key)}`);
        }
    });
}

// ── Get current admin session ─────────────────────────────────
export function getAdminSession() {
    try {
        const raw = sessionStorage.getItem('admin_session');
        if (raw) {
            const s = JSON.parse(raw);
            if (s?.id && s?.email) return s;
        }
    } catch { sessionStorage.removeItem('admin_session'); }
    return null;
}

// ── Auth Guard ────────────────────────────────────────────────
export async function requireAuth() {
    // Priority 1: Supabase Auth session (secure, authenticated role)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        const customSession = getAdminSession();
        const displayName = customSession?.display_name || session.user.email.split('@')[0];
        const role = customSession?.role || 'admin';
        _applySessionToSidebar(session.user.email, displayName, role);
        if (!customSession) {
            sessionStorage.setItem('admin_session', JSON.stringify({
                id: session.user.id, email: session.user.email,
                display_name: displayName, role: role,
                login_at: new Date().toISOString(),
            }));
        }
        return customSession || { id: session.user.id, email: session.user.email, display_name: displayName, role };
    }

    // Priority 2: Custom session fallback (legacy installs)
    const customSession = getAdminSession();
    if (customSession) {
        _applySessionToSidebar(customSession.email, customSession.display_name, customSession.role);
        return customSession;
    }

    window.location.href = adminUrl('login.html');
    return null;
}

function _applySessionToSidebar(email, displayName, role) {
    const userNameEl = document.getElementById('sidebar-user-name');
    const userAvatarEl = document.getElementById('sidebar-user-avatar');
    const userRoleEl = document.querySelector('.sidebar-user-role');
    if (userNameEl) userNameEl.textContent = displayName || email;
    if (userAvatarEl) userAvatarEl.textContent = (displayName || email).charAt(0).toUpperCase();
    if (userRoleEl) userRoleEl.textContent = role || 'Admin';
}

// ── Logout ─────────────────────────────────────────────────────
export function initLogout() {
    const btn = document.getElementById('btn-logout');
    if (btn) {
        btn.addEventListener('click', async () => {
            const key = _getSecretKey();
            sessionStorage.removeItem('admin_session');
            await supabase.auth.signOut();
            window.location.href = adminUrl('login.html');
        });
    }
}

// ── Mobile Sidebar ────────────────────────────────────────────
export function initSidebar() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('admin-sidebar');
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
}

// ── Toast Notification ─────────────────────────────────────────
export function showToast(message, type = 'success') {
    let toast = document.getElementById('admin-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'admin-toast';
        toast.className = 'toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
    }
    toast.textContent = (type === 'success' ? '✓ ' : '✕ ') + message;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => toast.classList.remove('show'), 4000);
}

// ── Modal helpers ─────────────────────────────────────────────
export function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
}

export function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
}

export function initModalClose() {
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay')?.classList.remove('open');
        });
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('open');
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open'));
        }
    });
}

// ── Confirm Dialog ─────────────────────────────────────────────
export function showConfirm(message, onConfirm) {
    let overlay = document.getElementById('confirm-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'confirm-overlay';
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
      <div class="confirm-box" role="dialog" aria-modal="true" aria-label="Confirm action">
        <div class="confirm-icon">⚠️</div>
        <h3>Are you sure?</h3>
        <p id="confirm-message"></p>
        <div class="confirm-actions">
          <button class="btn btn-ghost-sm" id="confirm-cancel">Cancel</button>
          <button class="btn btn-danger btn-sm" id="confirm-ok">Delete</button>
        </div>
      </div>`;
        document.body.appendChild(overlay);
        document.getElementById('confirm-cancel').addEventListener('click', () => overlay.classList.remove('open'));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
    }
    document.getElementById('confirm-message').textContent = message;
    overlay.classList.add('open');
    const okBtn = document.getElementById('confirm-ok');
    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    newOk.addEventListener('click', () => {
        overlay.classList.remove('open');
        onConfirm();
    });
}

// ── Table row escaping ─────────────────────────────────────────
export function esc(str) {
    if (!str) return '—';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Fetch stats ────────────────────────────────────────────────
export async function loadStats() {
    const tables = ['experience', 'research', 'product', 'lecturing', 'community_services'];
    const ids = ['stat-experience', 'stat-research', 'stat-product', 'stat-lecturing', 'stat-community'];
    await Promise.all(tables.map(async (t, i) => {
        const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
        const el = document.getElementById(ids[i]);
        if (el) el.textContent = count ?? 0;
    }));
}

// ── Load sidebar brand from profile ────────────────────────────
// Fetches profile name and updates sidebar brand + page title dynamically
export async function loadSidebarBrand() {
    try {
        const { data, error } = await supabase
            .from('profile')
            .select('name, title, logo_text')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data?.name) return;

        const name = data.name;
        const initials = name.split(' ').map(w => w.charAt(0).toUpperCase()).join('').substring(0, 2);
        const logoText = data.logo_text || initials;

        // Update sidebar brand
        const brandName = document.querySelector('.sidebar-brand-name');
        if (brandName) brandName.textContent = `${logoText} Admin`;

        const brandSub = document.querySelector('.sidebar-brand-sub');
        if (brandSub) brandSub.textContent = 'Content Management System';

        // Update page title
        const pageName = document.querySelector('meta[name="admin-page-name"]')?.content || 'Admin';
        document.title = `${pageName} — ${name} CMS`;

        // Update login page branding
        const loginTitle = document.getElementById('login-brand-title');
        if (loginTitle) loginTitle.textContent = `${name} Portfolio`;

    } catch (e) {
        console.warn('loadSidebarBrand:', e);
    }
}
