import { fetchAvisData } from './avis-data.js';
import './contact-wizard.js';
import { sendContactEmail } from './contact-email.js';

document.documentElement.classList.add('js');

// Choix assumé : toutes les animations sont jouées pour tout le monde (même avec « réduire les animations »).
const reduceMotion = false;

/* ---------- Année ---------- */
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

const header = document.querySelector('[data-header]');
const hero = document.querySelector('.hero');

/* ---------- Menu mobile ---------- */
const menuToggle = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');
function setMenu(open) {
  menu.hidden = !open;
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.querySelector('.sr-only').textContent = open ? 'Fermer le menu' : 'Ouvrir le menu';
  header.classList.toggle('menu-is-open', open);
  if (open) menu.style.top = `${Math.max(0, header.getBoundingClientRect().bottom)}px`;
  document.body.classList.toggle('menu-open', open);
}
menuToggle?.addEventListener('click', () => setMenu(menu.hidden));
menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu && !menu.hidden) { setMenu(false); menuToggle.focus(); }
});
window.matchMedia('(min-width: 835px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

/* ---------- Lien de nav actif ---------- */
const navLinks = [...document.querySelectorAll('.gnav__links a')].filter((a) => (a.getAttribute('href') || '').startsWith('#'));
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === `#${entry.target.id}`));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
navLinks.forEach((a) => { const s = document.querySelector(a.getAttribute('href')); if (s) sectionObserver.observe(s); });

/* ---------- Vidéo du hero ---------- */
(function initHeroVideo() {
  const video = document.getElementById('hero-video');
  const btn = document.querySelector('[data-video-toggle]');
  if (!video) return;
  // Téléphones : version 720p plus légère (≈ 2,8 Mo au lieu de 7,7 Mo)
  const mobileSrc = video.dataset.srcMobile;
  if (mobileSrc && window.matchMedia('(max-width: 834px)').matches) video.src = mobileSrc;
  const sync = () => {
    const paused = video.paused;
    btn?.classList.toggle('is-paused', paused);
    btn?.setAttribute('aria-label', paused ? 'Lire la vidéo' : 'Mettre la vidéo en pause');
  };
  video.addEventListener('playing', () => { video.classList.add('is-playing'); sync(); });
  video.addEventListener('pause', sync);
  btn?.addEventListener('click', () => { if (video.paused) video.play().catch(() => {}); else video.pause(); });
  if (reduceMotion) { if (btn) btn.hidden = false; sync(); return; }
  const startVideo = () => video.play().then(() => { if (btn) btn.hidden = false; }).catch(() => { if (btn) btn.hidden = false; sync(); });
  // Premier lancement : la vidéo attend la fin du chargement pour démarrer depuis le début
  const loaderShown = document.querySelector('[data-loader]') && !document.documentElement.classList.contains('no-loader');
  if (loaderShown) {
    video.pause();
    video.preload = 'auto'; // le début se met en mémoire pendant le chargement
    document.addEventListener('site-ready', () => {
      try { video.currentTime = 0; } catch (_) { /* ignore */ }
      startVideo();
    }, { once: true });
  } else {
    startVideo();
  }
  // Pause hors écran pour économiser batterie et data.
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting && !video.paused) { video.dataset.autoPaused = '1'; video.pause(); }
    else if (entry.isIntersecting && video.dataset.autoPaused) { delete video.dataset.autoPaused; video.play().catch(() => {}); }
  }).observe(video);
})();

/* ---------- Chargement : la barre se charge au rythme réel du site ---------- */
(function initLoader() {
  const loader = document.querySelector('[data-loader]');
  // Squelette : chaque image pas encore chargée affiche une zone grise animée
  const markPending = (img) => {
    if (img.complete && img.naturalWidth) return;
    img.classList.add('is-pending');
    const done = () => img.classList.remove('is-pending');
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  };
  document.querySelectorAll('main img, .gfoot img').forEach(markPending);
  if (!loader) return;

  const plates = [1, 2, 3, 4].map((k) => loader.querySelectorAll(`.ld-p${k}`));
  const collars = loader.querySelectorAll('.ld-collar');
  const kgEl = loader.querySelector('[data-loader-kg]');
  const pctEl = loader.querySelector('[data-loader-pct]');
  const fill = loader.querySelector('[data-loader-fill]');
  const PLATE_KG = [20, 15, 10, 5];          // par disque, posé de chaque côté
  const THRESHOLDS = [0.2, 0.45, 0.7, 0.9];  // moment où chaque paire de disques se pose
  // Déjà vu dans la session : pas de chargement (le squelette des images suffit)
  if (document.documentElement.classList.contains('no-loader')) { loader.remove(); return; }
  const seen = false;

  // Tâches réellement attendues (avec un poids et un délai maximum chacune)
  const tasks = [];
  const track = (weight, promise, maxMs) => {
    const t = { weight, done: false };
    tasks.push(t);
    Promise.race([promise, new Promise((r) => setTimeout(r, maxMs))]).then(() => { t.done = true; });
  };
  const imgReady = (img) => new Promise((r) => {
    if (!img || (img.complete && img.naturalWidth)) return r();
    img.addEventListener('load', r, { once: true });
    img.addEventListener('error', r, { once: true });
  });
  track(1, Promise.resolve(), 0);
  track(1, document.fonts ? document.fonts.ready : Promise.resolve(), 2500);
  track(2, imgReady(document.querySelector('.hero__media img')), 4000);
  track(1, imgReady(document.querySelector('.gnav__brand img')), 3000);
  const video = document.getElementById('hero-video');
  track(3, new Promise((r) => {
    if (!video || video.readyState >= 2) return r();
    video.addEventListener('loadeddata', r, { once: true });
    video.addEventListener('error', r, { once: true });
  }), 2500);
  track(2, document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true })), 3500);
  const total = tasks.reduce((n, t) => n + t.weight, 0);
  const real = () => tasks.reduce((n, t) => n + (t.done ? t.weight : 0), 0) / total;

  const start = performance.now();
  const MIN_MS = seen ? 0 : 1300;   // le temps de voir la barre se charger
  const MAX_MS = seen ? 900 : 4500; // jamais bloqué plus longtemps (déjà vu dans la session : quasi immédiat)
  let shown = 0;
  let finished = false;

  function paint(p) {
    const kg = 20 + PLATE_KG.reduce((n, w, i) => n + (p >= THRESHOLDS[i] ? w * 2 : 0), 0);
    plates.forEach((els, i) => els.forEach((el) => el.classList.toggle('is-on', p >= THRESHOLDS[i])));
    collars.forEach((el) => el.classList.toggle('is-on', p >= 0.999));
    if (kgEl) kgEl.textContent = String(kg);
    if (pctEl) pctEl.textContent = `${Math.round(p * 100)} %`;
    fill?.style.setProperty('--p', p.toFixed(3));
  }
  function finish() {
    if (finished) return;
    finished = true;
    paint(1);
    try { sessionStorage.setItem('nc-loader', '1'); } catch (_) { /* ignore */ }
    const lift = reduceMotion || seen ? 0 : 450;
    loader.classList.add('is-lift');
    setTimeout(() => {
      loader.classList.add('is-done');
      loader.setAttribute('aria-busy', 'false');
      document.dispatchEvent(new CustomEvent('site-ready'));
      setTimeout(() => loader.classList.add('is-gone'), 900);
    }, lift);
  }
  function tick(now) {
    if (finished) return;
    const elapsed = now - start;
    // la barre ne dépasse jamais le chargement réel ni le temps minimum d'affichage
    const cap = Math.min(real(), MIN_MS ? Math.min(1, elapsed / MIN_MS) : 1);
    shown += (cap - shown) * (seen ? 1 : 0.12);
    if (cap - shown < 0.004) shown = cap;
    paint(shown);
    if ((shown >= 1 && elapsed >= MIN_MS) || elapsed >= MAX_MS) { finish(); return; }
    requestAnimationFrame(tick);
  }
  loader.setAttribute('aria-busy', 'true');
  requestAnimationFrame(tick);
  // filet de sécurité indépendant de l'animation (mise en pause par le navigateur si l'onglet est en arrière-plan)
  setTimeout(finish, MAX_MS + 200);
})();

/* ---------- Carrousels : boutons précédent / suivant ---------- */
function bindPaddles(track, prev, next) {
  if (!track || !prev || !next) return;
  const step = () => {
    const item = track.firstElementChild;
    return item ? item.getBoundingClientRect().width + 20 : 320;
  };
  const sync = () => {
    prev.disabled = track.scrollLeft < 8;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
  };
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' }));
  track.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync, { passive: true });
  sync();
  return sync;
}
bindPaddles(
  document.querySelector('[data-gallery-track]'),
  document.querySelector('[data-gallery-prev]'),
  document.querySelector('[data-gallery-next]'),
);

/* ---------- Sélecteur du haut → colonne du comparateur ---------- */
document.querySelectorAll('[data-chooser]').forEach((link) => {
  link.addEventListener('click', () => {
    const col = document.querySelector(`.ccol[data-col="${link.dataset.chooser}"]`);
    const scroller = document.querySelector('[data-compare]');
    if (!col || !scroller) return;
    window.setTimeout(() => {
      scroller.scrollTo({ left: col.offsetLeft - scroller.offsetLeft - 22, behavior: reduceMotion ? 'auto' : 'smooth' });
      col.classList.remove('is-flash');
      void col.offsetWidth;
      col.classList.add('is-flash');
      window.setTimeout(() => col.classList.remove('is-flash'), 1600);
    }, reduceMotion ? 0 : 450);
  });
});

/* ---------- Apparition au scroll ---------- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-in'); revealObserver.unobserve(entry.target); }
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
document.querySelectorAll('main .headline, .section-sub').forEach((el) => el.classList.add('reveal'));
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 70}ms`;
  revealObserver.observe(el);
});

/* ---------- Compteurs (chiffres qui roulent) ---------- */
const ODO_EASE_MS = 1700;
function buildOdometer(el, value) {
  const digits = String(value).split('');
  const n = digits.length;
  el.textContent = '';
  el.classList.add('odo');
  el.setAttribute('aria-label', String(value));
  digits.forEach((ch, i) => {
    const d = Number(ch);
    const turns = n - i; // le chiffre de droite tourne le plus
    const col = document.createElement('span');
    col.className = 'odo__d';
    col.setAttribute('aria-hidden', 'true');
    const ghost = document.createElement('span');
    ghost.className = 'odo__ghost';
    ghost.textContent = ch;
    const strip = document.createElement('span');
    strip.className = 'odo__strip';
    for (let k = 0; k <= turns * 10 + d; k += 1) {
      const g = document.createElement('span');
      g.textContent = String(k % 10);
      strip.appendChild(g);
    }
    strip.style.setProperty('--to', String(turns * 10 + d));
    strip.style.transitionDelay = `${(n - 1 - i) * 90}ms`;
    col.append(ghost, strip);
    el.appendChild(col);
  });
}
function setCounterValue(el, value) {
  el.dataset.count = String(value);
  if (el.classList.contains('odo')) {
    el.textContent = String(value);
    el.classList.remove('odo');
    el.removeAttribute('aria-label');
  } else {
    el.textContent = String(value);
  }
}
(function initCounters() {
  const els = [...document.querySelectorAll('[data-count]')];
  if (!els.length) return;
  if (reduceMotion) {
    els.forEach((el) => el.closest('li')?.classList.add('is-counted'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      const el = entry.target;
      const item = el.closest('li');
      const order = item ? [...item.parentElement.children].indexOf(item) : 0;
      buildOdometer(el, el.dataset.count);
      // départ décalé par colonne, puis effet de fin
      setTimeout(() => {
        requestAnimationFrame(() => {
          el.classList.add('is-rolling');
          const digits = el.querySelectorAll('.odo__d').length;
          setTimeout(() => {
            el.classList.add('is-settled');
            item?.classList.add('is-counted');
          }, ODO_EASE_MS + (digits - 1) * 90);
        });
      }, 120 + order * 140);
    });
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
})();

/* ---------- CTA collant (mobile) ---------- */
(function initFloatingCta() {
  const root = document.querySelector('[data-fcta]');
  if (!root) return;
  const bar = root.querySelector('[data-fcta-bar]');
  const panel = root.querySelector('[data-fcta-panel]');
  const openBtn = root.querySelector('[data-fcta-open]');
  let open = false;
  let shown = false;

  function setOpen(v) {
    if (v === open) return;
    open = v;
    openBtn.setAttribute('aria-expanded', String(v));
    root.classList.toggle('is-open', v);
    if (v) {
      panel.hidden = false;
      requestAnimationFrame(() => root.classList.add('is-panel'));
      setTimeout(() => panel.querySelector('a')?.focus({ preventScroll: true }), 60);
    } else {
      root.classList.remove('is-panel');
      setTimeout(() => { if (!open) panel.hidden = true; }, reduceMotion ? 0 : 320);
      openBtn.focus({ preventScroll: true });
    }
  }
  openBtn.addEventListener('click', () => setOpen(!open));
  root.querySelectorAll('[data-fcta-close]').forEach((el) => el.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) setTimeout(() => setOpen(false), 50); });

  // Visible après le hero, masquée là où elle gênerait la lecture ou l'action
  const zones = [...document.querySelectorAll('[data-fcta-hide], .gfoot, #contact')];
  function update() {
    const y = window.scrollY;
    const pastHero = !hero || y > window.innerHeight * 0.4 + hero.offsetHeight * 0.75;
    const vh = window.innerHeight;
    const r = bar.getBoundingClientRect();
    const top = Math.min(r.top || vh - 90, vh - 90);
    const blocked = zones.some((z) => {
      const b = z.getBoundingClientRect();
      return b.top < vh - 8 && b.bottom > top - 8;
    });
    const show = open || (pastHero && !blocked);
    if (show !== shown) {
      shown = show;
      root.classList.toggle('is-visible', show);
      bar.inert = !show;
    }
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  bar.inert = true;
  update();
})();

/* ---------- Préremplissage du formulaire depuis une offre ---------- */
// Sur la page contact, les liens d'offre cochent la case et descendent au formulaire sans recharger la page.
// Ailleurs, le lien emmène sur /contact.html?suivi=… et le formulaire se préremplit au chargement.
document.querySelectorAll('[data-prefill]').forEach((link) => {
  link.addEventListener('click', (e) => {
    if (!document.getElementById('contact-form')) return;
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('suivi:select', { detail: link.dataset.prefill }));
  });
});

/* ---------- Avis Google ---------- */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STAR_SVG = '<svg viewBox="0 0 20 20" width="18" height="18"><path fill="currentColor" d="M10 1.6l2.47 5.3 5.8.68-4.29 3.95 1.15 5.73L10 14.4l-5.13 2.86 1.15-5.73L1.73 7.58l5.8-.68z"/></svg>';
/* Petits monstres (avatars des avis) : générés à partir du prénom, toujours les mêmes pour une personne. */
const MONSTER_COLORS = ['#f6d7c3', '#e4ecd9', '#ece0f2', '#f5eddc', '#f3d9de', '#dfe9e4', '#f1e4cf', '#e6e1f4'];
function monsterSvg(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const pick = (n) => { const v = h % n; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; return v; };
  const ink = '#1d1d1f';
  const bg = MONSTER_COLORS[pick(MONSTER_COLORS.length)];
  const body = MONSTER_COLORS[(MONSTER_COLORS.indexOf(bg) + 3 + pick(4)) % MONSTER_COLORS.length];
  const bodies = [
    'M10 46V24a14 14 0 0 1 28 0v22z',
    'M8 46c0-14 4-30 16-30s16 16 16 30z',
    'M9 46V22c0-4 3-7 7-7h16c4 0 7 3 7 7v24z',
    'M7 46c1-10-2-16 2-22 3-5 9-8 15-8s12 3 15 8c4 6 1 12 2 22z',
  ];
  const tops = [
    '',
    `<path d="M15 19l-3-8 7 5M33 19l3-8-7 5" fill="${body}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path d="M20 16c-1-4-3-6-5-7M28 16c1-4 3-6 5-7" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/><circle cx="15" cy="9" r="2" fill="${ink}"/><circle cx="33" cy="9" r="2" fill="${ink}"/>`,
    `<path d="M24 16v-6" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/><circle cx="24" cy="9" r="2.4" fill="${ink}"/>`,
  ];
  const eye = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${ink}" stroke-width="1.4"/><circle cx="${x + 0.6}" cy="${y + 0.6}" r="${r * 0.45}" fill="${ink}"/>`;
  const eyes = [
    () => eye(24, 27, 5),
    () => eye(19, 27, 3.4) + eye(29, 27, 3.4),
    () => eye(17, 28, 2.8) + eye(24, 25, 3.2) + eye(31, 28, 2.8),
    () => `<path d="M16 27q3-3 6 0M26 27q3-3 6 0" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`,
  ];
  const mouths = [
    `<path d="M19 36q5 4 10 0" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`,
    `<path d="M19 35h10q0 5-5 5t-5-5z" fill="${ink}"/><path d="M21 35v2l1.5-2M27 35v2l-1.5-2" fill="#fff"/>`,
    `<ellipse cx="24" cy="37" rx="2.6" ry="2" fill="${ink}"/>`,
    `<path d="M18 36q2 2 4 0q2 2 4 0q2 2 4 0" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`,
  ];
  const blush = pick(2) ? '<circle cx="15" cy="34" r="2" fill="#f2a7a0" opacity=".6"/><circle cx="33" cy="34" r="2" fill="#f2a7a0" opacity=".6"/>' : '';
  return `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect width="48" height="48" fill="${bg}"/>` +
    tops[pick(tops.length)] +
    `<path d="${bodies[pick(bodies.length)]}" fill="${body}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>` +
    eyes[pick(eyes.length)]() + mouths[pick(mouths.length)] + blush + '</svg>';
}

function reviewCard(review) {
  const name = review.name || 'Avis Google';
  const rating = Math.max(0, Math.min(5, Math.round(Number(review.rating) || 5)));
  const stars = Array.from({ length: 5 }, (_, i) => `<span class="${i < rating ? 'is-on' : ''}">${STAR_SVG}</span>`).join('');
  const avatar = `<span class="review__avatar review__avatar--monster" aria-hidden="true">${monsterSvg(name + (review.date || ''))}</span>`;
  const article = document.createElement('article');
  article.className = 'review';
  article.innerHTML =
    '<span class="review__quote" aria-hidden="true">“</span>' +
    `<span class="review__stars" role="img" aria-label="${rating} étoiles sur 5">${stars}</span>` +
    `<blockquote class="review__text">${escapeHtml(review.text)}</blockquote>` +
    '<button type="button" class="review__more" hidden aria-expanded="false">Voir plus</button>' +
    `<div class="review__author">${avatar}<div><p class="review__name">${escapeHtml(name)}</p>` +
    `<p class="review__meta">Avis Google${review.date ? ` · ${escapeHtml(review.date)}` : ''}</p></div></div>`;
  return article;
}

/* Ouverture / fermeture progressive d'un avis (« Voir plus ») */
function setReviewOpen(card, open) {
  const text = card.querySelector('.review__text');
  const btn = card.querySelector('.review__more');
  if (btn) { btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'Réduire' : 'Voir plus'; }
  if (!text) return;
  const finish = () => {
    text.style.height = '';
    text.style.transition = '';
    card.classList.remove('is-closing');
    if (!open) card.classList.remove('is-open');
  };
  if (reduceMotion) { card.classList.toggle('is-open', open); return; }
  const from = text.getBoundingClientRect().height;
  let to;
  if (open) {
    card.classList.add('is-open');
    to = text.scrollHeight;
  } else {
    // hauteur repliée mesurée sans casser l'affichage du texte complet pendant l'animation
    card.classList.remove('is-open');
    to = text.getBoundingClientRect().height;
    card.classList.add('is-open', 'is-closing');
  }
  text.style.height = `${from}px`;
  text.getBoundingClientRect();
  text.style.transition = 'height .55s cubic-bezier(.22, 1, .36, 1)';
  text.style.height = `${to}px`;
  clearTimeout(text._t);
  text._t = setTimeout(finish, 580);
}

function measureReviews(track) {
  track.querySelectorAll('.review').forEach((card) => {
    if (card.classList.contains('is-open')) return;
    const text = card.querySelector('.review__text');
    const btn = card.querySelector('.review__more');
    btn.hidden = text.scrollHeight <= text.clientHeight + 2;
  });
}

(async function initReviews() {
  const track = document.querySelector('[data-reviews-track]');
  if (!track) return;
  const prev = document.querySelector('[data-reviews-prev]');
  const next = document.querySelector('[data-reviews-next]');
  const data = await fetchAvisData();

  if (data?.googleTotal) {
    document.querySelectorAll('[data-review-total]').forEach((el) => {
      if (el.hasAttribute('data-count')) {
        // compteur pas encore lancé : on change juste la cible ; déjà fini : on remplace le texte
        if (el.classList.contains('is-settled')) setCounterValue(el, data.googleTotal);
        else if (!el.classList.contains('odo')) { el.dataset.count = String(data.googleTotal); el.textContent = String(data.googleTotal); }
      } else {
        el.textContent = data.googleTotal;
      }
    });
  }
  const avg = Number(data?.googleRating);
  const avgEl = document.querySelector('[data-review-avg]');
  if (avgEl && avg > 0) {
    avgEl.textContent = avg.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    avgEl.hidden = false;
    avgEl.setAttribute('aria-label', `Note moyenne ${avgEl.textContent} sur 5`);
  }
  const reviews = (data?.reviews || []).filter((r) => r && r.text);
  if (!reviews.length) {
    track.insertAdjacentHTML('beforeend', '<p class="reviews__empty">Les avis sont à lire directement sur Google.</p>');
    prev.hidden = next.hidden = true;
    return;
  }
  reviews.forEach((r) => track.appendChild(reviewCard(r)));
  measureReviews(track);
  window.addEventListener('resize', () => measureReviews(track), { passive: true });

  track.addEventListener('click', (e) => {
    const btn = e.target.closest('.review__more');
    if (!btn) return;
    const card = btn.closest('.review');
    setReviewOpen(card, !card.classList.contains('is-open'));
  });

  const step = () => {
    const card = track.querySelector('.review');
    return card ? card.getBoundingClientRect().width + 16 : 320;
  };
  const bar = document.querySelector('[data-reviews-progress]');
  // Mobile : points sous les avis ; celui en cours s'allonge en trait qui se remplit, puis l'avis suivant arrive.
  const dotsEl = document.querySelector('[data-reviews-dots]');
  const renderDots = () => {
    if (!dotsEl) return;
    const n = track.querySelectorAll('.review').length;
    if (n < 2) { dotsEl.innerHTML = ''; return; }
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
    const i = atEnd ? n - 1 : Math.min(n - 1, Math.round(track.scrollLeft / step()));
    const MAX = 7;
    const start = Math.max(0, Math.min(i - 3, n - MAX));
    const end = Math.min(n, start + MAX);
    let html = '';
    for (let k = start; k < end; k++) {
      const edge = (k === start && start > 0) || (k === end - 1 && end < n);
      html += `<span class="${k === i ? 'is-on' : ''}${edge ? ' is-edge' : ''}"><b></b></span>`;
    }
    if (dotsEl.innerHTML !== html) dotsEl.innerHTML = html;
  };
  const syncButtons = () => {
    renderDots();
    prev.disabled = track.scrollLeft < 8;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
    track.classList.toggle('is-scrolled', track.scrollLeft > 8);
    if (bar) {
      const ratio = Math.min(1, track.clientWidth / (track.scrollWidth || 1));
      const max = track.scrollWidth - track.clientWidth;
      const p = max > 0 ? track.scrollLeft / max : 0;
      bar.style.width = `${ratio * 100}%`;
      bar.style.transform = `translateX(${(p * (1 - ratio) / (ratio || 1)) * 100}%)`;
    }
  };
  window.addEventListener('resize', syncButtons, { passive: true });
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' }));
  // dès qu'on passe à un autre avis, les cartes ouvertes (« Voir plus ») se referment
  const collapseAll = () => {
    track.querySelectorAll('.review.is-open:not(.is-closing)').forEach((card) => setReviewOpen(card, false));
  };
  let lastLeft = track.scrollLeft;
  track.addEventListener('scroll', () => {
    if (Math.abs(track.scrollLeft - lastLeft) > 24) { lastLeft = track.scrollLeft; collapseAll(); }
    syncButtons();
  }, { passive: true });
  prev.addEventListener('click', collapseAll);
  next.addEventListener('click', collapseAll);
  syncButtons();

  // Défilement automatique, avec minuteur dans la barre sous les flèches.
  // En pause si un avis est ouvert (« Voir plus ») ou hors écran.
  if (reduceMotion || !bar) return;
  const INTERVAL = 6000;
  const section = track.closest('section');
  let elapsed = 0, last = 0, visible = false;
  const progress = bar.parentElement;
  const isRunning = () => visible && !document.hidden
    && !track.querySelector('.review.is-open') && track.scrollWidth > track.clientWidth + 8;
  const reset = () => { elapsed = 0; bar.style.setProperty('--t', '0'); dotsEl?.style.setProperty('--t', '0'); };
  const advance = () => {
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 8) {
      track.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      track.scrollBy({ left: step(), behavior: 'smooth' });
    }
  };
  const loop = (now) => {
    const dt = last ? now - last : 0;
    last = now;
    const running = isRunning();
    progress.classList.toggle('is-auto', running);
    if (running) {
      elapsed += dt;
      if (elapsed >= INTERVAL) { reset(); advance(); }
      bar.style.setProperty('--t', String(Math.min(1, elapsed / INTERVAL)));
      dotsEl?.style.setProperty('--t', String(Math.min(1, elapsed / INTERVAL)));
    }
    requestAnimationFrame(loop);
  };
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0.35 }).observe(section || track);
  // toute action manuelle relance le compte à rebours
  [prev, next].forEach((b) => b.addEventListener('click', reset));
  track.addEventListener('pointerdown', reset, { passive: true });
  track.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) reset(); }, { passive: true });
  requestAnimationFrame(loop);
})();

/* ---------- Formulaire de contact : champ « Autre » et envoi ---------- */
(function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const sourceAutreRow = form.querySelector('.contact-dark__field-source-autre');
  const syncSourceAutre = () => {
    if (!sourceAutreRow) return;
    const checked = form.querySelector('input[name="source"]:checked');
    const show = Boolean(checked && checked.value === 'autre');
    sourceAutreRow.toggleAttribute('hidden', !show);
    if (!show) { const input = sourceAutreRow.querySelector('input'); if (input) input.value = ''; }
  };
  form.querySelectorAll('input[name="source"]').forEach((r) => r.addEventListener('change', syncSourceAutre));
  form.addEventListener('reset', () => setTimeout(syncSourceAutre));
  syncSourceAutre();

  const submitBtn = form.querySelector('.form-wizard__submit');
  const feedback = document.getElementById('contact-form-feedback');
  const defaultHtml = submitBtn ? submitBtn.innerHTML.trim() : 'Envoyer ma fiche →';

  const resetButton = () => {
    if (!submitBtn) return;
    submitBtn.classList.remove('is-sending', 'is-success');
    submitBtn.disabled = false;
    submitBtn.removeAttribute('aria-busy');
    submitBtn.innerHTML = defaultHtml;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!submitBtn || submitBtn.disabled) return;
    submitBtn.classList.add('is-sending');
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.innerHTML = '<span class="contact-dark__submit-spinner" aria-hidden="true"></span><span>Envoi en cours…</span>';
    if (feedback) { feedback.hidden = true; feedback.textContent = ''; }

    sendContactEmail(form)
      .then(() => {
        submitBtn.classList.remove('is-sending');
        submitBtn.removeAttribute('aria-busy');
        // Écran de fin : « c'est envoyé, on te répond »
        const done = document.querySelector('[data-form-done]');
        const prenom = (form.elements.prenom?.value || '').trim();
        if (done) {
          const nameSlot = done.querySelector('[data-done-name]');
          if (nameSlot) nameSlot.textContent = prenom ? `, ${prenom}` : '';
          form.hidden = true;
          done.hidden = false;
          requestAnimationFrame(() => requestAnimationFrame(() => done.classList.add('is-in')));
          const card = done.closest('.contact__card') || done;
          const top = card.getBoundingClientRect().top + window.scrollY - (document.querySelector('.gnav')?.offsetHeight || 0) - 20;
          window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
          setTimeout(() => done.focus({ preventScroll: true }), 400);
        } else if (feedback) {
          feedback.textContent = 'Merci ! Ta fiche a bien été envoyée. Je te réponds sous 24 à 48 h.';
          feedback.hidden = false;
        }
        // le formulaire est remis à zéro en coulisses
        resetButton();
        form.reset();
        syncSourceAutre();
        window.contactWizard?.setStep?.(1, { scroll: false, focus: false });
      })
      .catch((error) => {
        console.error('Échec de l’envoi du formulaire.');
        resetButton();
        if (feedback) {
          feedback.textContent = error?.message || 'L’envoi a échoué. Réessaie dans un instant.';
          feedback.hidden = false;
        }
      });
  });
})();

/* ---------- Essentiels : accordéon de cartes piloté au scroll ---------- */
(function initAccordion() {
  // Carrousel « Les essentiels » : piloté en continu par le scroll (même principe que Reliz).
  // Une position a ∈ [0, n-1] suit le scroll avec un léger amorti ; chaque carte reçoit --o
  // (0 = fermée, 1 = ouverte) et le CSS en déduit sa largeur et l'opacité de ses textes.
  const section = document.getElementById('essentiels');
  const list = section?.querySelector('[data-acc]');
  if (!section || !list) return;
  const items = [...list.querySelectorAll('[data-acc-item]')];
  const hits = [...list.querySelectorAll('[data-acc-hit]')];
  const prev = section.querySelector('[data-acc-prev]');
  const next = section.querySelector('[data-acc-next]');
  const current = section.querySelector('[data-acc-current]');
  const total = section.querySelector('[data-acc-total]');
  const pin = section.querySelector('.ess__pin');
  const pad = (k) => String(k).padStart(2, '0');
  const n = items.length;
  const last = n - 1;
  if (total) total.textContent = pad(n);

  const pinned = !reduceMotion;
  let range = 0;       // distance de scroll pour passer de la 1re à la dernière carte
  let shown = -1;      // position affichée (lissée)
  let raf = 0;
  let index = -1;
  const navH = () => document.querySelector('.gnav')?.getBoundingClientRect().height || 0;

  function paint(a) {
    items.forEach((item, k) => {
      const o = Math.max(0, 1 - Math.abs(k - a));
      item.style.setProperty('--o', o.toFixed(3));
    });
    const cur = Math.round(a);
    if (cur !== index) {
      index = cur;
      items.forEach((item, k) => item.classList.toggle('is-active', k === cur));
      hits.forEach((hit, k) => hit.setAttribute('aria-expanded', String(k === cur)));
      if (current) current.textContent = pad(cur + 1);
      if (prev) prev.disabled = cur === 0;
      if (next) next.disabled = cur === last;
    }
  }
  const target = () => {
    const offset = navH() - section.getBoundingClientRect().top;
    return Math.min(1, Math.max(0, offset / (range || 1))) * last;
  };
  function tick() {
    const goal = target();
    shown = shown < 0 ? goal : shown + (goal - shown) * 0.1;
    if (Math.abs(goal - shown) < 0.001) shown = goal;
    paint(shown);
    raf = shown === goal ? 0 : requestAnimationFrame(tick);
  }
  const wake = () => { if (pinned && !raf) raf = requestAnimationFrame(tick); };

  function measure() {
    if (!pinned) { paint(Math.max(0, index)); return; }
    section.classList.add('is-pinned');
    range = Math.max(400, window.innerHeight * 0.8) * last;
    section.style.height = `${pin.offsetHeight + range}px`;
    shown = -1;
    tick();
  }
  function go(k) {
    k = Math.max(0, Math.min(last, k));
    if (!pinned) { paint(k); return; }
    const top = window.scrollY + section.getBoundingClientRect().top - navH() + (k / last) * range + 1;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  hits.forEach((hit, k) => hit.addEventListener('click', () => go(k)));
  prev?.addEventListener('click', () => go(index - 1));
  next?.addEventListener('click', () => go(index + 1));
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('load', measure);
  paint(0);
  measure();
})();

/* ---------- Manifeste : mots et photos révélés au scroll ---------- */
(function initManifesto() {
  const text = document.querySelector('[data-manifesto]');
  if (!text) return;
  // Découpe chaque mot dans un span, en gardant les pastilles photo telles quelles.
  [...text.childNodes].forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE) return;
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
      const span = document.createElement('span');
      span.className = 'mword';
      span.textContent = part;
      frag.appendChild(span);
    });
    node.replaceWith(frag);
  });
  const tokens = [...text.querySelectorAll('.mword, .mpill')];
  text.setAttribute('aria-label', text.textContent.replace(/\s+/g, ' ').trim());

  if (reduceMotion) { tokens.forEach((t) => t.classList.add('is-on')); return; }
  text.classList.add('is-armed');

  let ticking = false;
  function update() {
    ticking = false;
    const r = text.getBoundingClientRect();
    const vh = window.innerHeight;
    // Commence quand le haut du texte atteint 85 % de l'écran, finit quand le bas passe à 62 %.
    const start = vh * 0.85;
    const end = vh * 0.62;
    const progress = Math.min(1, Math.max(0, (start - r.top) / (r.height + start - end)));
    const count = Math.round(progress * tokens.length);
    tokens.forEach((t, i) => t.classList.toggle('is-on', i < count));
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
})();

/* ---------- À propos : 4 cartes qui s'allument au scroll ---------- */
(function initSteps4() {
  const root = document.querySelector('[data-steps4]');
  if (!root) return;
  const cards = [...root.querySelectorAll('[data-card4]')];
  const dots = [...root.querySelectorAll('.steps4__dot')];
  const fill = root.querySelector('[data-steps4-fill]');
  const n = cards.length;
  if (reduceMotion) { cards.forEach((c) => c.classList.add('is-on')); dots.forEach((d) => d.classList.add('is-on')); if (fill) fill.style.setProperty('--p', '1'); return; }
  let ticking = false;
  function update() {
    ticking = false;
    const vh = window.innerHeight;
    const stacked = window.innerWidth <= 1068;
    let reached = 0;
    let p = 0;
    if (stacked) {
      // Cartes empilées : chacune s'allume quand elle passe aux 3/4 de l'écran.
      cards.forEach((c, i) => { if (c.getBoundingClientRect().top < vh * 0.78) reached = i + 1; });
    } else {
      const r = root.getBoundingClientRect();
      const start = vh * 0.8;
      const end = vh * 0.25;
      p = Math.min(1, Math.max(0, (start - r.top) / (start - end)));
      if (r.top < start) reached = Math.min(n, Math.floor(p * (n - 1) + 1e-6) + 1);
    }
    cards.forEach((c, i) => { c.classList.toggle('is-on', i < reached); c.classList.toggle('is-current', i === reached - 1); });
    dots.forEach((d, i) => { d.classList.toggle('is-on', i < reached); d.classList.toggle('is-current', i === reached - 1); });
    if (fill) fill.style.setProperty('--p', p.toFixed(4));
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();

/* ---------- Page contact : suivi présélectionné (lien ou bulle) ---------- */
(function initContactPick() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const picks = [...document.querySelectorAll('[data-pick]')];
  function select(value, { highlight = false } = {}) {
    const box = form.querySelector(`input[name="type_accompagnement[]"][value="${value}"]`);
    if (!box) return;
    box.checked = true;
    const group = ['bilan', 'programme'].includes(value) ? 'carte' : value; // bilan et programme sont dans « Bilan & séances »
    picks.forEach((p) => p.classList.toggle('is-picked', p.dataset.pick === group));
    if (highlight) {
      const section = document.getElementById('contact');
      section?.classList.remove('is-highlight');
      void section?.offsetWidth;
      section?.classList.add('is-highlight');
    }
  }
  // Choix confirmé depuis la fenêtre de détail ou le comparatif : seule cette case est cochée, puis on descend au formulaire
  document.addEventListener('suivi:select', (e) => {
    const value = e.detail;
    form.querySelectorAll('input[name="type_accompagnement[]"]').forEach((box) => { box.checked = box.value === value; });
    select(value, { highlight: true });
    const target = document.getElementById('contact');
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - (document.querySelector('.gnav')?.offsetHeight || 0) - 12;
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  });
  // Rappel du choix en haut du formulaire, mis à jour à chaque case cochée ou décochée
  const chip = form.querySelector('[data-form-choice]');
  const chipLabel = chip?.querySelector('[data-form-choice-label]');
  const syncChip = () => {
    if (!chip) return;
    const names = [...form.querySelectorAll('input[name="type_accompagnement[]"]:checked')]
      .map((box) => {
        const title = box.closest('label, .contact-option-card')?.querySelector('.contact-option-card__title');
        // texte du titre seul, sans le badge (« Le plus complet »)
        const text = title ? [...title.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('') : box.value;
        return text.replace(/\s+/g, ' ').trim();
      });
    chip.hidden = !names.length;
    if (chipLabel) chipLabel.textContent = names.join(' + ');
  };
  form.addEventListener('change', (e) => { if (e.target.name === 'type_accompagnement[]') syncChip(); });
  form.addEventListener('reset', () => setTimeout(syncChip));
  document.addEventListener('suivi:select', syncChip);

  const params = new URLSearchParams(window.location.search);
  if (params.get('bilan') === '1') select('bilan');
  const fromUrl = params.get('suivi');
  if (fromUrl && /^[a-z]+$/.test(fromUrl)) {
    form.querySelectorAll('input[name="type_accompagnement[]"]').forEach((box) => { box.checked = false; });
    select(fromUrl, { highlight: true });
    // on arrive directement sur la fiche, avec le rappel du choix visible
    window.addEventListener('load', () => setTimeout(() => {
      const card = form.closest('.contact__card') || form;
      const top = card.getBoundingClientRect().top + window.scrollY - (document.querySelector('.gnav')?.offsetHeight || 0) - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    }, 150), { once: true });
  }
  syncChip();
})();

/* ---------- Plans : flèches du carrousel, affichées seulement s'il déborde ---------- */
(function initPlansCarousel() {
  const track = document.querySelector('[data-plans]');
  const ctrl = document.querySelector('[data-plans-ctrl]');
  if (!track || !ctrl) return;
  const stage = document.querySelector('[data-plans-stage]');
  const pin = document.querySelector('[data-plans-pin]');
  const prev = ctrl.querySelector('[data-plans-prev]');
  const next = ctrl.querySelector('[data-plans-next]');
  const dots = [...document.querySelectorAll('[data-plans-dots] [data-dot]')];
  const cards = [...track.querySelectorAll('.plan')];
  const navH = () => document.querySelector('.gnav')?.getBoundingClientRect().height || 0;

  // Mode « épinglé » : la section reste fixe et le scroll vertical fait défiler les cartes.
  let pinned = false;
  let max = 0;        // décalage horizontal total (px)
  let range = 0;      // distance de scroll vertical correspondante (px)
  let hold = 0;       // petite pause sur la dernière carte avant de relâcher
  let offsets = [];   // position de chaque carte dans le défilement
  let shift = 0;

  const cardIndex = (x) => {
    if (x >= max - 4) return cards.length - 1;
    let best = 0, dist = Infinity;
    offsets.forEach((o, i) => { const d = Math.abs(o - x); if (d < dist) { dist = d; best = i; } });
    return best;
  };
  const position = () => (pinned ? shift : track.scrollLeft);
  function syncUi() {
    const x = position();
    const i = cardIndex(x);
    dots.forEach((d, k) => { d.classList.toggle('is-on', k === i); d.setAttribute('aria-selected', String(k === i)); });
    prev.disabled = x < 8;
    next.disabled = x >= max - 8;
  }
  function render() {
    if (!pinned) return;
    const top = stage.getBoundingClientRect().top;
    const stick = parseFloat(pin.style.top) || 0;
    const p = Math.min(1, Math.max(0, (stick - top) / ((range - hold) || 1)));
    shift = p * max;
    track.style.transform = `translate3d(${-shift}px, 0, 0)`;
    syncUi();
  }
  function goTo(i) {
    i = Math.max(0, Math.min(cards.length - 1, i));
    const x = Math.min(max, offsets[i] || 0);
    if (pinned) {
      const stick = parseFloat(pin.style.top) || 0;
      const y = stage.getBoundingClientRect().top + window.scrollY - stick + (x / (max || 1)) * (range - hold);
      window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    } else {
      track.scrollTo({ left: x, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }
  function measure() {
    // mesure en mode natif
    pinned = false;
    stage?.classList.remove('is-pinned');
    if (stage) stage.style.height = '';
    if (pin) pin.style.top = '';
    track.style.transform = '';
    max = Math.max(0, track.scrollWidth - track.clientWidth);
    offsets = cards.map((c) => c.offsetLeft - cards[0].offsetLeft);
    ctrl.hidden = max <= 4;
    const avail = window.innerHeight - navH() - 24;
    if (stage && pin && !reduceMotion && max > 4 && pin.offsetHeight <= avail) {
      pinned = true;
      track.scrollLeft = 0;
      stage.classList.add('is-pinned');
      hold = Math.round(window.innerHeight * 0.2);
      range = Math.round(max * 2) + hold;
      const h = pin.offsetHeight;
      // centré dans l'espace sous la nav
      pin.style.top = `${Math.round(navH() + Math.max(16, (window.innerHeight - navH() - h) / 2))}px`;
      stage.style.height = `${h + range}px`;
      render();
    }
    syncUi();
  }

  prev.addEventListener('click', () => goTo(cardIndex(position()) - 1));
  next.addEventListener('click', () => goTo(cardIndex(position()) + 1));
  dots.forEach((d, k) => d.addEventListener('click', () => goTo(k)));
  track.addEventListener('scroll', () => requestAnimationFrame(syncUi), { passive: true });
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!pinned || ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; render(); });
  }, { passive: true });
  let rt;
  const remeasure = () => { clearTimeout(rt); rt = setTimeout(measure, 120); };
  window.addEventListener('resize', remeasure, { passive: true });
  window.addEventListener('load', measure);
  document.fonts?.ready.then(remeasure);
  // les polices / images peuvent changer la hauteur des cartes après coup
  if ('ResizeObserver' in window) {
    let lastH = 0;
    new ResizeObserver(() => {
      const h = cards[0]?.offsetHeight || 0;
      if (Math.abs(h - lastH) > 1) { lastH = h; remeasure(); }
    }).observe(cards[0]);
  }
  measure();
})();

/* ---------- Avant / après ---------- */
(function initBeforeAfter() {
  const root = document.querySelector('[data-ba]');
  if (!root) return;
  const stage = root.querySelector('[data-ba-stage]');
  const range = root.querySelector('[data-ba-range]');
  const before = root.querySelector('[data-ba-before]');
  const after = root.querySelector('[data-ba-after]');
  const story = root.querySelector('[data-ba-story]');
  const picks = [...root.querySelectorAll('.ba-pick')];
  // « Fais défiler » seulement s'il y a vraiment des élèves cachés à droite
  const pickList = root.querySelector('.ba-picks');
  const hint = root.querySelector('.ba-picks__hint');
  const syncHint = () => { if (hint && pickList) hint.hidden = pickList.scrollWidth <= pickList.clientWidth + 4 || pickList.scrollLeft > 24; };
  pickList?.addEventListener('scroll', syncHint, { passive: true });
  window.addEventListener('resize', syncHint, { passive: true });
  requestAnimationFrame(syncHint);
  const field = (k) => root.querySelector(`[data-ba-${k}]`);
  let interacted = false;

  function setPos(v) {
    v = Math.max(0, Math.min(100, v));
    stage.style.setProperty('--pos', `${v}%`);
    range.value = String(Math.round(v));
    stage.classList.toggle('is-near-left', v < 14);
    stage.classList.toggle('is-near-right', v > 86);
  }
  const fromEvent = (e) => {
    const r = stage.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  };
  stage.addEventListener('pointerdown', (e) => {
    interacted = true;
    stage.classList.add('is-dragging');
    stage.setPointerCapture?.(e.pointerId);
    setPos(fromEvent(e));
  });
  stage.addEventListener('pointermove', (e) => {
    if (stage.classList.contains('is-dragging')) setPos(fromEvent(e));
  });
  const stop = () => stage.classList.remove('is-dragging');
  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', stop);
  range.addEventListener('input', () => { interacted = true; setPos(Number(range.value)); });

  const fill = (el, src, label) => {
    el.innerHTML = src
      ? `<img src="${src}" alt="${label}" decoding="async">`
      : `<span class="ba__ph">${label.startsWith('Avant') ? 'Photo avant' : 'Photo après'}</span>`;
  };
  const viewsBox = root.querySelector('[data-ba-views]');
  const viewBtns = viewsBox ? [...viewsBox.querySelectorAll('[data-view]')] : [];
  const VIEW_LABEL = { face: 'vue de face', cote: 'vue de côté', dos: 'vue de dos' };
  let view = 'face';
  const photo = (d, v, k) => (d.photos ? `/avant-apres/${d.photos}-${v}-${k}.jpg` : (k === 'avant' ? d.before : d.after));
  function setText(key, value) {
    const el = field(key);
    if (!el) return;
    el.textContent = value || '';
    el.hidden = !value;
  }
  function show(pick) {
    const d = pick.dataset;
    const views = (d.views || 'face').split(',');
    if (!views.includes(view)) view = views[0];
    viewBtns.forEach((b) => {
      const ok = views.includes(b.dataset.view);
      b.hidden = !ok;
      b.setAttribute('aria-pressed', String(b.dataset.view === view));
    });
    if (viewsBox) viewsBox.hidden = views.length < 2;
    fill(before, photo(d, view, 'avant'), `Avant — ${d.name}, ${VIEW_LABEL[view] || ''}`);
    fill(after, photo(d, view, 'apres'), `Après — ${d.name}, ${VIEW_LABEL[view] || ''}`);
    // titre : le résultat s'il est renseigné, sinon le prénom / l'élève
    setText('result', d.result || d.name);
    setText('meta', [d.label, d.time && `en ${d.time}`, d.plan].filter(Boolean).join(' · '));
    setText('text', d.text);
    setText('name', d.result ? d.name : '');
  }
  const swap = (fn) => {
    if (reduceMotion) { fn(); setPos(50); return; }
    story.classList.add('is-swapping');
    stage.style.opacity = '.4';
    setTimeout(() => { fn(); setPos(50); story.classList.remove('is-swapping'); stage.style.opacity = ''; }, 220);
  };
  viewBtns.forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.dataset.view === view) return;
    view = b.dataset.view;
    const pick = picks.find((p) => p.classList.contains('is-on')) || picks[0];
    swap(() => show(pick));
  }));
  viewsBox?.addEventListener('pointerdown', (e) => e.stopPropagation());
  picks.forEach((pick) => {
    pick.addEventListener('click', () => {
      if (pick.classList.contains('is-on')) return;
      picks.forEach((p) => { p.classList.toggle('is-on', p === pick); p.setAttribute('aria-pressed', String(p === pick)); });
      swap(() => show(pick));
    });
  });
  stage.style.transition = 'opacity .3s var(--ease)';
  const first = picks.find((p) => p.classList.contains('is-on')) || picks[0];
  if (first) show(first);
  setPos(50);

  // petit aller-retour du curseur à l'arrivée pour montrer qu'on peut le bouger
  if (reduceMotion) return;
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    const keys = [50, 30, 70, 50];
    const dur = 1800;
    const t0 = performance.now() + 300;
    const tick = (now) => {
      if (interacted) return;
      const t = Math.min(1, Math.max(0, (now - t0) / dur));
      const seg = Math.min(keys.length - 2, Math.floor(t * (keys.length - 1)));
      const local = t * (keys.length - 1) - seg;
      const e = local < 0.5 ? 2 * local * local : 1 - Math.pow(-2 * local + 2, 2) / 2;
      setPos(keys[seg] + (keys[seg + 1] - keys[seg]) * e);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { threshold: 0.5 });
  io.observe(stage);
})();

/* ---------- FAQ : onglets + ouverture en douceur ---------- */
(function initFaq() {
  const faq = document.querySelector('[data-faq]');
  if (!faq) return;
  const items = [...faq.querySelectorAll('.faq__item')];
  const EASE = 'cubic-bezier(.22, 1, .36, 1)';

  function animate(item, open) {
    const answer = item.querySelector('.faq__answer');
    if (reduceMotion || !answer) { item.open = open; return; }
    clearTimeout(answer._t);
    if (open) {
      item.open = true;
      const h = answer.scrollHeight;
      answer.style.height = '0px';
      answer.style.opacity = '0';
      answer.getBoundingClientRect();
      answer.style.transition = `height .5s ${EASE}, opacity .4s ${EASE} .08s`;
      answer.style.height = `${h}px`;
      answer.style.opacity = '1';
    } else {
      answer.style.height = `${answer.getBoundingClientRect().height}px`;
      answer.getBoundingClientRect();
      answer.style.transition = `height .45s ${EASE}, opacity .25s ${EASE}`;
      answer.style.height = '0px';
      answer.style.opacity = '0';
    }
    answer._t = setTimeout(() => {
      if (!open) item.open = false;
      answer.style.height = answer.style.opacity = answer.style.transition = '';
    }, open ? 520 : 470);
  }

  items.forEach((item) => {
    item.querySelector('summary').addEventListener('click', (e) => {
      e.preventDefault();
      const willOpen = !item.open || item.querySelector('.faq__answer').style.height === '0px';
      // une seule question ouverte à la fois
      if (willOpen) items.forEach((other) => { if (other !== item && other.open) animate(other, false); });
      animate(item, willOpen);
    });
  });

  const tabs = [...document.querySelectorAll('[data-faq-tab]')];
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    if (tab.classList.contains('is-on')) return;
    const cat = tab.dataset.faqTab;
    tabs.forEach((t) => { const on = t === tab; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', String(on)); });
    let k = 0;
    items.forEach((item) => {
      const show = item.dataset.faqCat === cat;
      item.open = false;
      item.hidden = !show;
      item.classList.remove('is-entering');
      if (show && !reduceMotion) {
        item.style.animationDelay = `${k * 60}ms`;
        void item.offsetWidth;
        item.classList.add('is-entering');
        k += 1;
      }
    });
  }));
})();

/* ---------- Retour en haut : la page « rembobine » jusqu'au hero ---------- */
document.querySelectorAll('[data-to-top]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const start = window.scrollY;
    if (reduceMotion || start < 10) { window.scrollTo({ top: 0, behavior: 'auto' }); return; }
    // durée proportionnelle à la distance, pour qu'on voie défiler les sections à l'envers
    const dur = Math.min(2200, Math.max(1000, start * 0.22));
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    const opts = { passive: true, once: true };
    window.addEventListener('wheel', cancel, opts);
    window.addEventListener('touchstart', cancel, opts);
    window.addEventListener('keydown', cancel, { once: true });
    const step = (now) => {
      if (cancelled) return;
      const t = Math.min(1, (now - t0) / dur);
      window.scrollTo({ top: Math.round(start * (1 - ease(t))), behavior: 'instant' });
      if (t < 1) requestAnimationFrame(step);
      else {
        window.removeEventListener('wheel', cancel);
        window.removeEventListener('touchstart', cancel);
        document.querySelector('.gnav__brand')?.focus({ preventScroll: true });
      }
    };
    requestAnimationFrame(step);
  });
});

/* ---------- Détail d'un suivi : carte agrandie par-dessus la page ---------- */
// Fenêtre superposée (fond flouté, page figée derrière, Échap, clic dehors, focus piégé)
function makeOverlay(modal, closeAttr) {
  const panel = modal.querySelector('.pmodal__panel');
  let lastFocus = null;
  let closeTimer = 0;
  function show() {
    clearTimeout(closeTimer);
    lastFocus = document.activeElement;
    modal.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
    panel.scrollTop = 0;
    setTimeout(() => panel.focus({ preventScroll: true }), 30);
  }
  function hide({ restoreFocus = true } = {}) {
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    closeTimer = setTimeout(() => { modal.hidden = true; }, reduceMotion ? 0 : 380);
    if (restoreFocus) lastFocus?.focus?.({ preventScroll: true });
  }
  modal.querySelectorAll(`[${closeAttr}]`).forEach((el) => el.addEventListener('click', () => hide()));
  // Bloque le scroll de la page sans toucher à sa mise en page (rien ne bouge derrière la carte)
  const blockScroll = (e) => {
    if (modal.hidden) return;
    const scroller = e.target.closest?.('.cmp__scroll');
    if (scroller && e.type === 'wheel' && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const inPanel = panel.contains(e.target);
    const scrollable = panel.scrollHeight > panel.clientHeight + 1;
    if (!inPanel || (!scrollable && !scroller)) { e.preventDefault(); return; }
    if (e.type === 'wheel' && scrollable) {
      const atTop = panel.scrollTop <= 0 && e.deltaY < 0;
      const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1 && e.deltaY > 0;
      if (atTop || atBottom) e.preventDefault();
    } else if (e.type === 'wheel' && !scrollable) e.preventDefault();
  };
  modal.addEventListener('wheel', blockScroll, { passive: false });
  modal.addEventListener('touchmove', blockScroll, { passive: false });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') hide();
    if (e.key === 'Tab') {
      const items = [...panel.querySelectorAll('a, button')].filter((el) => !el.hidden);
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  return { show, hide, panel };
}

// Page contact : choisir un suivi coche la bonne case et descend jusqu'au formulaire
const onContactPage = () => Boolean(document.getElementById('contact-form'));
function chooseSuivi(key) {
  document.dispatchEvent(new CustomEvent('suivi:select', { detail: key }));
}

/* ---------- Détail d'un suivi : carte agrandie par-dessus la page ---------- */
(function initPlanModal() {
  const modal = document.querySelector('[data-pmodal]');
  if (!modal) return;
  const overlay = makeOverlay(modal, 'data-pmodal-close');
  const { panel } = overlay;
  const $ = (k) => modal.querySelector(`[data-pmodal-${k}]`);
  const link = $('cta');
  let currentKey = '';

  function open(card) {
    const img = card.querySelector('.plan__media img');
    $('media').innerHTML = img ? `<img src="${img.getAttribute('src')}" alt="" style="${img.getAttribute('style') || ''}">` : '';
    $('kicker').textContent = card.querySelector('.plan__kicker')?.textContent || '';
    $('title').innerHTML = card.querySelector('.plan__name')?.innerHTML || '';
    $('ideal').textContent = card.querySelector('.plan__ideal')?.textContent || '';
    $('feats').innerHTML = card.querySelector('.plan__feats')?.innerHTML || '';
    const key = card.dataset.key || card.querySelector('.plan__cta')?.dataset.prefill || '';
    currentKey = key;
    // durée d'engagement (affichée sur la carte BeCome, commune aux autres suivis ; aucune pour Bilan & séances)
    if (key !== 'carte') {
      const engagement = [...card.querySelectorAll('.plan__rows div')].find((d) => /engagement/i.test(d.querySelector('dt')?.textContent || ''))?.querySelector('dd')?.textContent
        || '4, 6 ou 12 mois · au mois possible';
      $('feats').insertAdjacentHTML('beforeend', `<li><strong>Engagement</strong>${engagement}</li>`);
    }
    $('price').textContent = card.querySelector('.plan__price strong')?.textContent || '';
    const cta = card.querySelector('.plan__cta');
    if (onContactPage()) {
      link.href = '#contact';
      link.firstChild.textContent = key === 'carte' ? 'Choisir bilan & séances' : 'Choisir ce suivi';
    } else if (cta) {
      link.href = cta.getAttribute('href');
      link.firstChild.textContent = cta.textContent.trim() === 'En parler' ? 'En parler avec Néfélie' : 'Choisir ce suivi';
    }
    panel.classList.toggle('is-dark', card.classList.contains('plan--dark'));
    overlay.show();
  }

  link.addEventListener('click', (e) => {
    if (!onContactPage() || !currentKey) return;
    e.preventDefault();
    overlay.hide({ restoreFocus: false });
    chooseSuivi(currentKey);
  });

  // Accueil : « Voir le détail » sur les cartes des suivis
  document.querySelectorAll('.plans .plan .plan__more summary').forEach((summary) => {
    summary.setAttribute('role', 'button');
    summary.setAttribute('aria-haspopup', 'dialog');
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      open(summary.closest('.plan'));
    });
  });
  // Page contact : les bulles « Trouve ton suivi » ouvrent le détail
  const source = document.querySelector('[data-plan-source]');
  document.querySelectorAll('.chooser a[data-pick]:not([data-starts]), .vlist a[data-pick]:not([data-starts])').forEach((a) => {
    a.setAttribute('aria-haspopup', 'dialog');
    a.addEventListener('click', (e) => {
      const card = source?.querySelector(`.plan[data-key="${a.dataset.pick}"]`);
      if (!card) return;
      e.preventDefault();
      open(card);
    });
  });
})();

/* ---------- Page contact : « Bilan & séances » ouvre les 3 offres pour commencer ---------- */
(function initStartsModal() {
  const modal = document.querySelector('[data-smodal]');
  if (!modal) return;
  const overlay = makeOverlay(modal, 'data-smodal-close');
  document.querySelectorAll('[data-starts]').forEach((a) => {
    a.setAttribute('aria-haspopup', 'dialog');
    a.addEventListener('click', (e) => { e.preventDefault(); overlay.show(); });
  });
  modal.querySelectorAll('[data-choose]').forEach((btn) => btn.addEventListener('click', () => {
    overlay.hide({ restoreFocus: false });
    chooseSuivi(btn.dataset.choose);
  }));
})();

/* ---------- Page contact : tableau comparatif par-dessus la page ---------- */
(function initCompareModal() {
  const modal = document.querySelector('[data-cmodal]');
  if (!modal) return;
  const overlay = makeOverlay(modal, 'data-cmodal-close');
  document.querySelectorAll('[data-compare]').forEach((a) => {
    a.setAttribute('aria-haspopup', 'dialog');
    a.addEventListener('click', (e) => { e.preventDefault(); overlay.show(); });
  });
  modal.querySelectorAll('[data-choose]').forEach((btn) => btn.addEventListener('click', () => {
    overlay.hide({ restoreFocus: false });
    chooseSuivi(btn.dataset.choose);
  }));
})();

/* ---------- Le mot de Néfélie : « en train d'écrire… », puis la phrase s'écrit lettre par lettre ---------- */
(function initBubble() {
  const bubble = document.querySelector('[data-bubble]');
  if (!bubble || reduceMotion || !('IntersectionObserver' in window)) return;
  const txt = bubble.querySelector('.bubble__text');
  const body = bubble.querySelector('.bubble__body');
  const full = txt.textContent;
  txt.setAttribute('aria-label', full);
  bubble.classList.add('is-pre'); // place réservée, texte caché jusqu'au début de l'écriture
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    // hauteur de la phrase finie réservée : rien ne saute pendant l'écriture
    body.style.minHeight = `${body.offsetHeight}px`;
    bubble.classList.remove('is-pre');
    bubble.classList.add('is-typing');
    setTimeout(() => {
      bubble.classList.remove('is-typing');
      txt.textContent = '';
      txt.classList.add('is-writing');
      let i = 0;
      const step = () => {
        txt.textContent = full.slice(0, ++i);
        if (i < full.length) setTimeout(step, /[,.!:]/.test(full[i - 1]) ? 220 : 26);
        else setTimeout(() => txt.classList.remove('is-writing'), 1200);
      };
      step();
    }, 1300);
  }, { threshold: 0.35 });
  io.observe(bubble);
})();

/* ---------- Premier scroll : hero qui rétrécit + nav qui se rétracte ---------- */
(function initScrollChrome() {
  const nav = document.querySelector('.gnav');
  const heroEl = document.querySelector('.hero');
  const video = document.getElementById('hero-video');
  let ticking = false;
  // La nav suit le scroll avec un léger amorti : même un scroll rapide donne une transition douce.
  let navN = 0, navTarget = 0, navRunning = false, navLast = 0;
  const NAV_TAU = reduceMotion ? 1 : 260; // ms
  function navLoop(now) {
    const dt = navLast ? Math.min(64, now - navLast) : 16;
    navLast = now;
    navN += (navTarget - navN) * (1 - Math.exp(-dt / NAV_TAU));
    if (Math.abs(navTarget - navN) < 0.002) navN = navTarget;
    nav?.style.setProperty('--n', navN.toFixed(3));
    nav?.classList.toggle('is-compact', navN > 0.6);
    if (navN !== navTarget) requestAnimationFrame(navLoop);
    else navRunning = false;
  }
  function update() {
    ticking = false;
    const y = window.scrollY;
    // rétraction progressive de la nav sur les ~300 premiers pixels (lissée dans le temps, voir navLoop)
    navTarget = Math.min(1, Math.max(0, y / Math.min(320, window.innerHeight * 0.38)));
    if (!navRunning) { navRunning = true; navLast = 0; requestAnimationFrame(navLoop); }
    if (!heroEl || reduceMotion) return;
    const h = heroEl.offsetHeight || 1;
    const clamp = (v) => Math.min(1, Math.max(0, v));
    // 1er temps : le hero recule seul (zone réservée de 40vh avant la section suivante).
    const first = window.innerHeight * 0.4;
    const h1 = clamp(y / first);
    // 2e temps : la section suivante passe par-dessus, le hero recule encore et se trouble.
    const h2 = clamp((y - first) / (h * 0.75));
    const ease = (t) => 1 - Math.pow(1 - t, 2);
    heroEl.style.setProperty('--h1', ease(h1).toFixed(3));
    heroEl.style.setProperty('--h2', h2.toFixed(3));
    const p = h2;
    // Hero entièrement recouvert : on met la vidéo en pause.
    if (video) {
      if (p >= 1 && !video.paused) { video.dataset.coverPaused = '1'; video.pause(); }
      else if (p < 1 && video.dataset.coverPaused) { delete video.dataset.coverPaused; video.play().catch(() => {}); }
    }
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
  navN = navTarget;
  nav?.style.setProperty('--n', navN.toFixed(3));
  nav?.classList.toggle('is-compact', navN > 0.6);
})();
