<?php

declare(strict_types=1);

function escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function duration(?int $seconds): string
{
    return $seconds === null ? '–' : sprintf('%02d:%02d', intdiv($seconds, 60), $seconds % 60);
}

function option(array $input, string $key, array $allowed, string $default): string
{
    $value = $input[$key] ?? null;
    return is_string($value) && in_array($value, $allowed, true) ? $value : $default;
}

function portal_head(string $title): void
{
    echo '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<title>' . escape($title) . ' – 99 Luftballons</title>';
    echo '<link rel="stylesheet" href="style.css?v=account-settings-1"><script src="theme.js?v=camp-1"></script>';
}

// Calendar boundaries use the database's date, matching stored match timestamps.
function period_bounds(string $period, DateTimeImmutable $today): array
{
    if ($period === 'week') {
        $start = $today->modify('monday this week')->setTime(0, 0);
        return [$start->format('Y-m-d H:i:s'), $start->modify('+1 week')->format('Y-m-d H:i:s')];
    }
    if ($period === 'month') {
        $start = $today->modify('first day of this month')->setTime(0, 0);
        return [$start->format('Y-m-d H:i:s'), $start->modify('+1 month')->format('Y-m-d H:i:s')];
    }
    return [];
}

// One row per player. Stable tie order is shared by podium, table and personal rank.
function rankings(PDO $pdo, string $sort = 'fastest', string $period = 'all', ?int $userId = null, int $limit = 10): array
{
    $bounds = $period === 'all' ? [] : period_bounds($period, new DateTimeImmutable((string) $pdo->query('SELECT CURRENT_DATE')->fetchColumn()));
    $where = $bounds === [] ? '' : ' AND g.created_at >= ? AND g.created_at < ?';
    $base = "SELECT u.id, u.username, COUNT(*) AS wins, MIN(g.duration_seconds) AS best
        FROM users u INNER JOIN game_results g ON g.user_id = u.id
        WHERE g.result = 'win' $where GROUP BY u.id, u.username";
    $order = $sort === 'wins' ? 'wins DESC, best ASC, id ASC' : 'best ASC, id ASC';
    $query = $pdo->prepare("SELECT * FROM ($base) ranked ORDER BY $order LIMIT " . max(1, min(100, $limit)));
    $query->execute($bounds);
    $rows = $query->fetchAll();
    foreach ($rows as $i => &$row) $row['rank'] = $i + 1;
    unset($row);
    $mine = null;
    if ($userId !== null) {
        $query = $pdo->prepare("SELECT * FROM ($base) ranked WHERE id = ?");
        $query->execute(array_merge($bounds, [$userId]));
        $mine = $query->fetch() ?: null;
        if ($mine !== null) {
            $ahead = '(best < ? OR (best = ? AND id < ?))';
            $values = [(int) $mine['best'], (int) $mine['best'], $userId];
            if ($sort === 'wins') {
                $ahead = "(wins > ? OR (wins = ? AND $ahead))";
                $values = array_merge([(int) $mine['wins'], (int) $mine['wins']], $values);
            }
            $query = $pdo->prepare("SELECT COUNT(*) FROM ($base) ranked WHERE $ahead");
            foreach (array_merge($bounds, $values) as $index => $value) {
                $query->bindValue($index + 1, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
            }
            $query->execute();
            $mine['rank'] = (int) $query->fetchColumn() + 1;
        }
    }
    return ['entries' => $rows, 'mine' => $mine];
}

function player_stats(PDO $pdo, int $userId): array
{
    $query = $pdo->prepare("SELECT COUNT(*) AS matches,
        COALESCE(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END), 0) AS wins,
        MIN(CASE WHEN result = 'win' THEN duration_seconds ELSE NULL END) AS best
        FROM game_results WHERE user_id = ?");
    $query->execute([$userId]);
    $stats = $query->fetch();
    $stats['rate'] = (int) $stats['matches'] === 0 ? null : round((int) $stats['wins'] / (int) $stats['matches'] * 100, 1);
    return $stats;
}

function match_history(PDO $pdo, int $userId, string $filter = 'all', int $page = 1, int $size = 10): array
{
    $size = max(1, min(50, $size));
    $filter = in_array($filter, ['win', 'loss'], true) ? $filter : 'all';
    $where = 'user_id = ?' . ($filter === 'all' ? '' : ' AND result = ?');
    $params = $filter === 'all' ? [$userId] : [$userId, $filter];
    $query = $pdo->prepare("SELECT COUNT(*) FROM game_results WHERE $where");
    $query->execute($params);
    $total = (int) $query->fetchColumn();
    $pages = max(1, (int) ceil($total / $size));
    $page = max(1, min($pages, $page));
    $query = $pdo->prepare("SELECT id, result, duration_seconds, round_reached, created_at
        FROM game_results WHERE $where ORDER BY created_at DESC, id DESC LIMIT $size OFFSET " . (($page - 1) * $size));
    $query->execute($params);
    return ['entries' => $query->fetchAll(), 'total' => $total, 'pages' => $pages, 'page' => $page];
}

function podium(array $entries, string $sort = 'fastest'): void
{
    if ($entries === []) {
        echo '<p class="message">Noch keine Siege in diesem Zeitraum. Der erste Podestplatz wartet!</p>';
        return;
    }
    echo '<ol class="podium" aria-label="Die drei besten Spieler">';
    foreach (array_slice($entries, 0, 3) as $row) {
        $rank = (int) $row['rank'];
        echo '<li class="podium-card podium-' . $rank . '"><span class="rank-badge rank-' . $rank . '">' . $rank . '</span>';
        echo '<strong>' . escape($row['username']) . '</strong><span>' . ($sort === 'wins' ? (int) $row['wins'] . ' Siege' : duration((int) $row['best'])) . '</span></li>';
    }
    echo '</ol>';
}

function history_table(array $entries, ?int $best): void
{
    if ($entries === []) {
        echo '<p class="message">Hier gibt es noch keine gespeicherten Partien.</p>';
        return;
    }
    echo '<div class="leaderboard-table-wrapper"><table class="leaderboard-table"><caption class="table-caption">Abgeschlossene Partien</caption><thead><tr><th scope="col">Datum</th><th scope="col">Ergebnis</th><th scope="col">Dauer</th><th scope="col">Runde</th></tr></thead><tbody>';
    foreach ($entries as $entry) {
        $win = $entry['result'] === 'win';
        echo '<tr><td>' . escape((new DateTimeImmutable($entry['created_at']))->format('d.m.Y · H:i')) . '</td>';
        echo '<td><span class="result-badge ' . ($win ? 'result-win' : 'result-loss') . '">' . ($win ? 'Sieg' : 'Niederlage') . '</span></td>';
        echo '<td>' . duration((int) $entry['duration_seconds']);
        if ($win && $best !== null && (int) $entry['duration_seconds'] === $best) echo ' <span class="personal-best">Deine Bestzeit</span>';
        echo '</td><td>' . (int) $entry['round_reached'] . '/30</td></tr>';
    }
    echo '</tbody></table></div>';
}
