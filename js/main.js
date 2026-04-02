// ============================================================
// main.js — Public Website Data Controller
// Fetches data from Supabase and renders all public sections
// ============================================================

import { supabase } from './supabase.js';

// ── Utility ──────────────────────────────────────────────────
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Profile ───────────────────────────────────────────────────
async function loadProfile() {
    const { data, error } = await supabase
        .from('profile')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) { console.warn('loadProfile:', error?.message); return; }

    // Cache-bust photo URL to ensure latest version after backend update
    const photoUrl = data.photo_url ? data.photo_url + (data.photo_url.includes('?') ? '&' : '?') + 't=' + Date.now() : null;
    const name = data.name || 'Portfolio';

    // Generate initials from name (e.g., "Adam Puspabhuana" → "AP")
    const initials = name.split(' ').map(w => w.charAt(0).toUpperCase()).join('').substring(0, 2);

    // ── Apply color theme ──
    if (data.theme && data.theme !== 'ocean') {
        document.documentElement.setAttribute('data-theme', data.theme);
    }

    // ── Apply layout ──
    if (data.layout && data.layout !== 'classic') {
        document.documentElement.setAttribute('data-layout', data.layout);
    }

    // ── Dynamic logo, title, footer (all pages) ──
    const logoText = data.logo_text || initials;
    qsa('.nav-logo-text').forEach(el => el.textContent = logoText);
    qsa('.footer-brand-name').forEach(el => el.textContent = name);
    const year = new Date().getFullYear();
    qsa('.footer-copyright-text').forEach(el => el.textContent = `\u00A9 ${year} ${name}. All rights reserved.`);
    qsa('.footer-brand-desc').forEach(el => {
        if (data.title) el.textContent = `${data.title} dedicated to advancing knowledge through rigorous research and meaningful collaboration.`;
    });

    // Page title
    const pageName = document.querySelector('meta[name="page-name"]')?.content || '';
    document.title = pageName ? `${pageName} \u2014 ${name}` : `${name} \u2014 Portfolio`;
    const ogTitle = qs('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = document.title;

    // Hero
    const heroName = qs('#hero-name');
    const heroTitle = qs('#hero-title');
    const heroTagline = qs('#hero-tagline');
    const heroBadge = qs('#hero-badge-text');
    const heroPhoto = qs('#hero-photo');
    const heroPlaceholder = qs('#hero-photo-placeholder');
    if (heroName) heroName.textContent = name;
    if (heroTitle) heroTitle.textContent = data.motto || data.title;
    if (heroTagline) heroTagline.textContent = data.bio;
    if (heroBadge && data.title) heroBadge.textContent = data.title;
    if (heroPhoto && photoUrl) {
        heroPhoto.addEventListener('load', () => {
            heroPhoto.style.opacity = '1';
            heroPhoto.style.position = 'relative';
            if (heroPlaceholder) heroPlaceholder.style.display = 'none';
        });
        heroPhoto.src = photoUrl;
        heroPhoto.alt = `Photo of ${name}`;
    }

    // About preview (index page)
    const aboutName = qs('#about-preview-name');
    const aboutBio = qs('#about-preview-bio');
    const aboutPreviewPhoto = qs('#about-preview-photo');
    const aboutPreviewPlaceholder = qs('#about-preview-photo-placeholder');
    if (aboutName) aboutName.textContent = name;
    if (aboutBio) aboutBio.textContent = data.bio;
    if (aboutPreviewPhoto && photoUrl) {
        aboutPreviewPhoto.addEventListener('load', () => {
            aboutPreviewPhoto.style.opacity = '1';
            aboutPreviewPhoto.style.position = 'relative';
            if (aboutPreviewPlaceholder) aboutPreviewPlaceholder.style.display = 'none';
        });
        aboutPreviewPhoto.src = photoUrl;
        aboutPreviewPhoto.alt = `Photo of ${name}`;
    }

    // About page specific fields
    const aboutPageName = qs('#about-name');
    const aboutPageTitle = qs('#about-title');
    const aboutPageBio = qs('#about-bio');
    const aboutPagePhoto = qs('#about-photo');
    const aboutPagePlaceholder = qs('#about-photo-placeholder');
    if (aboutPageName) aboutPageName.textContent = name;
    if (aboutPageTitle) aboutPageTitle.textContent = data.title || '';
    if (aboutPageBio) aboutPageBio.textContent = data.bio || '';
    if (aboutPagePhoto && photoUrl) {
        aboutPagePhoto.src = photoUrl;
        aboutPagePhoto.style.display = 'block';
        aboutPagePhoto.style.width = '160px';
        aboutPagePhoto.style.height = '160px';
        aboutPagePhoto.style.borderRadius = '50%';
        aboutPagePhoto.style.objectFit = 'cover';
        aboutPagePhoto.style.margin = '0 auto 1.5rem';
        if (aboutPagePlaceholder) aboutPagePlaceholder.style.display = 'none';
    }

    // Dispatch event for any page-level listeners
    window.dispatchEvent(new CustomEvent('profileLoaded', { detail: data }));
}

// ── Contact Info ──────────────────────────────────────────────
async function loadContactInfo() {
    const { data, error } = await supabase
        .from('contact_info')
        .select('*')
        .limit(1)
        .single();

    if (error || !data) { console.warn('loadContactInfo:', error?.message); return; }

    // data-contact elements (contact.html info card)
    const fields = ['email', 'linkedin', 'github', 'phone'];
    fields.forEach(field => {
        const el = qs(`[data-contact="${field}"]`);
        if (el && data[field]) {
            if (field === 'email') {
                el.href = `mailto:${data[field]}`;
                el.textContent = data[field];
            } else if (field === 'linkedin' || field === 'github') {
                el.href = data[field];
            } else {
                el.textContent = data[field];
            }
        }
    });

    // Footer links (all pages)
    const footerEmail = qs('#footer-email');
    const footerLinkedin = qs('#footer-linkedin');
    const footerGithub = qs('#footer-github');
    if (footerEmail && data.email) { footerEmail.href = `mailto:${data.email}`; footerEmail.textContent = data.email; }
    if (footerLinkedin && data.linkedin) { footerLinkedin.href = data.linkedin; }
    if (footerGithub && data.github) { footerGithub.href = data.github; }

    // Footer social icon links (index.html)
    const footerLinkedinIcon = qs('#footer-linkedin-icon');
    const footerGithubIcon = qs('#footer-github-icon');
    if (footerLinkedinIcon && data.linkedin) { footerLinkedinIcon.href = data.linkedin; }
    if (footerGithubIcon && data.github) { footerGithubIcon.href = data.github; }

    // Contact page social links
    const socialLinkedin = qs('#social-linkedin');
    const socialGithub = qs('#social-github');
    const socialEmail = qs('#social-email');
    if (socialLinkedin && data.linkedin) { socialLinkedin.href = data.linkedin; }
    if (socialGithub && data.github) { socialGithub.href = data.github; }
    if (socialEmail && data.email) { socialEmail.href = `mailto:${data.email}`; }

    // CTA email button (contact right card)
    const ctaEmail = qs('#contact-cta-email');
    if (ctaEmail && data.email) { ctaEmail.href = `mailto:${data.email}`; }

    // Address / location (contact right card)
    const contactAddress = qs('#contact-address');
    if (contactAddress && data.address) { contactAddress.textContent = data.address; }

    // Contact preview on index page
    const cpEmail = qs('#contact-preview-email');
    const cpLinkedin = qs('#contact-preview-linkedin');
    const cpGithub = qs('#contact-preview-github');
    const cpAddress = qs('#contact-preview-address');
    if (cpEmail && data.email) { cpEmail.href = `mailto:${data.email}`; cpEmail.textContent = data.email; }
    if (cpLinkedin && data.linkedin) { cpLinkedin.href = data.linkedin; }
    if (cpGithub && data.github) { cpGithub.href = data.github; }
    if (cpAddress && data.address) { cpAddress.textContent = data.address; }

    // Office hours (contact.html)
    const hoursWeekday = qs('#contact-hours-weekday');
    const hoursSaturday = qs('#contact-hours-saturday');
    const hoursSunday = qs('#contact-hours-sunday');
    if (hoursWeekday && data.hours_weekday) hoursWeekday.textContent = data.hours_weekday;
    if (hoursSaturday && data.hours_saturday) hoursSaturday.textContent = data.hours_saturday;
    if (hoursSunday && data.hours_sunday) hoursSunday.textContent = data.hours_sunday;

    // Quick Response (contact.html)
    const responseIcon = qs('#contact-response-icon');
    const responseTitle = qs('#contact-response-title');
    const responseText = qs('#contact-response-text');
    const responseInfo = qs('#contact-response-info');
    if (data.quick_response === 'off') {
        if (responseIcon) responseIcon.textContent = '🔴';
        if (responseTitle) responseTitle.textContent = 'Response Status';
        if (responseText) responseText.textContent = 'Currently not available for quick responses';
        if (responseInfo) responseInfo.style.opacity = '0.6';
    } else {
        if (responseIcon) responseIcon.textContent = '⚡';
        if (responseTitle) responseTitle.textContent = 'Quick Response';
        if (responseText) responseText.textContent = 'Typically responds within 24 hours';
    }

    // Availability badge (contact.html)
    const availBanner = qs('#contact-availability-banner');
    const availDot = qs('#contact-availability-dot');
    const availText = qs('#contact-availability-text');
    if (data.collab_status === 'busy') {
        if (availText) availText.textContent = 'Limited Availability';
        if (availDot) availDot.style.background = '#EAB308';
        if (availBanner) { availBanner.style.background = 'linear-gradient(135deg, rgba(234,179,8,.08), rgba(234,179,8,.02))'; availBanner.style.borderColor = 'rgba(234,179,8,.2)'; }
    } else if (data.collab_status === 'off') {
        if (availText) availText.textContent = 'Not Available for Collaboration';
        if (availDot) { availDot.style.background = '#EF4444'; availDot.style.animation = 'none'; }
        if (availBanner) { availBanner.style.background = 'linear-gradient(135deg, rgba(239,68,68,.08), rgba(239,68,68,.02))'; availBanner.style.borderColor = 'rgba(239,68,68,.2)'; }
    }

    // Collaboration description (contact.html)
    const collabText = qs('#contact-collab-text');
    if (collabText && data.collab_text) collabText.textContent = data.collab_text;
}

// ── Highlights / Stats ────────────────────────────────────────
async function loadHighlights() {
    const [researchRes, productRes, lecturingRes, csRes] = await Promise.all([
        supabase.from('research').select('id', { count: 'exact', head: true }),
        supabase.from('product').select('id', { count: 'exact', head: true }),
        supabase.from('lecturing').select('id', { count: 'exact', head: true }),
        supabase.from('community_services').select('id', { count: 'exact', head: true }),
    ]);

    const pubEl = qs('#pub-count');
    const prodEl = qs('#prod-count');
    const lectEl = qs('#lect-count');
    const csEl = qs('#cs-count');
    const pubVal = researchRes.count || 0;
    const prodVal = productRes.count || 0;
    const lectVal = lecturingRes.count || 0;
    const csVal = csRes.count || 0;

    if (pubEl) {
        pubEl.setAttribute('data-counter', pubVal);
        pubEl.textContent = pubVal + '+';
    }
    if (prodEl) {
        prodEl.setAttribute('data-counter', prodVal);
        prodEl.textContent = prodVal + '+';
    }
    if (lectEl) {
        lectEl.setAttribute('data-counter', lectVal);
        lectEl.textContent = lectVal + '+';
    }
    if (csEl) {
        csEl.setAttribute('data-counter', csVal);
        csEl.textContent = csVal + '+';
    }
}

// ── Featured Research (index page) ───────────────────────────
async function loadFeaturedResearch() {
    const container = qs('#featured-research');
    if (!container) return;

    const { data, error } = await supabase
        .from('research')
        .select('*')
        .order('year', { ascending: false })
        .limit(3);

    if (error || !data?.length) {
        container.innerHTML = '<p class="empty-state">No research data yet.</p>';
        return;
    }

    container.innerHTML = data.map(r => `
    <article class="research-card card-tilt" data-aos="fade-up">
      <div class="card-inner">
        <span class="card-badge">${escapeHtml(r.year)}</span>
        <h3 class="card-title">${escapeHtml(r.title)}</h3>
        <p class="card-meta">${escapeHtml(r.journal)}</p>
        <p class="card-excerpt">${escapeHtml(r.abstract?.substring(0, 120) || '')}${r.abstract?.length > 120 ? '…' : ''}</p>
        ${r.doi_link ? `<a href="${escapeHtml(r.doi_link)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">View DOI ↗</a>` : ''}
      </div>
    </article>
  `).join('');
}

// ── Featured Products (index page) ───────────────────────────
async function loadFeaturedProducts() {
    const container = qs('#featured-products');
    if (!container) return;

    const { data, error } = await supabase
        .from('product')
        .select('*')
        .order('year', { ascending: false })
        .limit(3);

    if (error || !data?.length) {
        container.innerHTML = '<p class="empty-state">No products data yet.</p>';
        return;
    }

    container.innerHTML = data.map(p => `
    <article class="product-card card-tilt" data-aos="fade-up">
      <div class="card-inner">
        <span class="card-badge product-badge">${escapeHtml(p.product_type)}</span>
        <h3 class="card-title">${escapeHtml(p.product_name)}</h3>
        <p class="card-meta">${escapeHtml(p.year)}</p>
        <p class="card-excerpt">${escapeHtml(p.description?.substring(0, 120) || '')}${p.description?.length > 120 ? '…' : ''}</p>
        ${p.demo_link ? `<a href="${escapeHtml(p.demo_link)}" target="_blank" rel="noopener" class="btn btn-sm btn-primary">Demo ↗</a>` : ''}
      </div>
    </article>
  `).join('');
}

// ── About Page — Timeline ─────────────────────────────────────
async function loadExperience() {
    const container = qs('#experience-timeline');
    if (!container) return;

    const { data, error } = await supabase
        .from('experience')
        .select('*')
        .order('start_year', { ascending: false });

    if (error || !data?.length) {
        container.innerHTML = '<p class="empty-state">No experience data yet.</p>';
        return;
    }

    container.innerHTML = data.map((exp, i) => `
    <div class="timeline-item" data-aos="fade-up" data-aos-delay="${i * 100}">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <span class="timeline-year">${escapeHtml(String(exp.start_year))} — ${exp.end_year ? escapeHtml(String(exp.end_year)) : 'Present'}</span>
        <h3 class="timeline-position">${escapeHtml(exp.position)}</h3>
        <p class="timeline-institution">${escapeHtml(exp.institution)}</p>
        <p class="timeline-desc">${escapeHtml(exp.description)}</p>
      </div>
    </div>
  `).join('');
}

// ── Featured Lecturing (index page) ──────────────────────────
async function loadFeaturedLecturing() {
    const container = qs('#featured-lecturing');
    if (!container) return;

    // Fallback static data (3 most recent courses)
    const fallbackData = [
        { course_name: 'Deep Learning', program: 'Data Science', semester: 'Semester 5', year: 2025, description: 'Advanced neural network architectures including CNNs, RNNs, transformers, and their applications in computer vision and NLP.' },
        { course_name: 'Software Engineering', program: 'Informatics', semester: 'Semester 4', year: 2025, description: 'Software development methodologies, requirements engineering, software architecture, testing, and project management.' },
        { course_name: 'Artificial Intelligence', program: 'Informatics', semester: 'Semester 5', year: 2025, description: 'Foundations of AI including search algorithms, knowledge representation, natural language processing, and expert systems.' },
    ];

    let courses = fallbackData;

    try {
        const { data, error } = await supabase
            .from('lecturing')
            .select('*')
            .order('year', { ascending: false })
            .limit(3);

        if (!error && data?.length) {
            courses = data;
        }
    } catch (e) {
        console.warn('loadFeaturedLecturing: using fallback data', e);
    }

    container.innerHTML = courses.map(r => `
    <article class="research-card card-tilt" data-aos="fade-up">
      <div class="card-inner">
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem;">
          <span class="card-badge product-badge">${escapeHtml(r.program)}</span>
          ${r.semester ? `<span class="card-badge">${escapeHtml(r.semester)} ${escapeHtml(String(r.year))}</span>` : `<span class="card-badge">${escapeHtml(String(r.year))}</span>`}
        </div>
        <h3 class="card-title">${escapeHtml(r.course_name)}</h3>
        ${r.description ? `<p class="card-excerpt">${escapeHtml(r.description?.substring(0, 120) || '')}${r.description?.length > 120 ? '…' : ''}</p>` : ''}
      </div>
    </article>
  `).join('');
}

// ── Lecturing Page ────────────────────────────────────────────
async function loadLecturing() {
    const container = qs('#lecturing-grid');
    if (!container) return;

    const searchInput = qs('#lecturing-search');
    const yearFilter = qs('#lecturing-year');
    const programFilter = qs('#lecturing-program');

    let allData = [];

    const render = (data) => {
        if (!data?.length) {
            container.innerHTML = '<p class="empty-state">No matching courses found.</p>';
            return;
        }
        container.innerHTML = data.map(r => `
      <article class="research-card card-tilt" data-aos="fade-up">
        <div class="card-inner">
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem;">
            <span class="card-badge product-badge">${escapeHtml(r.program)}</span>
            ${r.semester ? `<span class="card-badge">${escapeHtml(r.semester)} ${escapeHtml(String(r.year))}</span>` : `<span class="card-badge">${escapeHtml(String(r.year))}</span>`}
          </div>
          <h3 class="card-title">${escapeHtml(r.course_name)}</h3>
          ${r.description ? `<p class="card-excerpt">${escapeHtml(r.description)}</p>` : ''}
        </div>
      </article>
    `).join('');
        if (typeof AOS !== 'undefined') AOS.refresh();
    };

    const filterAndRender = () => {
        const q = searchInput?.value.toLowerCase().trim() || '';
        const year = yearFilter?.value || '';
        const program = programFilter?.value || '';
        let filtered = allData;
        if (q) filtered = filtered.filter(r =>
            r.course_name?.toLowerCase().includes(q) || r.program?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
        );
        if (year) filtered = filtered.filter(r => String(r.year) === year);
        if (program) filtered = filtered.filter(r => r.program === program);
        render(filtered);
    };

    const { data, error } = await supabase
        .from('lecturing')
        .select('*')
        .order('year', { ascending: false });

    if (error) { container.innerHTML = '<p class="empty-state">Failed to load courses.</p>'; return; }

    allData = data || [];

    // Populate year filter
    if (yearFilter) {
        const years = [...new Set(allData.map(r => r.year))].sort((a, b) => b - a);
        yearFilter.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    }

    // Populate program filter
    if (programFilter) {
        const programs = [...new Set(allData.map(r => r.program))].sort();
        programFilter.innerHTML = '<option value="">All Programs</option>' + programs.map(p => `<option value="${p}">${escapeHtml(p)}</option>`).join('');
    }

    render(allData);
    searchInput?.addEventListener('input', filterAndRender);
    yearFilter?.addEventListener('change', filterAndRender);
    programFilter?.addEventListener('change', filterAndRender);
}

// ── Research Page ─────────────────────────────────────────────
async function loadResearch() {
    const container = qs('#research-grid');
    if (!container) return;

    const searchInput = qs('#research-search');
    const yearFilter = qs('#research-year');

    let allData = [];

    const render = (data) => {
        if (!data?.length) {
            container.innerHTML = '<p class="empty-state">No matching publications found.</p>';
            return;
        }
        container.innerHTML = data.map(r => `
      <article class="research-card card-tilt" data-aos="fade-up">
        <div class="card-inner">
          <span class="card-badge">${escapeHtml(String(r.year))}</span>
          <h3 class="card-title">${escapeHtml(r.title)}</h3>
          <p class="card-meta">${escapeHtml(r.journal)}</p>
          <details class="card-abstract">
            <summary>Abstract</summary>
            <p>${escapeHtml(r.abstract)}</p>
          </details>
          ${r.doi_link ? `<a href="${escapeHtml(r.doi_link)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline mt-2">View DOI ↗</a>` : ''}
        </div>
      </article>
    `).join('');
        if (typeof AOS !== 'undefined') AOS.refresh();
    };

    const filterAndRender = () => {
        const q = searchInput?.value.toLowerCase().trim() || '';
        const year = yearFilter?.value || '';
        let filtered = allData;
        if (q) filtered = filtered.filter(r =>
            r.title?.toLowerCase().includes(q) || r.journal?.toLowerCase().includes(q) || r.abstract?.toLowerCase().includes(q)
        );
        if (year) filtered = filtered.filter(r => String(r.year) === year);
        render(filtered);
    };

    const { data, error } = await supabase
        .from('research')
        .select('*')
        .order('year', { ascending: false });

    if (error) { container.innerHTML = '<p class="empty-state">Failed to load publications.</p>'; return; }

    allData = data || [];

    // Populate year filter
    if (yearFilter) {
        const years = [...new Set(allData.map(r => r.year))].sort((a, b) => b - a);
        yearFilter.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    }

    render(allData);
    searchInput?.addEventListener('input', filterAndRender);
    yearFilter?.addEventListener('change', filterAndRender);
}

// ── Product Page ──────────────────────────────────────────────
async function loadProducts() {
    const container = qs('#product-grid');
    if (!container) return;

    const { data, error } = await supabase
        .from('product')
        .select('*')
        .order('year', { ascending: false });

    if (error || !data?.length) {
        container.innerHTML = '<p class="empty-state">No products available yet.</p>';
        return;
    }

    container.innerHTML = data.map(p => `
    <article class="product-card card-tilt" data-aos="fade-up">
      <div class="card-inner">
        <span class="card-badge product-badge">${escapeHtml(p.product_type)}</span>
        <h3 class="card-title">${escapeHtml(p.product_name)}</h3>
        <p class="card-meta">${escapeHtml(String(p.year))}</p>
        <p class="card-excerpt">${escapeHtml(p.description)}</p>
        ${p.demo_link ? `<a href="${escapeHtml(p.demo_link)}" target="_blank" rel="noopener" class="btn btn-sm btn-primary mt-2">Live Demo ↗</a>` : ''}
      </div>
    </article>
  `).join('');
    if (typeof AOS !== 'undefined') AOS.refresh();
}

// ── Featured Community Services (index page) ─────────────────
async function loadFeaturedCommunityServices() {
    const container = qs('#featured-community');
    if (!container) return;

    const { data, error } = await supabase
        .from('community_services')
        .select('*')
        .order('year', { ascending: false })
        .limit(3);

    if (error || !data?.length) {
        container.innerHTML = '<p class="empty-state">No community service data yet.</p>';
        return;
    }

    container.innerHTML = data.map(r => `
    <article class="research-card card-tilt" data-aos="fade-up">
      <div class="card-inner">
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem;">
          <span class="card-badge product-badge">${escapeHtml(r.role)}</span>
          <span class="card-badge">${escapeHtml(String(r.year))}</span>
        </div>
        <h3 class="card-title">${escapeHtml(r.title)}</h3>
        <p class="card-meta">${escapeHtml(r.organization)}</p>
        <p class="card-excerpt">${escapeHtml(r.description?.substring(0, 120) || '')}${r.description?.length > 120 ? '…' : ''}</p>
        ${r.link ? `<a href="${escapeHtml(r.link)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">Learn More ↗</a>` : ''}
      </div>
    </article>
  `).join('');
}

// ── Community Services Page ───────────────────────────────────
async function loadCommunityServices() {
    const container = qs('#cs-grid');
    if (!container) return;

    const searchInput = qs('#cs-search');
    const yearFilter = qs('#cs-year');
    const roleFilter = qs('#cs-role');

    let allData = [];

    const render = (data) => {
        if (!data?.length) {
            container.innerHTML = '<p class="empty-state">No matching activities found.</p>';
            return;
        }
        container.innerHTML = data.map(r => `
      <article class="research-card card-tilt" data-aos="fade-up">
        <div class="card-inner">
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem;">
            <span class="card-badge product-badge">${escapeHtml(r.role)}</span>
            <span class="card-badge">${escapeHtml(String(r.year))}</span>
          </div>
          <h3 class="card-title">${escapeHtml(r.title)}</h3>
          <p class="card-meta">${escapeHtml(r.organization)}</p>
          ${r.description ? `<p class="card-excerpt">${escapeHtml(r.description)}</p>` : ''}
          ${r.link ? `<a href="${escapeHtml(r.link)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline mt-2">Learn More ↗</a>` : ''}
        </div>
      </article>
    `).join('');
        if (typeof AOS !== 'undefined') AOS.refresh();
    };

    const filterAndRender = () => {
        const q = searchInput?.value.toLowerCase().trim() || '';
        const year = yearFilter?.value || '';
        const role = roleFilter?.value || '';
        let filtered = allData;
        if (q) filtered = filtered.filter(r =>
            r.title?.toLowerCase().includes(q) || r.organization?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
        );
        if (year) filtered = filtered.filter(r => String(r.year) === year);
        if (role) filtered = filtered.filter(r => r.role === role);
        render(filtered);
    };

    const { data, error } = await supabase
        .from('community_services')
        .select('*')
        .order('year', { ascending: false });

    if (error) { container.innerHTML = '<p class="empty-state">Failed to load activities.</p>'; return; }

    allData = data || [];

    // Populate year filter
    if (yearFilter) {
        const years = [...new Set(allData.map(r => r.year))].sort((a, b) => b - a);
        yearFilter.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    }

    // Populate role filter
    if (roleFilter) {
        const roles = [...new Set(allData.map(r => r.role))].sort();
        roleFilter.innerHTML = '<option value="">All Roles</option>' + roles.map(r => `<option value="${r}">${escapeHtml(r)}</option>`).join('');
    }

    render(allData);
    searchInput?.addEventListener('input', filterAndRender);
    yearFilter?.addEventListener('change', filterAndRender);
    roleFilter?.addEventListener('change', filterAndRender);
}

// ── Contact Form ──────────────────────────────────────────────
async function initContactForm() {
    const form = qs('#contact-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type="submit"]');
        const statusEl = qs('#form-status');

        const name = form.querySelector('#msg-name')?.value.trim();
        const email = form.querySelector('#msg-email')?.value.trim();
        const message = form.querySelector('#msg-message')?.value.trim();

        if (!name || !email || !message) {
            if (statusEl) { statusEl.textContent = 'Please fill in all fields.'; statusEl.className = 'form-status error'; }
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Sending…';

        const { error } = await supabase.from('messages').insert([{ name, email, message }]);

        if (error) {
            if (statusEl) { statusEl.textContent = 'Failed to send. Please try again.'; statusEl.className = 'form-status error'; }
        } else {
            if (statusEl) { statusEl.textContent = '✓ Message sent successfully!'; statusEl.className = 'form-status success'; }
            form.reset();
        }

        btn.disabled = false;
        btn.textContent = 'Send Message';
    });
}

// ── Init ──────────────────────────────────────────────────────
(async () => {
    await Promise.all([
        loadProfile(),
        loadContactInfo(),
        loadHighlights(),
        loadFeaturedLecturing(),
        loadFeaturedResearch(),
        loadFeaturedProducts(),
        loadFeaturedCommunityServices(),
        loadExperience(),
        loadLecturing(),
        loadResearch(),
        loadProducts(),
        loadCommunityServices(),
        initContactForm(),
    ]);
})();
