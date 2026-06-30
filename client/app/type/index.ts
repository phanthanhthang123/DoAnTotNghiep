export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: "Admin" | "Leader" | "Member";
  mustChangePassword?: boolean;
  resetToken?: string | null;
  resetTokenExpiry?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  avatarUrl?: string | null;
  /** KPI khởi tạo (Logistic Regression HM) */
  kpiScore?: number | null;
  kpiModelAtSignup?: "A" | "B" | string | null;
  cpa?: number | null;
  yearsAtCompany?: number;
  interviewScore?: number | null;
  cvScore?: number | null;
  yearsExperience?: number;
  numProjectsPrior?: number;
  isActive?: boolean;
}

export interface AppNotification {
  id: string;
  user_id: string;
  message: string;
  is_read: "TRUE" | "FALSE";
  payload?: any | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  onwner: User | string;
  color: string;
  status: 'Active' | 'Archived' | 'Deleted';
  createdAt: string | null;  
  updatedAt: string | null;
  members?: any[];
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  Workspace: Workspace | string;
  startDate: Date | null;
  dueDate: Date | null;
  progress: number;
  tasks?: Task[];
  members?: {
    user: User | string;
    role: 'Admin' | 'Leader' | 'Member';
  }[];
  status: 'Active' | 'Archived' | 'Deleted';
  createdAt: Date | null;  
  updatedAt: Date | null;
  isArchived?: boolean;
  githubRepoUrl?: string | null;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'To Do' | 'In Progress' | 'Done';
  project: Project | string;
  createdAt: Date | null;  
  updatedAt: Date | null;
  isArchived?: boolean;
  dueDate: Date | null;
  priority: 'Low' | 'Medium' | 'High';
  assigned_to?: User[] | string | null;
  assignedUser?: User;
  createdBy: User | string;
  assigners?: User[] | string[] | null;
  subtasks?: Subtask[];
  watchers?: User[] | string[] | null;
  attachments?: Attachment[];
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  pullRequestUrl?: string | null;
}

export enum TaskStatus {
  TO_DO = 'To Do',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done',
}

export interface Attachment {
  filename: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadBy: User |  string;
  uploadedAt: Date | null;
  id : string;
}

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
}

export enum ProjectMemberRole {
  ADMIN = 'Admin',
  LEADER = 'Leader',
  MEMBER = 'Member',
}

export type ResourceType = 
  | "Task"
  | "Project"
  | "Workspace"
  | "Comment"
  | "User"


export type ActionType =
  | "created_task"
  | "updated_task"
  | "created_subtask"
  | "updated_subtask"
  | "completed_task"
  | "created_project"
  | "updated_project"
  | "completed_project"
  | "created_workspace"
  | "updated_workspace"
  | "added_comment"
  | "added_reply"
  | "edited_comment"
  | "added_member"
  | "removed_member"
  | "joined_workspace"
  | "added_attachment"
  | "TITLE_UPDATED"
  | "STATUS_UPDATED"
  | "DESCRIPTION_UPDATED"
  | "ASSIGNEES_UPDATED"
  | "PRIORITY_UPDATED"
  | "DUE_DATE_UPDATED"
  | "WATCHED"
  | "UNWATCHED"
  | "TASK_ACHIEVED"
  | "TASK_ARCHIVED"
  | "TASK_UNARCHIVED"
  | "PULL_REQUEST_UPDATED"
  | "DIFFICULTY_UPDATED";


  export interface ActivityLog {
    id: string;
    user : User | string;
    action: ActionType;
    resourceType: ResourceType;
    resourceId: string;
    payload?: any;
    createdAt: Date;
  }

  export interface Comment {
    id: string | number;
    task_id: string | number;
    user_id: string;
    content: string;
    user?: User;
    createdAt: Date | string;
    updatedAt: Date | string;
  }

export interface ConversationMember {
  id: string;
  user_id: string;
  role: 'owner' | 'member';
  last_read_at?: string | null;
  user?: User;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  attachment_url?: string | null;
  reply_to_id?: string | null;
  replyTo?: Message | null;
  edited_at?: string | null;
  is_pinned?: boolean;
  pinned_by?: string | null;
  deleted_at?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: User;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  title?: string | null;
  workspace_id?: string | null;
  created_by?: string | null;
  members: ConversationMember[];
  lastMessage?: Message | null;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}