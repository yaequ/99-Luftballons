<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';

if (isset($_SESSION['user_id'])) {
    header('Location: menu.php');
} else {
    header('Location: login.php');
}

exit;
