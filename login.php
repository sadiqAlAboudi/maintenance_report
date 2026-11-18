<?php
/**
 * Secure Login Interface
 * University of Al-Qadisiyah - Maintenance Report System
 */

require_once __DIR__ . '/config.php';

// Redirect to report page if already authenticated
if (is_authenticated()) {
    header('Location: index.php');
    exit;
}

$errorMessage = '';
$rateLimitStatus = check_rate_limit(5, 900); // 5 attempts maximum, 15-minute lockout

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!$rateLimitStatus['allowed']) {
        http_response_code(429);
        $waitMinutes = ceil($rateLimitStatus['retry_after'] / 60);
        $errorMessage = "تم تجاوز الحد الأقصى للمحاولات الخاطئة. يرجى الانتظار {$waitMinutes} دقيقة والمحاولة مجدداً.";
    } elseif (!verify_csrf_token($_POST['csrf_token'] ?? null)) {
        $errorMessage = 'انتهت صلاحية الجلسة، يرجى تحديث الصفحة وإعادة المحاولة.';
    } else {
        $password = (string)($_POST['password'] ?? '');

        if ($password !== '' && verify_password($password)) {
            // Authentication successful: clear logs, regenerate session ID to prevent fixation
            clear_failed_attempts();
            session_regenerate_id(true);

            $_SESSION['qu_authenticated'] = true;
            $_SESSION['qu_fingerprint']   = get_client_fingerprint();
            $_SESSION['qu_created_at']    = time();
            $_SESSION['qu_last_activity']  = time();

            header('Location: index.php');
            exit;
        }

        // Authentication failed
        record_failed_attempt(900);
        $rateLimitStatus = check_rate_limit(5, 900);
        if (!$rateLimitStatus['allowed']) {
            http_response_code(429);
            $waitMinutes = ceil($rateLimitStatus['retry_after'] / 60);
            $errorMessage = "تم قفل الحساب مؤقتاً لتكرار المحاولات الخاطئة. انتظر {$waitMinutes} دقيقة.";
        } else {
            $remaining = $rateLimitStatus['remaining'];
            $errorMessage = "كلمة المرور غير صحيحة! (المحاولات المتبقية: {$remaining})";
        }
    }
}

$csrfToken = get_csrf_token();
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تسجيل الدخول | نظام تقارير الصيانة - جامعة القادسية</title>
  <meta name="robots" content="noindex, nofollow" />

  <link rel="preload" href="./IBM-Plex-Sans-Arabic.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="css/style.css" />
  <link rel="icon" href="images/favicon.ico" sizes="any" />
  <link rel="icon" type="image/svg+xml" href="images/uni_logo.svg" />
  <meta name="theme-color" content="#000000" />

  <style>
    .login-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      width: 100%;
      padding: 16px;
    }

    .login-card {
      background: #ffffff;
      width: 100%;
      max-width: 440px;
      padding: 32px 28px;
      border-radius: 12px;
      border: 1px solid #d0d7de;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
      text-align: center;
    }

    .login-card header img {
      width: 80px;
      height: 80px;
      object-fit: contain;
      margin-bottom: 12px;
    }

    .login-card header h2 {
      font-size: 1.35rem;
      font-weight: 700;
      margin-bottom: 4px;
      color: #111;
    }

    .login-card header p {
      font-size: 0.9rem;
      color: #666;
      margin-bottom: 24px;
    }

    .login-card form {
      text-align: right;
    }

    .login-card .field {
      margin-bottom: 20px;
    }

    .login-card label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      font-size: 0.95rem;
      color: #333;
    }

    .login-card input[type="password"] {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-family: inherit;
      font-size: 1rem;
      background: #fafbfc;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .login-card input[type="password"]:focus {
      outline: none;
      border-color: #000;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.1);
    }

    .login-card .error-alert {
      background: #ffebe9;
      color: #cf222e;
      border: 1px solid rgba(255, 129, 130, 0.4);
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 0.88rem;
      margin-bottom: 18px;
      text-align: right;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .login-card button[type="submit"] {
      width: 100%;
      padding: 12px;
      background: #000000;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-family: inherit;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }

    .login-card button[type="submit"]:hover {
      background: #222222;
    }

    .login-card button[type="submit"]:active {
      transform: scale(0.98);
    }

    .login-footer {
      margin-top: 24px;
      font-size: 0.8rem;
      color: #888;
    }
  </style>
</head>

<body>
  <div class="login-container">
    <div class="login-card">
      <header>
        <img src="images/uni_logo.png" alt="شعار جامعة القادسية" />
        <h2>تسجيل الدخول للنظام</h2>
        <p>شعبة صيانة الحاسبات والشبكات - جامعة القادسية</p>
      </header>

      <?php if (!empty($errorMessage)): ?>
        <div class="error-alert" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span><?= htmlspecialchars($errorMessage, ENT_QUOTES, 'UTF-8') ?></span>
        </div>
      <?php endif; ?>

      <form method="POST" action="login.php" autocomplete="on">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />

        <div class="field">
          <label for="password">كلمة المرور:</label>
          <input 
            type="password" 
            id="password" 
            name="password" 
            required 
            autofocus 
            autocomplete="current-password" 
            placeholder="••••••••" 
          />
        </div>

        <button type="submit">دخول للنظام</button>
      </form>

      <div class="login-footer">
        استمارة رسمية مخصصة للكوادر المعتمدة فقط
      </div>
    </div>
  </div>
</body>

</html>
