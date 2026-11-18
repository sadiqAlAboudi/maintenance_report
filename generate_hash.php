<?php
/**
 * Bcrypt / Argon2id Password Hash Generator Utility
 * Run via CLI or browser to generate password hashes for config.php
 */

declare(strict_types=1);

$generatedHash = '';
$rawPassword = '';
$cost = 10;

// CLI execution: php generate_hash.php "myPassword"
if (php_sapi_name() === 'cli') {
    $cliPassword = $argv[1] ?? null;
    if (!$cliPassword) {
        echo "Usage: php generate_hash.php <password>\n";
        exit(1);
    }
    $hash = password_hash($cliPassword, PASSWORD_DEFAULT, ['cost' => $cost]);
    echo "Password: {$cliPassword}\n";
    echo "Generated Bcrypt Hash:\n{$hash}\n";
    exit(0);
}

// Browser execution via POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawPassword = (string)($_POST['password'] ?? '');
    if ($rawPassword !== '') {
        $generatedHash = password_hash($rawPassword, PASSWORD_DEFAULT, ['cost' => $cost]);
    }
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>أداة توليد تجزئة كلمة المرور الآمنة</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f6f8fa; padding: 40px 16px; display: flex; justify-content: center; }
    .box { background: #fff; max-width: 520px; width: 100%; padding: 28px; border-radius: 10px; border: 1px solid #d0d7de; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    h2 { margin-top: 0; color: #24292f; }
    p { color: #57609a; font-size: 0.95rem; }
    .field { margin: 16px 0; }
    label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.9rem; }
    input[type="text"], input[type="password"] { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
    button { background: #000; color: #fff; padding: 10px 18px; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }
    .hash-result { background: #eef9fd; border: 1px solid #bee5eb; padding: 14px; border-radius: 6px; margin-top: 20px; word-break: break-all; font-family: monospace; }
    .notice { margin-top: 24px; padding: 12px; background: #fff8c5; border-radius: 6px; font-size: 0.85rem; color: #4d2d00; }
  </style>
</head>
<body>
  <div class="box">
    <h2>توليد هاش كلمة مرور آمن (Bcrypt)</h2>
    <p>أدخل كلمة المرور الجديدة لتوليد التجزئة المشفرة لوضعها في ثابت <code>AUTH_PASSWORD_HASH</code> في ملف <code>config.php</code>.</p>
    
    <form method="POST">
      <div class="field">
        <label for="password">كلمة المرور الجديدة:</label>
        <input type="text" id="password" name="password" required autofocus value="<?= htmlspecialchars($rawPassword, ENT_QUOTES, 'UTF-8') ?>">
      </div>
      <button type="submit">توليد الهاش</button>
    </form>

    <?php if ($generatedHash): ?>
      <div class="hash-result">
        <strong>الهاش الناتج (انسخه إلى config.php):</strong><br><br>
        <code><?= htmlspecialchars($generatedHash, ENT_QUOTES, 'UTF-8') ?></code>
      </div>
    <?php endif; ?>

    <div class="notice">
      <strong>تنبيه أمني:</strong> يُنصح بحذف هذا الملف أو قفل الوصول إليه في بيئة الإنتاج بعد الانتهاء من إعداد كلمة المرور.
    </div>
  </div>
</body>
</html>
