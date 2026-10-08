import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const EMAIL_TYPES = new Set(['assignment', 'requester', 'changes', 'mention', 'message']);

/** Una menzione salvata su messaggi, task e commenti. */
type Mention = { type?: string; id?: string };

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });

  try {
    const identity = await adminAuth.verifyIdToken(token);
    const input = await request.json();
    if (!input || typeof input !== 'object') {
      return NextResponse.json({ error: 'Payload non valido' }, { status: 400 });
    }
    const recipientId = typeof input.recipientId === 'string' ? input.recipientId : '';
    const type = typeof input.type === 'string' ? input.type : '';
    if (!recipientId || !EMAIL_TYPES.has(type)) {
      return NextResponse.json({ error: 'Destinatario o tipo notifica non valido' }, { status: 400 });
    }
    if (recipientId === identity.uid && type !== 'changes') {
      return NextResponse.json({ error: 'Non puoi inviarti notifiche email da solo' }, { status: 403 });
    }

    let actionUrl = '/';
    if (type === 'message' || (type === 'mention' && input.chatId)) {
      const chatId = typeof input.chatId === 'string' ? input.chatId : '';
      const messageId = typeof input.messageId === 'string' ? input.messageId : '';
      if (!chatId || !messageId) return NextResponse.json({ error: 'Riferimento messaggio mancante' }, { status: 400 });
      const [chatSnapshot, messageSnapshot] = await Promise.all([
        adminDb.collection('chats').doc(chatId).get(),
        adminDb.collection('messages').doc(messageId).get(),
      ]);
      if (!chatSnapshot.exists || !messageSnapshot.exists) return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 });

      const chat = chatSnapshot.data()!;
      const message = messageSnapshot.data()!;
      const members = Array.isArray(chat.members) ? chat.members : [];
      if (message.chatId !== chatId || message.senderId !== identity.uid || !members.includes(identity.uid) || !members.includes(recipientId)) {
        return NextResponse.json({ error: 'Notifica chat non autorizzata' }, { status: 403 });
      }
      if (type === 'mention' && !(message.mentions || []).some((mention: Mention) => mention.type === 'user' && mention.id === recipientId)) {
        return NextResponse.json({ error: 'Destinatario non menzionato nel messaggio' }, { status: 403 });
      }
      actionUrl = `/chat`;
    } else {
      const taskId = typeof input.taskId === 'string' ? input.taskId : '';
      if (!taskId) return NextResponse.json({ error: 'Riferimento task mancante' }, { status: 400 });
      const taskSnapshot = await adminDb.collection('tasks').doc(taskId).get();
      if (!taskSnapshot.exists) return NextResponse.json({ error: 'Task non trovata' }, { status: 404 });
      const task = taskSnapshot.data()!;
      const isRecentActor = task.lastModifiedBy === identity.uid || task.createdBy === identity.uid;
      if (!isRecentActor) return NextResponse.json({ error: 'Evento task non autorizzato' }, { status: 403 });
      const activityTime = task.updatedAt?.toMillis?.() || task.createdAt?.toMillis?.() || 0;
      if (!activityTime || Date.now() - activityTime > 10 * 60_000) {
        return NextResponse.json({ error: 'Evento task scaduto' }, { status: 409 });
      }

      if (type === 'assignment' && task.assigneeUid !== recipientId) {
        return NextResponse.json({ error: 'Il destinatario non è l’assegnatario' }, { status: 403 });
      }
      if (type === 'requester' && task.requesterUid !== recipientId) {
        return NextResponse.json({ error: 'Il destinatario non è il richiedente' }, { status: 403 });
      }
      if (type === 'changes' && identity.uid !== recipientId) {
        return NextResponse.json({ error: 'Destinatario modifiche non valido' }, { status: 403 });
      }
      if (type === 'mention') {
        const taskMentions = Array.isArray(task.mentions) ? task.mentions : [];
        const commentMentions = (Array.isArray(task.comments) ? task.comments : []).flatMap((comment: { mentions?: Mention[] }) => comment.mentions || []);
        const mentions = [...taskMentions, ...commentMentions];
        if (!mentions.some((mention: Mention) => mention.type === 'user' && mention.id === recipientId)) {
          return NextResponse.json({ error: 'Destinatario non menzionato nella task' }, { status: 403 });
        }
      }
      actionUrl = `/?highlightTask=${encodeURIComponent(taskId)}`;
    }

    const message = typeof input.messageHtml === 'string' ? input.messageHtml.slice(0, 2000) : '';
    const authorName = identity.name || identity.email || 'Utente';
    await adminDb.collection('notifications_queue').add({
      recipientId,
      type,
      projectName: typeof input.projectName === 'string' ? input.projectName.slice(0, 120) : 'Unfract',
      taskTitle: typeof input.taskTitle === 'string' ? input.taskTitle.slice(0, 200) : '',
      authorName: authorName.slice(0, 120),
      messageHtml: message,
      actionUrl,
      createdAt: FieldValue.serverTimestamp(),
      processed: false,
      attempts: 0,
    });

    return NextResponse.json({ queued: true }, { status: 202 });
  } catch (error) {
    console.error('Unable to queue email notification:', error);
    if (typeof error === 'object' && error !== null && 'code' in error && String(error.code).startsWith('auth/')) {
      return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Impossibile accodare la notifica email' }, { status: 500 });
  }
}
