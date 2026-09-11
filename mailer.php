<?php

declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

function send_app_mail(array $config, string $recipient, string $recipientName, string $subject, string $html, string $plain): void
{
    $autoload = __DIR__ . '/vendor/autoload.php';
    if (!is_file($autoload)) throw new RuntimeException('Mail-Abhängigkeiten fehlen.');
    require_once $autoload;
    $mailConfig = $config['mail'] ?? null;
    if (!is_array($mailConfig)) throw new RuntimeException('Mail-Konfiguration fehlt.');

    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = (string) $mailConfig['host'];
    $mail->Port = (int) $mailConfig['port'];
    $mail->SMTPAuth = true;
    $mail->Username = (string) $mailConfig['username'];
    $mail->Password = (string) $mailConfig['password'];
    $mail->SMTPSecure = ($mailConfig['encryption'] ?? 'ssl') === 'tls'
        ? PHPMailer::ENCRYPTION_STARTTLS
        : PHPMailer::ENCRYPTION_SMTPS;
    $mail->CharSet = PHPMailer::CHARSET_UTF8;
    $mail->Timeout = 15;
    $mail->setFrom((string) $mailConfig['from_address'], (string) ($mailConfig['from_name'] ?? '99 Luftballons'));
    $mail->addAddress($recipient, $recipientName);
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body = $html;
    $mail->AltBody = $plain;
    $mail->send();
}

function mail_layout(string $headline, string $message, string $buttonLabel, string $url): string
{
    $safeHeadline = htmlspecialchars($headline, ENT_QUOTES, 'UTF-8');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    $safeLabel = htmlspecialchars($buttonLabel, ENT_QUOTES, 'UTF-8');
    $safeUrl = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
    return '<!doctype html><html lang="de"><body style="margin:0;padding:32px;background:#e1f3f9;color:#243d43;font-family:Arial,sans-serif">'
        . '<div style="max-width:560px;margin:auto;padding:32px;background:#fffdf5;border:1px solid #dce5d7;border-radius:20px">'
        . '<p style="color:#34754a;font-weight:bold">99 LUFTBALLONS</p><h1>' . $safeHeadline . '</h1><p style="line-height:1.6">' . $safeMessage . '</p>'
        . '<p style="margin:28px 0"><a href="' . $safeUrl . '" style="display:inline-block;padding:14px 20px;background:#347847;color:#fff;text-decoration:none;border-radius:12px;font-weight:bold">' . $safeLabel . '</a></p>'
        . '<p style="font-size:12px;color:#627877">Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p></div></body></html>';
}
