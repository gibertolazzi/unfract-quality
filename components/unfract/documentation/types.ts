export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface DocBlock {
  id: string;
  type: 'h2' | 'h3' | 'p' | 'list';
  content: string;
  comments?: Comment[];
}

export interface DocHistory {
  id: string;
  author: string;
  action: string;
  timestamp: string;
}

export interface Document {
  id: string;
  title: string;
  manager: string;
  date: string; 
  company: string; 
  lastUpdate: string; 
  blocks: DocBlock[];
  history?: DocHistory[];
  parentId?: string | null;
}
