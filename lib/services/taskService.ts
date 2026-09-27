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

export const TaskService = {
  subscribeTasks(projectId: string, callback: (tasks: Task[]) => void) {
    const q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
    return onSnapshot(q, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      callback(fetchedTasks);
    });
  },

  async create(taskData: Partial<Task>) {
    return await addDoc(collection(db, 'tasks'), {
      ...taskData,
      createdAt: serverTimestamp(),
      order: 999,
      assignees: 1,
      comments: []
    });
  },

  async update(taskId: string, updates: Partial<Task>) {
    return await updateDoc(doc(db, 'tasks', taskId), updates);
  },

  async delete(taskId: string, meetingId?: string, meetingTaskIdx?: number) {
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
    return await deleteDoc(doc(db, 'tasks', taskId));
  },

  async addComment(taskId: string, commentData: any) {
    return await updateDoc(doc(db, 'tasks', taskId), {
      comments: arrayUnion(commentData)
    });
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

  async create(projectId: string, title: string, order: number) {
    return await addDoc(collection(db, 'columns'), { title, order, projectId });
  },

  async update(columnId: string, updates: Partial<Column>) {
    return await updateDoc(doc(db, 'columns', columnId), updates);
  },

  async delete(columnId: string) {
    return await deleteDoc(doc(db, 'columns', columnId));
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
