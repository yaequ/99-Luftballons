(() => {
    const key = '99-luftballons-theme';
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    let preference = null;
    try { preference = localStorage.getItem(key); } catch (_) { /* Storage may be disabled. */ }
    if (!['light', 'dark'].includes(preference)) preference = null;
    const apply = () => {
        const dark = (preference || (system.matches ? 'dark' : 'light')) === 'dark';
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        const button = document.querySelector('.theme-toggle');
        if (button) {
            button.hidden = false;
            button.setAttribute('aria-pressed', String(dark));
            button.setAttribute('aria-label', dark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren');
        }
    };
    apply();
    document.addEventListener('DOMContentLoaded', () => {
        apply();
        document.querySelector('.theme-toggle')?.addEventListener('click', () => {
            preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem(key, preference); } catch (_) { /* Keep session choice. */ }
            apply();
        });
    });
    system.addEventListener('change', () => { if (!preference) apply(); });
})();
