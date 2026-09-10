<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();

header('Location: game/index.php');
exit;
