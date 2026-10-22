/* Shared, mouse-first onboarding for the first round of either game mode. */
(() => {
  function buildZoneRect(canvas, map, zoneIndex = 1) {
    const zone = map?.buildZones?.[zoneIndex];
    const image = map?.image;
    if (!zone || !image?.naturalWidth || !image?.naturalHeight) return canvas.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const visibleHeight = image.naturalHeight - map.hudCrop;
    return {
      left: canvasRect.left + zone.x / image.naturalWidth * canvasRect.width,
      top: canvasRect.top + (zone.y - map.hudCrop) / visibleHeight * canvasRect.height,
      width: zone.w / image.naturalWidth * canvasRect.width,
      height: zone.h / visibleHeight * canvasRect.height,
      get right() { return this.left + this.width; },
      get bottom() { return this.top + this.height; }
    };
  }

  function create({ apiUrl, csrfToken }) {
    let running = false;

    async function request(action) {
      const body = new URLSearchParams({ action, csrf_token: csrfToken });
      const response = await fetch(apiUrl, {
        method: 'POST', credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body, cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Tutorial: HTTP ${response.status}`);
      return response.json();
    }

    async function start(steps, onContinue) {
      if (running) return;
      running = true;
      let eligibility;
      try { eligibility = await request('begin'); }
      catch { running = false; onContinue(); return; }
      if (!eligibility.show || !steps.length) { running = false; onContinue(); return; }

      const root = document.createElement('div');
      root.className = 'first-round-tour';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-labelledby', 'first-round-tour-title');
      root.innerHTML = `<div class="first-round-tour__blocker"></div>
        <div class="first-round-tour__spotlight" aria-hidden="true"></div>
        <svg class="first-round-tour__arrow" aria-hidden="true"><defs><marker id="first-round-tour-arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f7d66e"/></marker></defs><line x1="0" y1="0" x2="0" y2="0" marker-end="url(#first-round-tour-arrowhead)"/></svg>
        <section class="first-round-tour__card">
          <span class="first-round-tour__eyebrow">Dein erster Einsatz <span class="first-round-tour__progress"></span></span>
          <h2 id="first-round-tour-title"></h2><p class="first-round-tour__copy"></p>
          <div class="first-round-tour__actions"><button class="first-round-tour__skip" type="button">Überspringen</button><span></span><button class="first-round-tour__back" type="button">Zurück</button><button class="first-round-tour__next" type="button">Weiter</button></div>
        </section>`;
      document.body.append(root);
      const spotlight = root.querySelector('.first-round-tour__spotlight');
      const card = root.querySelector('.first-round-tour__card');
      const arrow = root.querySelector('.first-round-tour__arrow');
      const line = arrow.querySelector('line');
      const back = root.querySelector('.first-round-tour__back');
      const next = root.querySelector('.first-round-tour__next');
      const previousFocus = document.activeElement;
      let index = 0;
      let closed = false;

      function position() {
        if (closed) return;
        const target = document.querySelector(steps[index].target);
        if (!target) return;
        const rect = steps[index].getSpotlightRect?.() ?? target.getBoundingClientRect();
        const pad = 7;
        spotlight.style.left = `${Math.max(0, rect.left - pad)}px`;
        spotlight.style.top = `${Math.max(0, rect.top - pad)}px`;
        spotlight.style.width = `${Math.min(innerWidth, rect.right + pad) - Math.max(0, rect.left - pad)}px`;
        spotlight.style.height = `${Math.min(innerHeight, rect.bottom + pad) - Math.max(0, rect.top - pad)}px`;
        const width = card.offsetWidth;
        const height = card.offsetHeight;
        const gap = 24;
        let left = Math.max(14, Math.min(innerWidth - width - 14, rect.left));
        let top;
        if (innerHeight - rect.bottom >= height + gap + 14) top = rect.bottom + gap;
        else if (rect.top >= height + gap + 14) top = rect.top - height - gap;
        else if (innerWidth - rect.right >= width + gap + 14) {
          left = rect.right + gap;
          top = Math.max(14, Math.min(innerHeight - height - 14, rect.top));
        } else if (rect.left >= width + gap + 14) {
          left = rect.left - width - gap;
          top = Math.max(14, Math.min(innerHeight - height - 14, rect.top));
        } else {
          top = Math.max(14, innerHeight - height - 14);
        }
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
        const cardRect = card.getBoundingClientRect();
        let targetX = Math.max(12, Math.min(innerWidth - 12, rect.left + rect.width / 2));
        let targetY = Math.max(12, Math.min(innerHeight - 12, rect.top + rect.height / 2));
        if (targetX > cardRect.left && targetX < cardRect.right && targetY > cardRect.top && targetY < cardRect.bottom) {
          targetX = Math.max(12, Math.min(innerWidth - 12, rect.left + Math.min(22, rect.width / 2)));
          targetY = Math.max(12, Math.min(innerHeight - 12, rect.top + Math.min(22, rect.height / 2)));
        }
        const startX = Math.max(cardRect.left, Math.min(cardRect.right, targetX));
        const startY = Math.max(cardRect.top, Math.min(cardRect.bottom, targetY));
        line.setAttribute('x1', String(startX));
        line.setAttribute('y1', String(startY));
        line.setAttribute('x2', String(targetX));
        line.setAttribute('y2', String(targetY));
      }

      function render() {
        if (closed) return;
        const step = steps[index];
        const target = document.querySelector(step.target);
        if (!target) { if (index < steps.length - 1) { index += 1; render(); } else finish(); return; }
        root.querySelector('.first-round-tour__progress').textContent = `${index + 1} / ${steps.length}`;
        root.querySelector('h2').textContent = step.title;
        root.querySelector('.first-round-tour__copy').textContent = step.text;
        back.hidden = index === 0;
        next.textContent = index === steps.length - 1 ? 'Los geht’s' : 'Weiter';
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
        requestAnimationFrame(position);
        window.setTimeout(position, 120);
        next.focus({ preventScroll: true });
      }

      function finish() {
        if (closed) return;
        closed = true;
        window.removeEventListener('resize', position);
        window.removeEventListener('scroll', position, true);
        root.remove();
        previousFocus?.focus?.({ preventScroll: true });
        running = false;
        request('complete').catch(() => {});
        onContinue();
      }

      back.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
      next.addEventListener('click', () => { if (index === steps.length - 1) finish(); else { index += 1; render(); } });
      root.querySelector('.first-round-tour__skip').addEventListener('click', finish);
      root.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { event.preventDefault(); finish(); }
        if (event.key !== 'Tab') return;
        const buttons = [...card.querySelectorAll('button:not([hidden])')];
        const first = buttons[0]; const last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      window.addEventListener('resize', position);
      window.addEventListener('scroll', position, true);
      render();
    }

    return { start };
  }

  window.FirstRoundTour = { create, buildZoneRect };
})();
