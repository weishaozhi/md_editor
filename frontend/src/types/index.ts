export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface FileItem {
  id: number;
  name: string;
  path: string;
  content: string;
  parent_id: number | null;
  is_folder: boolean;
  owner_id: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface FileTreeItem {
  id: number;
  name: string;
  is_folder: boolean;
  parent_id: number | null;
  children: FileTreeItem[];
}

export interface Version {
  id: number;
  file_id: number;
  content: string;
  comment: string | null;
  version_num: number;
  created_at: string;
}

export interface Plugin {
  id: number;
  name: string;
  version: string;
  description: string | null;
  author: string | null;
  manifest: Record<string, unknown>;
  enabled: boolean;
  config: Record<string, unknown>;
  installed_at: string;
  updated_at: string;
}

export interface Collaborator {
  id: number;
  user_id: number;
  username: string;
  permission: string;
}

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export interface WSMessage {
  type: 'user_joined' | 'user_left' | 'cursor_update' | 'content_change' | 'save';
  user_id?: number;
  username?: string;
  position?: CursorPosition;
  content?: string;
  cursor_position?: CursorPosition;
}

export interface TrashSettings {
  id: number;
  user_id: number;
  retention_hours: number | null;
  created_at: string;
}

export interface TrashItem extends FileItem {
  deleted_at: string;
}
