import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function fetchProjectContext(projectId: string): Promise<string> {
  if (!projectId) return "No project active.";
  
  let context = "";

  try {
    // Fetch Tasks
    const tasksQuery = query(collection(db, 'tasks'), where('projectId', '==', projectId));
    const tasksSnapshot = await getDocs(tasksQuery);
    context += "--- TASKS ---\n";
    tasksSnapshot.forEach(doc => {
      const data = doc.data();
      context += `[TASK ID: ${doc.id}] - Title: ${data.title} - Status: ${data.status} - Priority: ${data.priority} - Assignee: ${data.assignee || 'Unassigned'}\n`;
    });

    // Fetch Meetings
    const meetingsQuery = query(collection(db, 'meetings'), where('projectId', '==', projectId));
    const meetingsSnapshot = await getDocs(meetingsQuery);
    context += "\n--- MEETINGS ---\n";
    meetingsSnapshot.forEach(doc => {
      const data = doc.data();
      context += `[MEETING ID: ${doc.id}] - Date: ${data.date} - Summary: ${data.summary}\n`;
    });

    return context;
  } catch (e) {
    console.error("Error fetching context for AI:", e);
    return "Error loading context.";
  }
}
