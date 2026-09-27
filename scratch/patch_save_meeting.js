const fs = require('fs');
const filePath = 'lib/meetings.ts';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `export async function saveMeeting(projectId: string, meetingData: Omit<Meeting, 'id' | 'createdAt'>): Promise<string | null> {
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
}`;

const newStr = `export async function saveMeeting(projectId: string, meetingData: Omit<Meeting, 'id' | 'createdAt'>): Promise<string | null> {
  try {
    if (!projectId) throw new Error("projectId is required");
    
    // Per eliminare il meeting dopo 3 giorni tramite Firebase TTL
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3);

    const dataToSave = {
      ...meetingData,
      projectId,
      createdAt: serverTimestamp(),
      expiresAt: expiresAt
    };
    const docRef = await addDoc(collection(db, COLLECTION_NAME), dataToSave);
    return docRef.id;
  } catch (error) {
    console.error("Error saving meeting:", error);
    return null;
  }
}`;

content = content.replace(targetStr, newStr);
fs.writeFileSync(filePath, content);
