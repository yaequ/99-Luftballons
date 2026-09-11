<?php
declare(strict_types=1);
require dirname(__DIR__) . '/portal.php';
function check(bool $ok, string $message): void {
    if (!$ok) throw new RuntimeException($message);
    echo "OK: $message\n";
}
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, created_at TEXT)');
$pdo->exec('CREATE TABLE game_results (id INTEGER PRIMARY KEY, user_id INTEGER, result TEXT, duration_seconds INTEGER, round_reached INTEGER, created_at TEXT)');
check(rankings($pdo)['entries'] === [], 'Empty leaderboard');
check(player_stats($pdo, 1)['rate'] === null, 'No matches has no percentage');
check(match_history($pdo, 1)['pages'] === 1, 'Empty history has a valid page');
$now = new DateTimeImmutable((string) $pdo->query('SELECT CURRENT_DATE')->fetchColumn());
$insert = $pdo->prepare('INSERT INTO game_results (user_id,result,duration_seconds,round_reached,created_at) VALUES (?,?,?,?,?)');
for ($id = 1; $id <= 15; $id++) {
    $query = $pdo->prepare('INSERT INTO users VALUES (?,?,?)');
    $query->execute([$id, $id === 1 ? '<script>alert(1)</script>' : 'Player ' . $id, $now->format('Y-m-d')]);
    $insert->execute([$id, 'win', $id * 10, 30, $now->format('Y-m-d H:i:s')]);
}
$insert->execute([1,'win',20,30,$now->modify('-2 months')->format('Y-m-d H:i:s')]);
$insert->execute([1,'loss',5,2,$now->format('Y-m-d H:i:s')]);
$insert->execute([2,'win',10,30,$now->format('Y-m-d H:i:s')]);
$stats = player_stats($pdo, 1);
check((int) $stats['matches'] === 3 && (int) $stats['wins'] === 2 && $stats['rate'] === 66.7, 'Stats aggregate wins and losses correctly');
check((int) $stats['best'] === 10, 'Loss is excluded from best time');
$board = rankings($pdo, 'fastest', 'all', 15);
check(count($board['entries']) === 10 && $board['mine']['rank'] === 15, 'Personal rank outside top ten');
check((int) $board['entries'][0]['id'] === 1 && (int) $board['entries'][1]['id'] === 2, 'Equal best times have stable ID order');
check(rankings($pdo, 'fastest', 'all', 2)['mine']['rank'] === 2, 'Personal rank agrees with top table');
check(rankings($pdo, 'wins', 'all', 2)['mine']['rank'] === 2, 'Wins ties use best time and ID consistently');
check((int) rankings($pdo, 'wins', 'week', 1)['mine']['wins'] === 1, 'Calendar week excludes older wins');
check((int) rankings($pdo, 'wins', 'month', 1)['mine']['wins'] === 1, 'Calendar month excludes older wins');
check(rankings($pdo, 'fastest', 'all', 999)['mine'] === null, 'User without wins is unranked');
$first = match_history($pdo, 1, 'all', 1, 2);
$second = match_history($pdo, 1, 'all', 2, 2);
check(count($first['entries']) === 2 && count($second['entries']) === 1 && $first['total'] === 3, 'History pagination');
check((int) $first['entries'][0]['duration_seconds'] === 5, 'Identical timestamps use newest match ID first');
check(match_history($pdo, 1, 'all', PHP_INT_MAX, 2)['page'] === 2, 'Out-of-range page is clamped');
check(match_history($pdo, 1, 'all', -5)['page'] === 1, 'Negative page is clamped');
check(match_history($pdo, 1, 'loss')['total'] === 1, 'Loss filter');
check(match_history($pdo, 1, 'win')['total'] === 2, 'Win filter');
check(match_history($pdo, 15)['total'] === 1, 'History is restricted to current user');
check(option(['sort'=>['wins']], 'sort', ['wins','fastest'], 'fastest') === 'fastest', 'Array query parameters are rejected safely');
check(period_bounds('week', new DateTimeImmutable('2026-01-01')) === ['2025-12-29 00:00:00','2026-01-05 00:00:00'], 'Week boundary across year');
check(period_bounds('month', new DateTimeImmutable('2024-02-29')) === ['2024-02-01 00:00:00','2024-03-01 00:00:00'], 'Leap-month boundaries');
check(duration(null) === '–' && duration(0) === '00:00' && duration(3600) === '60:00', 'Time formatting including zero and missing best');
ob_start(); podium(rankings($pdo)['entries']); $html = ob_get_clean();
check(!str_contains($html, '<script>') && str_contains($html, '&lt;script&gt;'), 'Leaderboard names escaped');
ob_start(); history_table(match_history($pdo, 1)['entries'], 10); $html = ob_get_clean();
check(substr_count($html, 'Deine Bestzeit') === 1, 'Personal best badge only for the best winning match');

// Render real templates with representative data without using production credentials.
$fixtures = [
    'index.php' => ['top'=>$board['entries'], 'rankingUnavailable'=>false, 'loggedIn'=>false],
    'account.php' => ['player'=>['username'=>'<b>Test</b>', 'created_at'=>'2026-01-01'], 'stats'=>$stats, 'rank'=>$board['mine'], 'recent'=>$first, 'best'=>10, 'achievementCount'=>1, 'achievements'=>[
        ['code'=>'first_match','name'=>'Feuerprobe','description'=>'Test','icon'=>'assets/img/achievements/achievement-first-match.png','unlocked_at'=>'2026-01-01 12:00:00','current'=>1,'target'=>1],
        ['code'=>'veteran','name'=>'Veteran','description'=>'Test','icon'=>'assets/img/achievements/achievement-veteran.png','unlocked_at'=>null,'current'=>3,'target'=>25],
    ]],
    'history.php' => ['filter'=>'all', 'history'=>$first, 'best'=>10],
    'leaderboard.php' => ['sort'=>'fastest', 'period'=>'all', 'userId'=>15, 'board'=>$board, 'entries'=>$board['entries'], 'mine'=>$board['mine']],
    'instructions.php' => [],
    'imprint.php' => [],
    'privacy.php' => [],
];
// Defined in leaderboard.php's controller, skipped when testing the template only.
function board_url(string $sort, string $period): string { return 'leaderboard.php?' . escape(http_build_query(['sort'=>$sort,'period'=>$period])); }
foreach ($fixtures as $file => $vars) {
    $render = static function () use ($file, $vars) {
        extract($vars);
        $_SESSION = $file === 'index.php' ? [] : ['user_id'=>15];
        $_SERVER['SCRIPT_NAME'] = '/' . $file;
        $source = file_get_contents(dirname(__DIR__) . '/' . $file);
        $template = substr($source, strpos($source, '?>') + 2);
        $template = str_replace('__DIR__', var_export(dirname(__DIR__), true), $template);
        ob_start(); eval('?>' . $template); return ob_get_clean();
    };
    $html = $render();
    check(substr_count($html, '<header class="site-header">') === 1 && str_contains($html, 'id="main-content"'), "$file renders with shared navigation");
    check(substr_count($html, '<footer class="site-footer">') === 1, "$file renders with shared legal footer");
}
