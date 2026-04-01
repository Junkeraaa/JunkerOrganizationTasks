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
  closedAt: string; // ISO string
}
