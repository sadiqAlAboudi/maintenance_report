<?php
/**
 * Security Configuration and Session Management
 * University of Al-Qadisiyah - Maintenance Report System
 */

declare(strict_types=1);

// Prevent information leakage by disabling error display
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// Local directory for rate-limiting cache and security logs
define('DATA_DIR', __DIR__ . '/.storage');
if (!is_dir(DATA_DIR)) {
    @mkdir(DATA_DIR, 0700, true);
}

// -------------------------------------------------------------
// 1. Single User Credential Configuration
// -------------------------------------------------------------
// Supports standard Bcrypt ($2y$), Argon2id ($argon2id$), or legacy SHA-256 for seamless transition.
// Generate a fresh Bcrypt hash anytime using generate_hash.php
define('AUTH_PASSWORD_HASH', '$2y$10$JA4d2OLfajnSPFFMQ3mEjecmidxJg7L4qLZKGPab4W1htJrLynYXm');

// -------------------------------------------------------------
// 2. Hardened Session Management
// -------------------------------------------------------------
if (session_status() === PHP_SESSION_NONE) {
    $isHttps = (
        (!empty($_SERVER['HTTPS']) && strtolower($_SERVER['HTTPS']) !== 'off') ||
        (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) ||
        (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
    );

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');

    session_set_cookie_params([
        'lifetime' => 0,            // Expire when browser closes
        'path'     => '/',
        'domain'   => '',
        'secure'   => $isHttps,     // Send only over HTTPS if available
        'httponly' => true,         // Prevent JavaScript access (XSS mitigation)
        'samesite' => 'Strict'      // Prevent Cross-Site Request Forgery
    ]);

    session_name('QU_MAINT_SESSION');
    session_start();
}

// -------------------------------------------------------------
// 3. HTTP Security Headers
// -------------------------------------------------------------
function send_security_headers(): void {
    if (!headers_sent()) {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('X-XSS-Protection: 1; mode=block');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header("Permissions-Policy: geolocation=(), camera=(), microphone=()");
        header("Content-Security-Policy: default-src 'self'; font-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; form-action 'self'; base-uri 'self';");
    }
}
send_security_headers();

// -------------------------------------------------------------
// 4. Client Fingerprinting & IP Resolution
// -------------------------------------------------------------
function get_client_ip(): string {
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        $ip = trim($_SERVER['HTTP_CF_CONNECTING_IP']);
        if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $ip = trim($parts[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
    }
    $remoteIp = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    return filter_var($remoteIp, FILTER_VALIDATE_IP) ? $remoteIp : '127.0.0.1';
}

function get_client_fingerprint(): string {
    $ip = get_client_ip();
    $agent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown_agent';
    return hash('sha256', $ip . '|' . $agent);
}

// -------------------------------------------------------------
// 5. Brute-Force Defense (Rate Limiter)
// -------------------------------------------------------------
function check_rate_limit(int $maxAttempts = 5, int $lockoutSeconds = 900): array {
    $ipHash = hash('sha256', get_client_ip());
    $cacheFile = DATA_DIR . '/limit_' . $ipHash . '.json';

    if (!file_exists($cacheFile)) {
        return ['allowed' => true, 'remaining' => $maxAttempts, 'retry_after' => 0];
    }

    $raw = @file_get_contents($cacheFile);
    $data = is_string($raw) ? @json_decode($raw, true) : null;
    if (!is_array($data)) {
        return ['allowed' => true, 'remaining' => $maxAttempts, 'retry_after' => 0];
    }

    $now = time();
    $attempts = (int)($data['attempts'] ?? 0);
    $firstAttempt = (int)($data['first_attempt'] ?? $now);

    // Reset counter if lockout window elapsed
    if (($now - $firstAttempt) > $lockoutSeconds) {
        @unlink($cacheFile);
        return ['allowed' => true, 'remaining' => $maxAttempts, 'retry_after' => 0];
    }

    if ($attempts >= $maxAttempts) {
        $retryAfter = $lockoutSeconds - ($now - $firstAttempt);
        return ['allowed' => false, 'remaining' => 0, 'retry_after' => max(1, $retryAfter)];
    }

    return ['allowed' => true, 'remaining' => $maxAttempts - $attempts, 'retry_after' => 0];
}

function record_failed_attempt(int $lockoutSeconds = 900): void {
    $ipHash = hash('sha256', get_client_ip());
    $cacheFile = DATA_DIR . '/limit_' . $ipHash . '.json';

    $now = time();
    $data = ['attempts' => 1, 'first_attempt' => $now];

    if (file_exists($cacheFile)) {
        $raw = @file_get_contents($cacheFile);
        $existing = is_string($raw) ? @json_decode($raw, true) : null;
        if (is_array($existing) && ($now - (int)($existing['first_attempt'] ?? $now)) <= $lockoutSeconds) {
            $data['attempts'] = ((int)($existing['attempts'] ?? 0)) + 1;
            $data['first_attempt'] = (int)($existing['first_attempt'] ?? $now);
        }
    }

    @file_put_contents($cacheFile, json_encode($data), LOCK_EX);
    @chmod($cacheFile, 0600);
}

function clear_failed_attempts(): void {
    $ipHash = hash('sha256', get_client_ip());
    $cacheFile = DATA_DIR . '/limit_' . $ipHash . '.json';
    if (file_exists($cacheFile)) {
        @unlink($cacheFile);
    }
}

// -------------------------------------------------------------
// 6. Anti-CSRF Protection
// -------------------------------------------------------------
function get_csrf_token(): string {
    if (empty($_SESSION['qu_csrf_token'])) {
        $_SESSION['qu_csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['qu_csrf_token'];
}

function verify_csrf_token(?string $token): bool {
    if (empty($token) || empty($_SESSION['qu_csrf_token'])) {
        return false;
    }
    return hash_equals($_SESSION['qu_csrf_token'], $token);
}

// -------------------------------------------------------------
// 7. Constant-Time Password Verification
// -------------------------------------------------------------
function verify_password(string $inputPassword): bool {
    $storedHash = AUTH_PASSWORD_HASH;

    // Check for standard Bcrypt ($2y$, $2b$, $2a$) or Argon2id ($argon2id$)
    $isBcryptOrArgon = (
        strncmp($storedHash, '$2y$', 4) === 0 ||
        strncmp($storedHash, '$2b$', 4) === 0 ||
        strncmp($storedHash, '$2a$', 4) === 0 ||
        strncmp($storedHash, '$argon2', 7) === 0
    );

    if ($isBcryptOrArgon) {
        return password_verify($inputPassword, $storedHash);
    }

    // Support SHA-256 (64 hex characters) for seamless migration
    if (strlen($storedHash) === 64 && ctype_xdigit($storedHash)) {
        return hash_equals(strtolower($storedHash), hash('sha256', trim($inputPassword)));
    }

    // Dummy computation to prevent timing attacks if hash is unconfigured
    password_verify('dummy', '$2y$10$abcdefghijklmnopqrstuuNOPQRSTUVWXYZ0123456789ABCDEFGHIJK');
    return hash_equals($storedHash, $inputPassword);
}

// -------------------------------------------------------------
// 8. Authentication & Session Validation
// -------------------------------------------------------------
function is_authenticated(): bool {
    if (empty($_SESSION['qu_authenticated']) || $_SESSION['qu_authenticated'] !== true) {
        return false;
    }

    // Session hijacking check: Validate IP and User-Agent fingerprint
    if (empty($_SESSION['qu_fingerprint']) || !hash_equals($_SESSION['qu_fingerprint'], get_client_fingerprint())) {
        logout_user();
        return false;
    }

    $now = time();

    // Idle session timeout: 1 hour (3600 seconds)
    $maxIdle = 3600;
    if (isset($_SESSION['qu_last_activity']) && ($now - $_SESSION['qu_last_activity'] > $maxIdle)) {
        logout_user();
        return false;
    }

    // Absolute session timeout: 8 hours (28800 seconds)
    $maxLifetime = 28800;
    if (isset($_SESSION['qu_created_at']) && ($now - $_SESSION['qu_created_at'] > $maxLifetime)) {
        logout_user();
        return false;
    }

    $_SESSION['qu_last_activity'] = $now;
    return true;
}

function require_auth(): void {
    if (!is_authenticated()) {
        header('Location: login.php');
        exit;
    }
}

function logout_user(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }
    @session_destroy();
}
