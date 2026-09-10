<?php

declare(strict_types=1);

$configFile = __DIR__ . '/config.local.php';

if (!is_file($configFile)) {
    throw new RuntimeException(
        'Die Konfigurationsdatei config.local.php fehlt. Kopiere config.example.php und trage die Zugangsdaten ein.'
    );
}

$config = require $configFile;
$databaseConfig = $config['database'];

$host = $databaseConfig['host'];
$port = $databaseConfig['port'];
$database = $databaseConfig['name'];
$username = $databaseConfig['username'];
$password = $databaseConfig['password'];

$dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";

$pdo = new PDO($dsn, $username, $password, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
]);
