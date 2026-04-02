// ============================================================
// animations.js — Animation & UI Interaction Controller
// Handles: AOS init, GSAP hero, navbar scroll, parallax
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

    // ── AOS (Animate on Scroll) Initialization ──────────────────
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 700,
            easing: 'ease-out-cubic',
            once: true,
            offset: 60,
            delay: 50,
        });
    }

    // ── Navbar Scroll Effect ─────────────────────────────────────
    const navbar = document.getElementById('navbar');
    if (navbar) {
        const onScroll = () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll(); // run on load
    }

    // ── Mobile Menu Toggle ───────────────────────────────────────
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
            menuToggle.classList.toggle('active');
        });
        // Close menu on link click
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('open');
                menuToggle.classList.remove('active');
            });
        });
    }

    // ── Smooth Scroll for anchor links ──────────────────────────
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ── GSAP Hero Entrance Animation ─────────────────────────────
    if (typeof gsap !== 'undefined') {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        if (document.querySelector('.hero-badge')) {
            tl.from('.hero-badge', { y: 20, opacity: 0, duration: 0.6 })
                .from('.hero-title', { y: 40, opacity: 0, duration: 0.7 }, '-=0.3')
                .from('.hero-tagline', { y: 20, opacity: 0, duration: 0.6 }, '-=0.4')
                .from('.hero-cta-group', { y: 20, opacity: 0, duration: 0.6 }, '-=0.3')
                .from('.hero-photo-wrapper', { scale: 0.85, opacity: 0, duration: 0.8 }, '-=0.6');
        }
    }

    // ── Parallax Hero ─────────────────────────────────────────────
    const heroBg = document.querySelector('.hero-bg-parallax');
    if (heroBg) {
        window.addEventListener('scroll', () => {
            const offset = window.scrollY * 0.35;
            heroBg.style.transform = `translateY(${offset}px)`;
        }, { passive: true });
    }

    // ── Counter Animations (Highlights section) ────────────────
    const counters = document.querySelectorAll('[data-counter]');
    if (counters.length > 0) {
        const animateCounter = (el) => {
            const target = parseInt(el.getAttribute('data-counter'), 10);
            if (!target || target <= 0) return; // Skip if value not yet loaded
            let current = 0;
            const step = Math.max(1, Math.floor(target / 60));
            const timer = setInterval(() => {
                current += step;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                el.textContent = current + (el.dataset.suffix || '');
            }, 20);
        };

        // Use IntersectionObserver to trigger when visible
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const val = parseInt(entry.target.getAttribute('data-counter'), 10);
                    if (val > 0) {
                        animateCounter(entry.target);
                        observer.unobserve(entry.target);
                    }
                }
            });
        }, { threshold: 0.5 });
        counters.forEach(c => observer.observe(c));

        // Also observe attribute changes for dynamically updated counters
        const attrObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-counter') {
                    const el = mutation.target;
                    const val = parseInt(el.getAttribute('data-counter'), 10);
                    if (val > 0) {
                        // Re-observe with IntersectionObserver for scroll-triggered animation
                        observer.observe(el);
                    }
                }
            });
        });
        counters.forEach(c => attrObserver.observe(c, { attributes: true, attributeFilter: ['data-counter'] }));
    }

    // ── Active Nav Link highlighting ─────────────────────────────
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('#nav-links a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });

    // ── Card hover tilt micro-interaction ────────────────────────
    document.querySelectorAll('.card-tilt').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
            const y = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
            card.style.transform = `perspective(800px) rotateX(${y}deg) rotateY(${x}deg) translateY(-4px)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });

});
