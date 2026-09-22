<?php

declare(strict_types=1);

/**
 * Keeps older installations compatible with separated AI and multiplayer results.
 * Existing rows receive the default mode "ai" during the migration.
 */
function ensure_game_results_schema(PDO $pdo): void
{
    static $migratedConnections = [];
    $connectionId = spl_object_id($pdo);
    if (isset($migratedConnections[$connectionId])) return;

    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $columns = $pdo->query('PRAGMA table_info(game_results)')->fetchAll(PDO::FETCH_ASSOC);
        $columnNames = array_column($columns, 'name');
        $modeAdded = false;
        if (!in_array('game_mode', $columnNames, true)) {
            $pdo->exec("ALTER TABLE game_results ADD COLUMN game_mode TEXT NOT NULL DEFAULT 'ai'");
            $modeAdded = true;
        }
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_game_results_mode ON game_results(game_mode, result, duration_seconds)');
        $hasLinks = $modeAdded && (int) $pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'multiplayer_result_records'")->fetchColumn() > 0;
        if ($hasLinks) {
            $pdo->exec("UPDATE game_results SET game_mode = 'multiplayer'
                WHERE id IN (SELECT game_result_id FROM multiplayer_result_records)");
        }
        $migratedConnections[$connectionId] = true;
        return;
    }

    $columns = $pdo->query("SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_results'")->fetchAll(PDO::FETCH_KEY_PAIR);
    $modeAdded = false;
    if (!isset($columns['game_mode'])) {
        $pdo->exec("ALTER TABLE game_results ADD COLUMN game_mode ENUM('ai', 'multiplayer') NOT NULL DEFAULT 'ai' AFTER result");
        $modeAdded = true;
    }
    if (isset($columns['result']) && !str_contains((string) $columns['result'], "'draw'")) {
        $pdo->exec("ALTER TABLE game_results MODIFY result ENUM('win', 'loss', 'draw') NOT NULL");
    }
    $hasModeIndex = (int) $pdo->query("SELECT COUNT(*) FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_results' AND INDEX_NAME = 'idx_game_results_mode'")->fetchColumn() > 0;
    if (!$hasModeIndex) {
        $pdo->exec('ALTER TABLE game_results ADD INDEX idx_game_results_mode (game_mode, result, duration_seconds)');
    }
    $hasLinks = $modeAdded && (int) $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'multiplayer_result_records'")->fetchColumn() > 0;
    if ($hasLinks) {
        $pdo->exec("UPDATE game_results SET game_mode = 'multiplayer'
            WHERE id IN (SELECT game_result_id FROM multiplayer_result_records)");
    }
    $migratedConnections[$connectionId] = true;
}
