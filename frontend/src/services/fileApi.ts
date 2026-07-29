import api from './api';
import { FileItem, FileTreeItem, Version } from '@/types';

export const fileApi = {
  getTree: () => api.get<FileTreeItem[]>('/files/tree').then(res => res.data),

  getFiles: (parentId?: number) =>
    api.get<FileItem[]>('/files', { params: { parent_id: parentId } }).then(res => res.data),

  getFolders: () => api.get<FileItem[]>('/files/folders').then(res => res.data),

  getFile: (id: number) => api.get<FileItem>(`/files/${id}`).then(res => res.data),

  createFile: (data: { name: string; content?: string; parent_id?: number; is_folder?: boolean }) =>
    api.post<FileItem>('/files', data).then(res => res.data),

  updateFile: (id: number, data: { name?: string; content?: string; parent_id?: number }) =>
    api.put<FileItem>(`/files/${id}`, data).then(res => res.data),

  renameFile: (id: number, name: string) =>
    api.put<FileItem>(`/files/${id}`, { name }).then(res => res.data),

  moveFile: (id: number, parentId: number | null) =>
    api.put<FileItem>(`/files/${id}`, { parent_id: parentId }).then(res => res.data),

  exportFileUrl: (id: number, format: 'md' | 'html') =>
    `/api/files/${id}/export?format=${format}`,
  exportFile: (id: number, format: 'md' | 'html') =>
    api
      .get<Blob>(`/files/${id}/export`, { params: { format }, responseType: 'blob' })
      .then(res => res.data),

  deleteFile: (id: number) => api.delete(`/files/${id}`).then(res => res.data),

  searchFiles: (q: string) => api.get<FileItem[]>('/files/search/', { params: { q } }).then(res => res.data),

  getVersions: (fileId: number) =>
    api.get<Version[]>(`/files/${fileId}/versions`).then(res => res.data),

  createVersion: (fileId: number, comment?: string) =>
    api.post<Version>(`/files/${fileId}/versions`, { comment }).then(res => res.data),

  getVersion: (fileId: number, versionId: number) =>
    api.get<Version>(`/files/${fileId}/versions/${versionId}`).then(res => res.data),

  restoreVersion: (fileId: number, versionId: number) =>
    api.post<FileItem>(`/files/${fileId}/versions/${versionId}/restore`).then(res => res.data),
};
