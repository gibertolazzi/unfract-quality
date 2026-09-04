export interface MeetingTask {
  id: string;
  title: string;
  assignee?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isAssigned?: boolean;
  description?: string;
  columnId?: string;
  globalTaskId?: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  manager: string;
  summary: string;
  decisions: string[];
  tasks: MeetingTask[];
  transcript: string;
  createdAt: any;
}
