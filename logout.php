<?php
/**
 * Secure User Logout & Session Destruction
 * University of Al-Qadisiyah - Maintenance Report System
 */

require_once __DIR__ . '/config.php';

logout_user();

header('Location: login.php');
exit;
