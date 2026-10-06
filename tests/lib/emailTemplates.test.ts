import { describe, expect, it } from 'vitest';
import { getNotificationEmailHtml } from '@/lib/emailTemplates';

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
