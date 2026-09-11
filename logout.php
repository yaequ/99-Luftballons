<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';

destroy_session();

header('Location: login.php');
exit;
