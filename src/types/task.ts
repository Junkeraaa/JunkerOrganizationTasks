export type TaskStatus = 'pending' | 'done';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string; // ISO string
}

export interface DayRecord {
  date: string;    // YYYY-MM-DD
  tasks: Task[];
  notes: string;   // daily notes saved with the record
  closedAt: string; // ISO string
}

export interface BacklogEntry {
  date: string;    // YYYY-MM-DD — the day these tasks were left pending
  tasks: Task[];   // only pending tasks from that day
}

export interface ProjectLink {
  id: string;
  label: string;
  url: string;
}

export type ProjectStatus = 'active' | 'done';

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  sprint: string;
  notes: string;
  subtasks: Task[];
  links: ProjectLink[];
  createdAt: string;  // ISO string
}
