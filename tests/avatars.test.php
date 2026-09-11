<?php
declare(strict_types=1);
require dirname(__DIR__) . '/avatars.php';

function avatar_check(bool $ok, string $message): void {
    if (!$ok) throw new RuntimeException($message);
    echo "OK: $message\n";
}

$catalog = avatar_catalog();
avatar_check(count($catalog) === 5, 'Exactly five preset avatars are available');
avatar_check(avatar_data('unknown')['name'] === 'Waldwächter', 'Unknown values safely fall back to the default avatar');
avatar_check(!valid_avatar_code('../config.local.php'), 'Arbitrary file paths cannot be selected as avatars');
foreach ($catalog as $avatar) avatar_check(is_file(dirname(__DIR__) . '/' . $avatar['image']), $avatar['name'] . ' image exists');

$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY)');
$pdo->exec('INSERT INTO users VALUES (1)');
avatar_check(user_avatar_code($pdo, 1) === 'forest_guardian', 'Existing users receive the default avatar');
save_user_avatar($pdo, 1, 'frost_mage');
avatar_check(user_avatar_code($pdo, 1) === 'frost_mage', 'Selected avatar is stored persistently');
save_user_avatar($pdo, 1, 'wind_engineer');
avatar_check(user_avatar_code($pdo, 1) === 'wind_engineer', 'Existing avatar selection can be changed');
avatar_check((int) $pdo->query('SELECT COUNT(*) FROM user_profiles')->fetchColumn() === 1, 'Changing an avatar does not duplicate the profile');
$rejected = false;
try { save_user_avatar($pdo, 1, 'invalid'); } catch (InvalidArgumentException) { $rejected = true; }
avatar_check($rejected, 'Invalid avatar codes are rejected by the persistence layer');
