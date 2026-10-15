export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: string;
  category?: string;
  columnId: string;
  epicId?: string;
  date?: string;
  createdAt?: any;
  updatedAt?: any;
  completedAt?: any;
  projectId: string;
  requesterUid?: string;
  assigneeUid?: string;
  createdBy?: string;
  lastModifiedBy?: string;
  mentions?: { type: string; id: string; name: string }[];
  order?: number;
  assignees?: number;
  comments?: any[];
  attachments?: any[];
  meetingId?: string;
  meetingTaskIdx?: number;
}

export interface Column {
  id: string;
  title: string;
  order: number;
  projectId: string;
  /** Da fare, In corso, Completato (lib/taskWorkflow.ts); le colonne vecchie non l'hanno. */
  category?: 'todo' | 'progress' | 'done';
  /** Colonne in cui non si passa da questa (lib/taskWorkflow.ts). */
  blockedTargets?: string[];
  /** Cosa serve per entrare in questa colonna. */
  entryRules?: { assignee?: boolean; dueDate?: boolean; assigneeOnly?: boolean; adminOnly?: boolean };
}

export interface Epic {
  id: string;
  title: string;
  color: string;
  projectId: string;
  createdAt?: string;
}
