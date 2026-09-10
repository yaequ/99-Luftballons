document.querySelectorAll('[data-password-target]').forEach((button) => {
    button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.passwordTarget);

        if (!input) {
            return;
        }

        const showPassword = input.type === 'password';
        input.type = showPassword ? 'text' : 'password';
        button.textContent = showPassword ? '🙈' : '👁';
        button.setAttribute('aria-label', showPassword ? 'Passwort verbergen' : 'Passwort anzeigen');
    });
});
