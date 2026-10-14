import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SendReminderEmailParams {
  to: string;
  userName?: string | null;
  subscriptionName: string;
  amount: number;
  billingDate: Date;
  subscriptionId?: string;
  billingCycle?: string;
  daysLeft?: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 8000,
      });
      this.logger.log(
        ` Email service initialized with SMTP host: ${process.env.SMTP_HOST}`,
      );
    } else {
      this.logger.log(
        'ℹ️ SMTP credentials not set in .env: EmailService running in simulated console mode.',
      );
    }
  }

  /**
   * Generates the email HTML strictly matching the requested design template.
   */
  private generateHtmlTemplate(params: SendReminderEmailParams): string {
    const appName = process.env.APP_NAME || 'SubRemind';
    const userName = params.userName || params.to.split('@')[0] || 'Subscriber';
    const subscriptionName = params.subscriptionName;
    const daysLeft =
      params.daysLeft !== undefined ? String(params.daysLeft) : '3';
    const billingDate = params.billingDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const amount = params.amount.toFixed(2);
    const currency = '$';
    const billingCycle = params.billingCycle
      ? params.billingCycle.charAt(0).toUpperCase() +
        params.billingCycle.slice(1).toLowerCase()
      : 'Monthly';
    const paymentMethod = 'Card on file';
    const subscriptionId = params.subscriptionId || 'N/A';
    const baseUrl = process.env.APP_URL || 'http://localhost:4000';
    const manageUrl = `${baseUrl}/api`;
    const settingsUrl = `${baseUrl}/api`;
    const unsubscribeUrl = `${baseUrl}/api`;
    const supportEmail =
      process.env.SUPPORT_EMAIL || 'support@subremind.local';
    const year = String(new Date().getFullYear());

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${subscriptionName} renews in ${daysLeft} days</title>
  <!--
    TEMPLATE VARIABLES (Handlebars-style, swap for your engine of choice)
    {{appName}} {{userName}} {{subscriptionName}} {{daysLeft}} {{billingDate}}
    {{amount}} {{currency}} {{billingCycle}} {{paymentMethod}} {{subscriptionId}}
    {{manageUrl}} {{settingsUrl}} {{unsubscribeUrl}} {{supportEmail}} {{year}}
  -->
  <style>
    body { margin:0; padding:0; background:#F4F4F8; }
    table { border-collapse:collapse; }
    img { border:0; display:block; }
    a { color:#6C63FF; }
    @media only screen and (max-width:620px) {
      .container { width:100% !important; }
      .px { padding-left:20px !important; padding-right:20px !important; }
      .h1 { font-size:22px !important; line-height:30px !important; }
      .big { font-size:44px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F4F4F8;">

<!-- Preheader (hidden inbox preview text) -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F4F4F8;">
  ${subscriptionName} will charge ${currency}${amount} on ${billingDate}. Here is what to expect.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F8;">
<tr><td align="center" style="padding:24px 12px;">

  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FAFAFC;font-family:Helvetica,Arial,sans-serif;color:#1F1F2E;">

    <!-- Header -->
    <tr>
      <td class="px" style="padding:28px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="left" style="font-size:22px;font-weight:bold;color:#1F1F2E;">
              <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:#6C63FF;color:#fff;border-radius:7px;font-size:15px;">&#128276;</span>
              &nbsp;${appName}
            </td>
            <td align="right" style="font-size:15px;color:#4A4A5E;">${userName}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Headline -->
    <tr>
      <td class="px" style="padding:36px 40px 0 40px;">
        <h1 class="h1" style="margin:0;font-size:26px;line-height:34px;font-weight:bold;color:#1F1F2E;">
          ${subscriptionName} renews in ${daysLeft} days
        </h1>
      </td>
    </tr>

    <!-- Countdown block (replaces illustration, email-safe) -->
    <tr>
      <td align="center" style="padding:32px 40px 8px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:220px;background:#FFFFFF;border:1px solid #E6E4FB;border-radius:16px;">
          <tr>
            <td align="center" style="background:#6C63FF;border-radius:15px 15px 0 0;padding:10px 0;font-size:14px;font-weight:bold;color:#FFFFFF;">
              ${billingDate}
            </td>
          </tr>
          <tr>
            <td align="center" class="big" style="padding:18px 0 2px 0;font-size:56px;line-height:60px;font-weight:bold;color:#1F1F2E;">
              ${daysLeft}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 0 18px 0;font-size:14px;color:#6B6B80;">days until charge</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body copy -->
    <tr>
      <td class="px" style="padding:28px 40px 0 40px;font-size:16px;line-height:24px;color:#1F1F2E;">
        <p style="margin:0 0 16px 0;">Hi ${userName},</p>
        <p style="margin:0;">
          This is a quick heads-up that your <strong>${subscriptionName}</strong> subscription will
          automatically charge <strong>${currency}${amount}</strong> on <strong>${billingDate}</strong>.
          If you want to keep it, you don't need to do anything. If not, cancel before that date to avoid the charge.
        </p>
      </td>
    </tr>

    <!-- CTA -->
    <tr>
      <td align="center" style="padding:28px 40px 8px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" bgcolor="#6C63FF" style="border-radius:6px;">
              <a href="${manageUrl}" style="display:inline-block;padding:13px 52px;font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;font-family:Helvetica,Arial,sans-serif;">Manage subscription</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Upcoming charge card -->
    <tr>
      <td class="px" style="padding:32px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #ECECF4;border-radius:16px;">
          <tr>
            <td style="padding:22px 24px 4px 24px;font-size:13px;color:#4A4A5E;">Upcoming charge from ${subscriptionName}</td>
          </tr>
          <tr>
            <td style="padding:6px 24px 4px 24px;font-size:32px;line-height:40px;font-weight:bold;color:#1F1F2E;">${currency}${amount}</td>
          </tr>
          <tr>
            <td style="padding:0 24px 18px 24px;font-size:13px;color:#4A4A5E;">Due ${billingDate}</td>
          </tr>
          <tr>
            <td style="padding:0 24px 22px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
                <tr>
                  <td style="padding:7px 0;color:#4A4A5E;">Billing cycle</td>
                  <td align="right" style="padding:7px 0;color:#1F1F2E;">${billingCycle}</td>
                </tr>
                <tr>
                  <td style="padding:7px 0;color:#4A4A5E;">Payment method</td>
                  <td align="right" style="padding:7px 0;color:#1F1F2E;">${paymentMethod}</td>
                </tr>
                <tr>
                  <td style="padding:7px 0;color:#4A4A5E;">Subscription ID</td>
                  <td align="right" style="padding:7px 0;color:#1F1F2E;">${subscriptionId}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Summary card -->
    <tr>
      <td class="px" style="padding:24px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #ECECF4;border-radius:16px;">
          <tr>
            <td style="padding:22px 24px 0 24px;font-size:13px;font-weight:bold;color:#1F1F2E;">Charge summary</td>
          </tr>
          <tr>
            <td style="padding:14px 24px 16px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#4A4A5E;">
                <tr>
                  <td>Renews on ${billingDate}</td>
                  <td align="right">${billingCycle} subscription</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 12px 18px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F8;border-radius:14px;font-size:15px;">
                <tr>
                  <td style="padding:14px 12px 6px 12px;color:#4A4A5E;">Total</td>
                  <td align="right" style="padding:14px 12px 6px 12px;color:#1F1F2E;font-weight:bold;">${currency}${amount}</td>
                </tr>
                <tr>
                  <td style="padding:6px 12px 14px 12px;color:#4A4A5E;">Amount due</td>
                  <td align="right" style="padding:6px 12px 14px 12px;color:#1F1F2E;font-weight:bold;">${currency}${amount}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Help box (forms don't work in email, so this is a reply link) -->
    <tr>
      <td class="px" style="padding:32px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1F1F2E;border-radius:6px;">
          <tr>
            <td style="padding:28px 28px 8px 28px;font-size:20px;line-height:28px;font-weight:bold;color:#1F1F2E;">Already cancelled, or something looks wrong?</td>
          </tr>
          <tr>
            <td style="padding:0 28px 18px 28px;font-size:15px;line-height:22px;color:#4A4A5E;">
              Update or delete this subscription in your dashboard so you stop getting reminders, or write to us and we'll help.
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" bgcolor="#6C63FF" style="border-radius:6px;">
                    <a href="mailto:${supportEmail}?subject=Question%20about%20${encodeURIComponent(subscriptionName)}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Contact support</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Sign-off -->
    <tr>
      <td class="px" style="padding:32px 40px 36px 40px;font-size:16px;line-height:24px;color:#1F1F2E;">
        Thanks for using ${appName} to keep your subscriptions in check.<br><br>
        Best regards,<br>
        The ${appName} Team
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:0 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDEDF1;">
          <tr>
            <td align="center" style="padding:28px 24px;font-size:12px;line-height:18px;color:#4A4A5E;">
              &copy; ${year} ${appName}<br><br>
              This is an automated reminder. You received it because you added ${subscriptionName} to your ${appName} account.
              Change how many days ahead we remind you in your <a href="${settingsUrl}" style="color:#4A4A5E;">reminder settings</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="px" style="padding:12px 40px 24px 40px;font-size:11px;">
        <a href="${unsubscribeUrl}" style="color:#6B6B80;">Unsubscribe</a>
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
  }

  async sendReminderEmail(
    params: SendReminderEmailParams,
  ): Promise<{ messageId: string }> {
    const daysLeft =
      params.daysLeft !== undefined ? String(params.daysLeft) : '3';
    const formattedDate = params.billingDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const subject = `${params.subscriptionName} renews in ${daysLeft} days`;
    const text = `Hi ${params.userName || 'there'},\n\nThis is a quick heads-up that your ${params.subscriptionName} subscription will automatically charge $${params.amount.toFixed(2)} on ${formattedDate}.\n\nManage subscription: ${process.env.APP_URL || 'http://localhost:4000'}/api\n\nBest regards,\n${process.env.APP_NAME || 'SubRemind'} Team`;
    const html = this.generateHtmlTemplate(params);

    // Basic email validation
    if (!params.to || !params.to.includes('@')) {
      throw new Error(`Invalid email address: "${params.to}"`);
    }

    if (this.transporter) {
      const info = await this.transporter.sendMail({
        from:
          process.env.SMTP_FROM ||
          `"${process.env.APP_NAME || 'SubRemind'}" <no-reply@subscriptions.local>`,
        to: params.to,
        subject,
        text,
        html,
      });
      this.logger.log(
        `✉️ [REAL EMAIL SENT via SMTP] To: ${params.to} | MessageId: ${info.messageId}`,
      );
      return { messageId: info.messageId };
    }

    // Default logged delivery for local / demo environment
    this.logger.log(
      `✉️ [EMAIL DISPATCHED] To: ${params.to} | Subject: "${subject}" | Amount: $${params.amount.toFixed(2)} | Due: ${formattedDate}`,
    );

    return { messageId: `msg-${Date.now()}` };
  }
}
