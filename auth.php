<?php

declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
    $usesHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    session_start([
        'cookie_httponly' => true,
        'cookie_secure' => $usesHttps,
        'cookie_samesite' => 'Lax',
        'use_strict_mode' => true,
    ]);
}

function require_login(): void
{
    if (!isset($_SESSION['user_id'])) {
        header('Location: /login.php');
        exit;
    }
}
