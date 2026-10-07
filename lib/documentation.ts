import { db } from './firebase';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { Document, DocBlock } from '@/types/documentation';
import { deleteStoredFile } from '@/lib/usage';

const COLLECTION_NAME = 'documentation';

export async function getDocuments(projectId: string): Promise<Document[]> {
  try {
    if (!projectId) return [];
    const q = query(
      collection(db, COLLECTION_NAME),
      where('projectId', '==', projectId),
      orderBy('updatedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'Nuovo Documento',
        manager: data.manager || 'Utente',
        date: data.date || new Date().toLocaleDateString('it-IT'),
        company: data.company || 'Unfract',
        lastUpdate: data.lastUpdate || 'poco fa',
        blocks: data.blocks || [],
        history: data.history || [],
        projectId: data.projectId
      } as Document & { projectId?: string };
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return [];
  }
}

export function subscribeToDocuments(projectId: string, callback: (docs: Document[]) => void) {
  if (!projectId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, COLLECTION_NAME),
    where('projectId', '==', projectId)
  );
  return onSnapshot(q, (snapshot) => {
    let documents = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'Nuovo Documento',
        manager: data.manager || 'Utente',
        date: data.date || new Date().toLocaleDateString('it-IT'),
        company: data.company || 'Unfract',
        lastUpdate: data.lastUpdate || 'poco fa',
        blocks: data.blocks || [],
        history: data.history || [],
        projectId: data.projectId,
        updatedAt: data.updatedAt,
        parentId: data.parentId || null
      } as Document & { projectId?: string, updatedAt?: any };
    });
    
    // Local sort to avoid requiring a composite index
    documents.sort((a, b) => {
      const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
      const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
      return timeB - timeA;
    });
    
    callback(documents);
  }, (error) => {
    console.error("Error subscribing to documents:", error);
    callback([]);
  });
}

export async function getDocumentById(id: string): Promise<(Document & { projectId?: string }) | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.warn("Document does not exist in Firestore for ID:", id);
      return null;
    }
    
    const data = docSnap.data();
    return {
      id: docSnap.id,
      title: data.title || 'Nuovo Documento',
      manager: data.manager || 'Utente',
      date: data.date || new Date().toLocaleDateString('it-IT'),
      company: data.company || 'Unfract',
      lastUpdate: data.lastUpdate || 'poco fa',
      blocks: data.blocks || [],
      history: data.history || [],
      projectId: data.projectId,
      parentId: data.parentId || null
    } as Document & { projectId?: string };
  } catch (error) {
    console.error("Error fetching document by ID:", error);
    return null;
  }
}

export async function createDocument(projectId: string, managerName: string = 'Utente', parentId?: string): Promise<string | null> {
  try {
    if (!projectId) throw new Error("projectId is required");
    const docData = {
      projectId,
      parentId: parentId || null,
      title: 'Nuovo Documento',
      manager: managerName,
      date: new Date().toLocaleDateString('it-IT'),
      company: 'Unfract',
      lastUpdate: 'ora',
      blocks: [
        { id: Math.random().toString(36).substr(2, 9), type: 'p', content: '', comments: [] }
      ],
      history: [
        {
          id: Math.random().toString(36).substr(2, 9),
          author: managerName,
          action: 'Ha creato il documento',
          timestamp: new Date().toLocaleDateString('it-IT')
        }
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);

    const { auth } = require('@/lib/firebase');
    const { createNotification } = require('./services/notificationService');
    const currentUser = auth.currentUser;
    if (currentUser) {
      createNotification({
        userId: currentUser.uid,
        title: 'Nuovo documento',
        description: `${managerName} ha creato "${docData.title}"`,
        type: 'documentation',
        link: `/documentation/${docRef.id}`
      });
    }

    return docRef.id;
  } catch (error) {
    console.error("Error creating document:", error);
    return null;
  }
}

export async function duplicateDocument(id: string, authorName: string = 'Utente'): Promise<string | null> {
  try {
    const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (!docSnap.exists()) return null;
    
    const original = docSnap.data();
    
    const duplicatedData = {
      ...original,
      title: `${original.title} (Copia)`,
      manager: authorName,
      date: new Date().toLocaleDateString('it-IT'),
      lastUpdate: 'ora',
      history: [
        {
          id: Math.random().toString(36).substr(2, 9),
          author: authorName,
          action: 'Ha duplicato il documento',
          timestamp: new Date().toLocaleDateString('it-IT')
        }
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), duplicatedData);
    return docRef.id;
  } catch (error) {
    console.error("Error duplicating document:", error);
    return null;
  }
}

export async function updateDocument(id: string, updates: Partial<Document>, authorName: string = 'Utente'): Promise<boolean> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    
    // Create history entry
    const historyEntry = {
      id: Math.random().toString(36).substr(2, 9),
      author: authorName,
      action: 'Ha modificato il documento',
      timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    };

    const firestoreUpdates = {
      ...updates,
      lastUpdate: 'proprio ora',
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(docRef, firestoreUpdates);
    return true;
  } catch (error) {
    console.error("Error updating document:", error);
    return false;
  }
}

export async function deleteDocument(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const storageFiles = snapshot.data().storageFiles || [];
      for (const file of storageFiles) {
        if (!file?.storagePath) continue;
        await deleteStoredFile(file.storagePath, {
          workspaceId: file.workspaceId,
          bytes: file.sizeBytes,
          usageTracked: file.usageTracked === true,
        });
      }
    }
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("Error deleting document:", error);
    return false;
  }
}
