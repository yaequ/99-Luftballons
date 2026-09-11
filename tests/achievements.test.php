<?php
declare(strict_types=1);
require dirname(__DIR__) . '/achievements.php';

function achievement_check(bool $ok, string $message): void {
    if (!$ok) throw new RuntimeException($message);
    echo "OK: $message\n";
}

$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT)');
$pdo->exec('CREATE TABLE game_results (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, result TEXT, duration_seconds INTEGER, round_reached INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
$pdo->exec("INSERT INTO users VALUES (1, 'Player')");
$insert = $pdo->prepare('INSERT INTO game_results (user_id, result, duration_seconds, round_reached) VALUES (1, ?, ?, ?)');

$collection = player_achievements($pdo, 1);
achievement_check(count($collection) === 5, 'The complete five-achievement catalogue is returned');
achievement_check(count(array_filter($collection, fn(array $item): bool => $item['unlocked_at'] !== null)) === 0, 'A new player starts with all achievements locked');
foreach (achievement_catalog() as $achievement) achievement_check(is_file(dirname(__DIR__) . '/' . $achievement['icon']), $achievement['name'] . ' icon exists');

$insert->execute(['loss', 700, 4]);
achievement_check(unlock_achievements($pdo, 1, (int) $pdo->lastInsertId()) === ['first_match'], 'First completed match unlocks Feuerprobe');
$insert->execute(['win', 600, 30]);
$new = unlock_achievements($pdo, 1, (int) $pdo->lastInsertId());
achievement_check($new === ['first_win'], 'First win unlocks Basiswächter without triggering speed achievement');
$insert->execute(['win', 550, 30]); unlock_achievements($pdo, 1, (int) $pdo->lastInsertId());
$insert->execute(['win', 500, 30]);
achievement_check(unlock_achievements($pdo, 1, (int) $pdo->lastInsertId()) === ['win_streak'], 'Three latest wins unlock Unaufhaltsam');

for ($i = 0; $i < 21; $i++) $insert->execute(['loss', 800, 10]);
achievement_check(unlock_achievements($pdo, 1, (int) $pdo->lastInsertId()) === ['veteran'], 'Twenty-five completed matches unlock Veteran der Lüfte');
$insert->execute(['win', 300, 30]);
achievement_check(unlock_achievements($pdo, 1, (int) $pdo->lastInsertId()) === ['speedrunner'], 'A win in exactly five minutes unlocks Blitzstratege');
achievement_check(unlock_achievements($pdo, 1) === [], 'Achievements are never unlocked twice');
achievement_check((int) $pdo->query('SELECT COUNT(*) FROM user_achievements')->fetchColumn() === 5, 'Each achievement has one persistent database record');

$pdo->exec("INSERT INTO users VALUES (2, 'Historic')");
$pdo->exec("INSERT INTO game_results (user_id, result, duration_seconds, round_reached) VALUES (2, 'win', 200, 30)");
$historic = player_achievements($pdo, 2);
achievement_check(count(array_filter($historic, fn(array $item): bool => $item['unlocked_at'] !== null)) === 3, 'Existing match history is backfilled when the account opens');
