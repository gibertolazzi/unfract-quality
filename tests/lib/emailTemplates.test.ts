import { describe, expect, it } from 'vitest';
import { getCalendarEventEmailHtml, getNotificationEmailHtml, getOrgInviteEmailHtml } from '@/lib/emailTemplates';

const base = {
  recipientName: 'Anna',
  actionTitle: 'Nuova task',
  projectName: 'Progetto',
  taskTitle: 'Task',
  authorName: 'Luca',
  messageHtml: 'ciao',
  actionUrl: '/',
  actionButtonText: 'Apri',
};

describe('getNotificationEmailHtml', () => {
  it('applica l’escape ai valori inseriti dall’utente', () => {
    const html = getNotificationEmailHtml({ ...base, taskTitle: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('non accetta link javascript:', () => {
    const html = getNotificationEmailHtml({ ...base, actionUrl: 'javascript:alert(1)' });
    expect(html).not.toContain('javascript:alert(1)');
  });
});

describe('getOrgInviteEmailHtml', () => {
  it('applica l’escape a nome dell’organizzazione e di chi invita', () => {
    const html = getOrgInviteEmailHtml({
      orgName: '<img src=x onerror=alert(1)>',
      inviterName: '<b>Capo</b>',
      inviteLink: 'https://app.unfract.com/invite/o1',
    });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>Capo</b>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('non accetta link javascript: né attributi iniettati nel link', () => {
    const html = getOrgInviteEmailHtml({ orgName: 'Acme', inviterName: 'Anna', inviteLink: 'javascript:alert(1)' });
    expect(html).not.toContain('javascript:alert(1)');
    const quoted = getOrgInviteEmailHtml({ orgName: 'Acme', inviterName: 'Anna', inviteLink: 'https://a.com/" onclick="x' });
    expect(quoted).not.toContain('" onclick="x');
  });
});

describe('getCalendarEventEmailHtml', () => {
  it('applica l’escape a titolo, data, orario e nome di chi invita', () => {
    for (const action of ['create', 'update', 'cancel'] as const) {
      const html = getCalendarEventEmailHtml({
        eventName: '<script>alert(1)</script>',
        action,
        date: '<i>lunedì</i>',
        time: '<u>10:00</u>',
        inviterName: '<a href="https://evil.example">Anna</a>',
      });
      expect(html).not.toMatch(/<script>|<i>|<u>|<a href="https:\/\/evil/);
      expect(html).toContain('&lt;script&gt;');
    }
  });
});
