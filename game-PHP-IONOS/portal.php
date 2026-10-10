<?php
declare(strict_types=1);
require __DIR__ . '/../auth.php';
require_login();
define('GAME_PORTAL_MODE', true);
require __DIR__ . '/index.php';
