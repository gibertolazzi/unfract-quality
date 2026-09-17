import { db } from './firebase';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { Meeting } from '@/components/unfract/meetings/types';

const COLLECTION_NAME = 'meetings';

export async function getMeetings(projectId: string): Promise<Meeting[]> {
  try {
    if (!projectId) return [];
    const q = query(
      collection(db, COLLECTION_NAME),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'Meeting Senza Titolo',
        date: data.date || new Date().toLocaleDateString('it-IT'),
        duration: data.duration || '0 min',
        manager: data.manager || 'Utente',
        summary: data.summary || '',
        decisions: data.decisions || [],
        tasks: data.tasks || [],
        transcript: data.transcript || data.transcription || data.trascrizione || data.text || '',
        createdAt: data.createdAt,
        projectId: data.projectId
      } as Meeting & { projectId?: string };
    });
  } catch (error) {
    console.error("Error fetching meetings:", error);
    return [];
  }
}

export function subscribeToMeetings(projectId: string, callback: (meetings: Meeting[]) => void) {
  if (!projectId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, COLLECTION_NAME),
    where('projectId', '==', projectId)
  );
  return onSnapshot(q, (snapshot) => {
    const meetings = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'Meeting Senza Titolo',
        date: data.date || new Date().toLocaleDateString('it-IT'),
        duration: data.duration || '0 min',
        manager: data.manager || 'Utente',
        summary: data.summary || '',
        decisions: data.decisions || [],
        tasks: data.tasks || [],
        transcript: data.transcript || data.transcription || data.trascrizione || data.text || '',
        createdAt: data.createdAt,
        projectId: data.projectId
      } as Meeting & { projectId?: string };
    });
    
    // Local sort to avoid requiring a composite index in Firestore
    meetings.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });
    
    callback(meetings);
  }, (error) => {
    console.error("Error subscribing to meetings:", error);
    callback([]);
  });
}

export async function getMeetingById(id: string): Promise<(Meeting & { projectId?: string }) | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    return {
      id: docSnap.id,
      title: data.title || 'Meeting Senza Titolo',
      date: data.date || new Date().toLocaleDateString('it-IT'),
      duration: data.duration || '0 min',
      manager: data.manager || 'Utente',
      summary: data.summary || '',
      decisions: data.decisions || [],
      tasks: data.tasks || [],
      transcript: data.transcript || data.transcription || data.trascrizione || data.text || '',
      createdAt: data.createdAt,
      projectId: data.projectId
    } as Meeting & { projectId?: string };
  } catch (error) {
    console.error("Error fetching meeting by ID:", error);
    return null;
  }
}

export async function saveMeeting(projectId: string, meetingData: Omit<Meeting, 'id' | 'createdAt'>): Promise<string | null> {
  try {
    if (!projectId) throw new Error("projectId is required");
    const dataToSave = {
      ...meetingData,
      projectId,
      createdAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, COLLECTION_NAME), dataToSave);
    return docRef.id;
  } catch (error) {
    console.error("Error saving meeting:", error);
    return null;
  }
}

export async function deleteMeeting(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return true;
  } catch (error) {
    console.error("Error deleting meeting:", error);
    return false;
  }
}
