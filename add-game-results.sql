-- Einmalig in der bestehenden IONOS-Datenbank "luftballons" importieren.
-- Für eine komplett neue Datenbank reicht stattdessen schema.sql.
CREATE TABLE IF NOT EXISTS game_results (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    result ENUM('win', 'loss') NOT NULL,
    duration_seconds INT UNSIGNED NOT NULL,
    round_reached TINYINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_game_results_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_game_results_user (user_id),
    INDEX idx_game_results_fastest (result, duration_seconds),
    INDEX idx_game_results_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
