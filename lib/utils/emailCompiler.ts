export function generateEmailHtml(blocks: any[]): string {
  const renderStyle = (style: any) => {
    if (!style) return '';
    let styleString = '';
    if (style.backgroundColor) styleString += `background-color: ${style.backgroundColor}; `;
    if (style.color) styleString += `color: ${style.color}; `;
    if (style.textAlign) styleString += `text-align: ${style.textAlign}; `;
    if (style.padding) styleString += `padding: ${style.padding}; `;
    if (style.borderRadius) styleString += `border-radius: ${style.borderRadius}; `;
    return styleString;
  };

  const renderBlock = (block: any) => {
    const styleAttr = renderStyle(block.style);
    const content = block.content || '';
    
    let blockHtml = '';
    switch (block.type) {
      case 'title':
        blockHtml = `<h1 style="margin: 0; font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; line-height: 1.2; ${styleAttr}">${content}</h1>`;
        break;
      case 'text':
        // Replace newlines with <br>
        const formattedText = content.replace(/\\n/g, '<br>');
        blockHtml = `<p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; ${styleAttr}">${formattedText}</p>`;
        break;
      case 'image':
        blockHtml = `
          <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
            <tr>
              <td align="center" style="${styleAttr}">
                <img src="${content}" alt="Image" style="max-width: 100%; height: auto; border: 0; display: block; border-radius: ${block.style?.borderRadius || '0'};" />
              </td>
            </tr>
          </table>
        `;
        return blockHtml; // Image has its own table wrapper logic for centering
      case 'button':
        blockHtml = `
          <table border="0" cellspacing="0" cellpadding="0" role="presentation" style="margin: 0 auto;">
            <tr>
              <td align="center" style="border-radius: 8px; background-color: #1A1A1A;">
                <a href="#" target="_blank" style="display: inline-block; padding: 12px 24px; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 8px; ${styleAttr}">${content}</a>
              </td>
            </tr>
          </table>
        `;
        break;
      case 'divider':
        blockHtml = `
          <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
            <tr>
              <td style="padding: 16px 0; ${styleAttr}">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
                  <tr>
                    <td style="border-top: 1px solid #E5E5E5; font-size: 1px; line-height: 1px;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        `;
        return blockHtml; // Divider handles its own structure
      default:
        blockHtml = `<div>${content}</div>`;
    }

    // Default wrapping for standard blocks (text, title, button)
    return `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
        <tr>
          <td style="${styleAttr}">
            ${blockHtml}
          </td>
        </tr>
      </table>
    `;
  };

  const rows = blocks.map(block => renderBlock(block)).join('\\n');

  return `<!DOCTYPE html>
<html lang="it" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Meyou Campaign</title>
  <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f6f6f6; }
    
    @media screen and (max-width: 600px) {
      .responsive-table { width: 100% !important; }
      .mobile-hidden { display: none !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f6f6;">
  <center style="width: 100%; background-color: #f6f6f6;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;" class="email-container">
      <!--[if mso]>
      <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600">
      <tr>
      <td style="background-color: #ffffff;">
      <![endif]-->
      
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: auto;">
        ${blocks.map(block => `
        <tr>
          <td align="center" valign="top">
            ${renderBlock(block)}
          </td>
        </tr>
        `).join('')}
      </table>
      
      <!-- Footer Legale Obbligatorio (Art. 130 Codice Privacy e GDPR) -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 32px; border-top: 1px solid #E5E5E5; padding: 24px 16px;">
        <tr>
          <td align="center" style="font-family: Arial, sans-serif; font-size: 12px; color: #888888; line-height: 1.6;">
            <p style="margin: 0 0 6px 0;">Ricevi questa email perché hai prestato il consenso alle comunicazioni di Unfract.</p>
            <p style="margin: 0 0 6px 0;">Unfract S.r.l. • P.IVA / C.F. 00000000000 • Sede Legale: Italia</p>
            <p style="margin: 0;">
              Non desideri più ricevere queste comunicazioni? 
              <a href="{{unsubscribe_url}}" target="_blank" style="color: #006AFF; text-decoration: underline;">Disiscriviti qui con un clic</a>.
            </p>
          </td>
        </tr>
      </table>
      
      <!--[if mso]>
      </td>
      </tr>
      </table>
      <![endif]-->
    </div>
  </center>
</body>
</html>`;
}
