import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  writeBatch,
  serverTimestamp,
  arrayUnion,
  getDoc
} from 'firebase/firestore';
import { Task, Column, Epic } from '@/types/tasks';
import type { ColumnCategory } from '@/lib/taskWorkflow';
import { queueNotification, QueuedEmailType } from '@/lib/queueNotification';
import { deleteStoredFile } from '@/lib/usage';

import { appUrl } from '@/lib/appUrl';
export async function deleteTaskAttachments(taskData: any) {
  const attachments = Array.isArray(taskData?.attachments) ? taskData.attachments : [];
  const projectId = taskData?.projectId;
  let projectWorkspaceId: string | undefined = taskData?.workspaceId;
  if (!projectWorkspaceId && projectId) {
    const projectSnap = await getDoc(doc(db, 'projects', projectId));
    projectWorkspaceId = projectSnap.exists() ? projectSnap.data().workspaceId : undefined;
  }

  for (const attachment of attachments) {
    if (!attachment?.refPath) continue;
    // Old attachment metadata may not have recorded size/tracking state: still delete its
    // object, but never guess at a quota decrement for bytes that may not have been counted.
    await deleteStoredFile(attachment.refPath, {
      workspaceId: attachment.workspaceId || projectWorkspaceId,
      bytes: attachment.size,
      usageTracked: attachment.usageTracked === true,
    });
  }
}

async function enqueueTaskEmail(
  recipientId: string | undefined,
  type: QueuedEmailType,
  task: Partial<Task>,
  authorName: string,
  message: string,
  taskId: string
) {
  if (!recipientId) return;
  try {
    await queueNotification({
      recipientId,
      type,
      projectName: 'Unfract',
      taskTitle: task.title || 'Task',
      authorName,
      messageHtml: message,
      actionUrl: `${appUrl()}/`,
      taskId,
    });
  } catch (error) {
    // Email failures must not roll back the task mutation.
    console.error('Unable to enqueue task email:', error);
  }
}

async function enqueueTaskMentions(task: Partial<Task>, actorUid: string | undefined, authorName: string, message: string, taskId: string) {
  const mentionedUserIds = new Set((task.mentions || []).filter(mention => mention.type === 'user').map(mention => mention.id));
  const userIds = Array.from(mentionedUserIds);
  for (let index = 0; index < userIds.length; index += 1) {
    const userId = userIds[index];
    if (userId !== actorUid) await enqueueTaskEmail(userId, 'mention', task, authorName, message, taskId);
  }
}

export const TaskService = {
  subscribeTasks(projectId: string, callback: (tasks: Task[]) => void) {
    const q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
    return onSnapshot(q, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      callback(fetchedTasks);
    });
  },

  async create(taskData: Partial<Task>) {
    const { auth } = require('@/lib/firebase');
    const currentUser = auth.currentUser;
    const docRef = await addDoc(collection(db, 'tasks'), {
      ...taskData,
      requesterUid: taskData.requesterUid || currentUser?.uid || null,
      createdBy: taskData.createdBy || currentUser?.uid || null,
      lastModifiedBy: currentUser?.uid || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      order: 999,
      assignees: 1,
      comments: []
    });

    const { createNotification } = require('./notificationService');
    const notifyAssigneeUid = taskData.assigneeUid;
    if (notifyAssigneeUid) {
      createNotification({
        userId: notifyAssigneeUid,
        title: 'Nuova task assegnata',
        description: `Sei stato assegnato a "${taskData.title || 'Nuova Task'}"`,
        type: 'task',
        link: '/'
      });
    }

    const authorName = currentUser?.displayName || 'Utente';
    if (taskData.assigneeUid && taskData.assigneeUid !== currentUser?.uid) {
      await enqueueTaskEmail(taskData.assigneeUid, 'assignment', taskData, authorName, 'Ti è stata assegnata una task.', docRef.id);
    }
    await enqueueTaskMentions(taskData, currentUser?.uid, authorName, 'Sei stato menzionato in una task.', docRef.id);

    return docRef;
  },

  async update(taskId: string, updates: Partial<Task>) {
    const taskRef = doc(db, 'tasks', taskId);
    const taskSnapshot = await getDoc(taskRef);
    const previous = taskSnapshot.exists() ? taskSnapshot.data() as Task : null;
    const { auth } = require('@/lib/firebase');
    const currentUser = auth.currentUser;
    const persistedUpdates = {
      ...updates,
      updatedAt: serverTimestamp(),
      ...(currentUser ? { lastModifiedBy: currentUser.uid } : {}),
    };
    const result = await updateDoc(taskRef, persistedUpdates);
    if (!previous) return result;

    const actorUid = currentUser?.uid;
    const actorName = currentUser?.displayName || 'Utente';
    const task = { ...previous, ...persistedUpdates };
    const changedFields = Object.keys(updates).filter(key => key !== 'updatedAt');
    if (changedFields.length === 0) return result;

    if (updates.assigneeUid && updates.assigneeUid !== previous.assigneeUid && updates.assigneeUid !== actorUid) {
      await enqueueTaskEmail(updates.assigneeUid, 'assignment', task, actorName, 'Ti è stata assegnata una task.', taskId);
      const { createNotification } = require('./notificationService');
      createNotification({
        userId: updates.assigneeUid,
        title: 'Nuova task assegnata',
        description: `Sei stato assegnato a "${task.title || 'Task'}"`,
        type: 'task',
        link: '/'
      });
    }
    if (previous.requesterUid && previous.requesterUid !== actorUid) {
      await enqueueTaskEmail(previous.requesterUid, 'requester', task, actorName, 'La task per cui hai fatto richiesta è stata aggiornata.', taskId);
    }
    await enqueueTaskEmail(actorUid, 'changes', task, actorName, 'Le tue modifiche sono state salvate.', taskId);
    const newMentions = (updates.mentions || []).filter(mention =>
      !previous.mentions?.some(existing => existing.type === mention.type && existing.id === mention.id)
    );
    await enqueueTaskMentions({ ...task, mentions: newMentions }, actorUid, actorName, 'Sei stato menzionato in una task.', taskId);
    return result;
  },

  async delete(taskId: string, meetingId?: string, meetingTaskIdx?: number) {
    const taskRef = doc(db, 'tasks', taskId);
    const taskSnapshot = await getDoc(taskRef);
    if (taskSnapshot.exists()) await deleteTaskAttachments(taskSnapshot.data());

    if (meetingId && meetingTaskIdx !== undefined) {
      const meetingRef = doc(db, 'meetings', meetingId);
      const meetingSnap = await getDoc(meetingRef);
      if (meetingSnap.exists()) {
        const meetingData = meetingSnap.data();
        const newTasks = [...(meetingData.tasks || [])];
        if (newTasks[meetingTaskIdx] && newTasks[meetingTaskIdx].globalTaskId === taskId) {
          const updatedTask = { ...newTasks[meetingTaskIdx], isAssigned: false };
          delete updatedTask.globalTaskId;
          newTasks[meetingTaskIdx] = updatedTask;
          await updateDoc(meetingRef, { tasks: newTasks });
        }
      }
    }
    return await deleteDoc(taskRef);
  },

  async addComment(taskId: string, commentData: any) {
    const taskRef = doc(db, 'tasks', taskId);
    const taskSnapshot = await getDoc(taskRef);
    const result = await updateDoc(taskRef, {
      comments: arrayUnion(commentData),
      updatedAt: serverTimestamp(),
      ...(commentData.authorUid ? { lastModifiedBy: commentData.authorUid } : {}),
    });
    const task = taskSnapshot.exists() ? taskSnapshot.data() as Task : null;
    if (!task) return result;
    const authorUid = commentData.authorUid as string | undefined;
    const authorName = commentData.author || 'Utente';
    const message = commentData.text || 'È stato aggiunto un commento alla task.';
    if (task.requesterUid && task.requesterUid !== authorUid) {
      await enqueueTaskEmail(task.requesterUid, 'requester', task, authorName, message, taskId);
    }
    await enqueueTaskEmail(authorUid, 'changes', task, authorName, 'Il tuo commento è stato aggiunto.', taskId);
    await enqueueTaskMentions({ ...task, mentions: commentData.mentions || [] }, authorUid, authorName, 'Sei stato menzionato in un commento.', taskId);
    return result;
  },

  async updateComments(taskId: string, comments: any[]) {
    return await updateDoc(doc(db, 'tasks', taskId), {
      comments
    });
  },

  async batchUpdate(updates: { id: string; [key: string]: any }[]) {
    const batch = writeBatch(db);
    updates.forEach(update => {
      const { id, ...data } = update;
      batch.update(doc(db, 'tasks', id), data);
    });
    return await batch.commit();
  }
};

export const ColumnService = {
  subscribe(projectId: string, callback: (columns: Column[]) => void) {
    const q = query(collection(db, 'columns'), where('projectId', '==', projectId));
    return onSnapshot(q, (snapshot) => {
      const fetchedCols = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Column)).sort((a, b) => a.order - b.order);
      callback(fetchedCols);
    });
  },

  async create(projectId: string, title: string, order: number, category: ColumnCategory = 'todo') {
    return await addDoc(collection(db, 'columns'), { title, order, projectId, category });
  },

  async update(columnId: string, updates: Partial<Column>) {
    return await updateDoc(doc(db, 'columns', columnId), updates);
  },

  /**
   * Elimina una colonna spostando prima le sue attività in un'altra, in
   * un'unica scrittura. Prima le attività restavano legate a una colonna che
   * non c'era più: sparivano dalla bacheca e in Panoramica contavano come da
   * fare.
   */
  async deleteAndMoveTasks(columnId: string, targetColumnId: string, taskIds: string[], startOrder: number) {
    if (taskIds.length > 450) throw new Error('Troppe attività da spostare in una volta.');
    const batch = writeBatch(db);
    taskIds.forEach((id, i) => batch.update(doc(db, 'tasks', id), { columnId: targetColumnId, order: startOrder + i }));
    batch.delete(doc(db, 'columns', columnId));
    return await batch.commit();
  },

  async batchUpdateOrder(updates: { id: string; order: number }[]) {
    const batch = writeBatch(db);
    updates.forEach(update => {
      batch.update(doc(db, 'columns', update.id), { order: update.order });
    });
    return await batch.commit();
  }
};

export const EpicService = {
  subscribe(projectId: string, callback: (epics: Epic[]) => void) {
    const q = query(collection(db, 'epics'), where('projectId', '==', projectId));
    return onSnapshot(q, (snapshot) => {
      const fetchedEpics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Epic));
      callback(fetchedEpics);
    });
  },

  async create(projectId: string, title: string, color: string) {
    return await addDoc(collection(db, 'epics'), {
      title,
      color,
      createdAt: new Date().toISOString(),
      projectId
    });
  },
  
  async update(epicId: string, updates: Partial<Epic>) {
    return await updateDoc(doc(db, 'epics', epicId), updates);
  },

  async delete(epicId: string) {
    return await deleteDoc(doc(db, 'epics', epicId));
  }
};
