import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Notifiche per le modifiche fatte da un assistente, come quelle dell'app
 * (lib/services/taskService.ts e /api/notifications/email):
 * - all'assegnatario nuovo: notifica nell'app ed email «assegnazione»;
 * - al richiedente: email «aggiornamento».
 *
 * Il mittente è l'utente che ha collegato l'assistente; il nome dice anche
 * con quale app («Anna tramite Claude»). I testi sono fissi: niente contenuto
 * scritto dall'assistente nelle email. Le preferenze email di chi riceve le
 * applica il processo della coda, come per l'app.
 *
 * Un errore di notifica non annulla la modifica.
 */

export interface Actor {
  uid: string;
  name: string;
  clientName: string;
}

const actorLabel = (actor: Actor) => `${actor.name} tramite ${actor.clientName || 'un assistente AI'}`.slice(0, 120);

async function queueEmail(recipientId: string, type: 'assignment' | 'requester', task: { title?: string }, taskId: string, actor: Actor, message: string) {
  await adminDb.collection('notifications_queue').add({
    recipientId,
    senderId: actor.uid,
    type,
    projectName: 'Unfract',
    taskTitle: String(task.title || 'Task').slice(0, 200),
    authorName: actorLabel(actor),
    messageHtml: message,
    actionUrl: `/?highlightTask=${encodeURIComponent(taskId)}`,
    createdAt: FieldValue.serverTimestamp(),
    processed: false,
    attempts: 0,
  });
}

export async function notifyAssignment(assigneeUid: string | null | undefined, task: { title?: string }, taskId: string, actor: Actor) {
  if (!assigneeUid || assigneeUid === actor.uid) return;
  try {
    await adminDb.collection('notifications').add({
      userId: assigneeUid,
      title: 'Nuova task assegnata',
      description: `Sei stato assegnato a "${String(task.title || 'Task').slice(0, 200)}" (${actorLabel(actor)})`,
      type: 'task',
      link: '/',
      senderId: actor.uid,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    await queueEmail(assigneeUid, 'assignment', task, taskId, actor, 'Ti è stata assegnata una task.');
  } catch (error) {
    console.error('MCP assignment notification failed:', error instanceof Error ? error.message : error);
  }
}

export async function notifyRequester(task: { title?: string; requesterUid?: string | null }, taskId: string, actor: Actor, message: string) {
  if (!task.requesterUid || task.requesterUid === actor.uid) return;
  try {
    await queueEmail(task.requesterUid, 'requester', task, taskId, actor, message);
  } catch (error) {
    console.error('MCP requester notification failed:', error instanceof Error ? error.message : error);
  }
}
