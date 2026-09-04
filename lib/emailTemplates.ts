export interface NotificationEmailProps {
  recipientName: string;
  actionTitle: string; // e.g. "Giacomo ti ha menzionato in una task"
  projectName: string;
  taskTitle: string;
  authorName: string;
  authorAvatarUrl?: string;
  messageHtml: string;
  actionUrl: string;
  actionButtonText: string;
}

export function getNotificationEmailHtml(props: NotificationEmailProps): string {
  // Use the application URL for images. In production, ensure NEXT_PUBLIC_APP_URL is set in .env
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tuodominio.com';
  const bannerUrl = `${baseUrl}/email-banner.png`;
  
  // Fallback avatar if none is provided
  const avatarHtml = props.authorAvatarUrl 
    ? `<img src="${props.authorAvatarUrl}" width="32" height="32" style="border-radius: 50%; display: block;" alt="${props.authorName}" />`
    : `<div style="width: 32px; height: 32px; border-radius: 50%; background-color: #006AFF; color: #FFFFFF; font-weight: bold; text-align: center; line-height: 32px; font-family: sans-serif; font-size: 14px;">${props.authorName.charAt(0).toUpperCase()}</div>`;

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notifica Unfract</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse: collapse; margin: 0; padding: 0;}
    body {background-color: #0A0A0A;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; -webkit-font-smoothing: antialiased;">
  
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #0A0A0A; margin: 0; padding: 0; width: 100%;">
    <tr>
      <td align="center" style="padding: 40px 10px;">
        
        <!-- Main Email Container -->
        <table width="600" border="0" cellpadding="0" cellspacing="0" style="background-color: #121212; border-radius: 16px; overflow: hidden; width: 100%; max-width: 600px; margin: 0 auto; border: 1px solid #222222;">
          
          <!-- Banner Image -->
          <tr>
            <td style="padding: 0; text-align: center;">
              <img src="${bannerUrl}" width="600" style="width: 100%; max-width: 600px; height: auto; display: block; border: 0;" alt="Unfract Banner" />
            </td>
          </tr>

          <!-- Email Content padding -->
          <tr>
            <td style="padding: 30px 40px;">
              
              <!-- Action Title -->
              <h2 style="margin: 0 0 24px 0; font-size: 16px; font-weight: 500; color: #E0E0E0; text-align: left;">
                ${props.actionTitle}
              </h2>

              <!-- Inner Card (Task details) -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #1A1A1A; border-radius: 12px; border: 1px solid #2A2A2A; width: 100%;">
                <tr>
                  <td style="padding: 24px;">
                    
                    <!-- Project & Task Name -->
                    <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 500; color: #888888; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${props.projectName}
                    </p>
                    <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #006AFF; text-decoration: none;">
                      ${props.taskTitle}
                    </h3>

                    <!-- Author & Message -->
                    <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                      <tr>
                        <td valign="top" style="padding-right: 12px; width: 32px;">
                          ${avatarHtml}
                        </td>
                        <td valign="top">
                          <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #FFFFFF;">
                            ${props.authorName}
                          </p>
                          <div style="margin: 0; font-size: 14px; line-height: 1.5; color: #B0B0B0;">
                            ${props.messageHtml}
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA Button -->
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="left" style="border-radius: 6px;" bgcolor="#006AFF">
                          <a href="${props.actionUrl}" target="_blank" style="font-size: 14px; font-family: sans-serif; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; padding: 12px 24px; border: 1px solid #006AFF; display: inline-block;">
                            ${props.actionButtonText}
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>
              
              <!-- Footer Text -->
              <p style="margin: 30px 0 0 0; font-size: 12px; color: #666666; text-align: center; line-height: 1.5;">
                Ricevi questa email perché hai abilitato le notifiche in Unfract.<br>
                <a href="${baseUrl}/organization" style="color: #006AFF; text-decoration: underline;">Modifica le preferenze email</a>
              </p>

            </td>
          </tr>
        </table>
        <!-- End Main Email Container -->

      </td>
    </tr>
  </table>

</body>
</html>
  `;

}

export interface OrgInviteEmailProps {
  inviterName: string;
  orgName: string;
  inviteLink: string;
}

export function getOrgInviteEmailHtml(props: OrgInviteEmailProps): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tuodominio.com';
  const bannerUrl = `${baseUrl}/email-banner.png`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invito a partecipare a ${props.orgName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #FFFFFF;">
  
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #000000; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #0A0A0A; border-radius: 24px; border: 1px solid #222222; overflow: hidden; max-width: 600px; width: 100%;">
          <tr>
            <td>
              <!-- Banner Section -->
              <img src="${bannerUrl}" alt="Unfract Banner" style="width: 100%; max-width: 600px; height: auto; display: block; background-color: #111111;">
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              
              <!-- Content Section -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 30px;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background-color: #006AFF; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                      <img src="${baseUrl}/email-banner.png" alt="Unfract Logo" style="width: 24px; height: 24px; opacity: 0; /* Fallback icon if you want to replace it */" />
                    </div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #FFFFFF; letter-spacing: -0.5px; line-height: 1.3;">
                      Sei stato invitato in ${props.orgName}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin: 0 0 24px 0; font-size: 16px; color: #A0A0A0; line-height: 1.6; text-align: center;">
                      <strong style="color: #FFFFFF;">${props.inviterName}</strong> ti ha invitato a unirti all'organizzazione <strong>${props.orgName}</strong> su Unfract.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 10px; padding-bottom: 20px;">
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="border-radius: 12px;" bgcolor="#006AFF">
                          <a href="${props.inviteLink}" target="_blank" style="font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 16px 32px; display: inline-block; font-weight: 500; letter-spacing: 0.2px; border-radius: 12px;">Accetta Invito</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Footer Text -->
              <p style="margin: 30px 0 0 0; font-size: 12px; color: #666666; text-align: center; line-height: 1.5;">
                Unfract - Il nuovo modo di organizzare il tuo lavoro.
              </p>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export interface QueuedNotification {
  id: string;
  type: string;
  projectName: string;
  taskTitle?: string;
  authorName: string;
  authorAvatarUrl?: string;
  messageHtml: string;
  actionUrl: string;
  createdAt: number;
}

export interface RecapEmailProps {
  recipientName: string;
  notifications: QueuedNotification[];
}

export function getRecapEmailHtml(props: RecapEmailProps): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tuodominio.com';
  const bannerUrl = `${baseUrl}/email-banner.png`;

  const notificationsListHtml = props.notifications.map(n => {
    const avatarHtml = n.authorAvatarUrl 
      ? `<img src="${n.authorAvatarUrl}" width="24" height="24" style="border-radius: 50%; display: block;" alt="${n.authorName}" />`
      : `<div style="width: 24px; height: 24px; border-radius: 50%; background-color: #006AFF; color: #FFFFFF; font-weight: bold; text-align: center; line-height: 24px; font-family: sans-serif; font-size: 10px;">${n.authorName.charAt(0).toUpperCase()}</div>`;

    return `
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 16px; background-color: #1A1A1A; border-radius: 12px; border: 1px solid #2A2A2A; width: 100%;">
        <tr>
          <td style="padding: 16px;">
            <p style="margin: 0 0 4px 0; font-size: 10px; font-weight: 500; color: #888888; text-transform: uppercase; letter-spacing: 0.5px;">
              ${n.projectName} ${n.taskTitle ? '• ' + n.taskTitle : ''}
            </p>
            <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
              <tr>
                <td valign="top" style="padding-right: 12px; width: 24px;">
                  ${avatarHtml}
                </td>
                <td valign="top">
                  <p style="margin: 0 0 2px 0; font-size: 13px; font-weight: 600; color: #FFFFFF;">
                    ${n.authorName}
                  </p>
                  <div style="margin: 0; font-size: 13px; line-height: 1.4; color: #B0B0B0;">
                    ${n.messageHtml}
                  </div>
                </td>
              </tr>
            </table>
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="left">
                  <a href="${n.actionUrl}" target="_blank" style="font-size: 12px; font-family: sans-serif; font-weight: 600; color: #006AFF; text-decoration: none;">
                    Visualizza →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notifiche Unfract</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #0A0A0A; margin: 0; padding: 0; width: 100%;">
    <tr>
      <td align="center" style="padding: 40px 10px;">
        <table width="600" border="0" cellpadding="0" cellspacing="0" style="background-color: #121212; border-radius: 16px; overflow: hidden; width: 100%; max-width: 600px; margin: 0 auto; border: 1px solid #222222;">
          <tr>
            <td style="padding: 0; text-align: center;">
              <img src="${bannerUrl}" width="600" style="width: 100%; max-width: 600px; height: auto; display: block; border: 0;" alt="Unfract Banner" />
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="margin: 0 0 24px 0; font-size: 16px; font-weight: 500; color: #E0E0E0; text-align: left;">
                Ciao ${props.recipientName}, hai ${props.notifications.length} nuove notifiche
              </h2>
              ${notificationsListHtml}
              <p style="margin: 30px 0 0 0; font-size: 12px; color: #666666; text-align: center; line-height: 1.5;">
                Ricevi questa email perché hai abilitato le notifiche in Unfract.<br>
                <a href="${baseUrl}/organization" style="color: #006AFF; text-decoration: underline;">Modifica le preferenze email</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
