import api from './api';
import { TrashItem, TrashSettings } from '@/types';

export const trashApi = {
  getTrash: () => api.get<TrashItem[]>('/trash').then(res => res.data),

  restoreFile: (fileId: number) =>
    api.post(`/trash/${fileId}/restore`).then(res => res.data),

  permanentDelete: (fileId: number) =>
    api.delete(`/trash/${fileId}`).then(res => res.data),

  emptyTrash: () => api.delete('/trash/empty').then(res => res.data),

  getSettings: () => api.get<TrashSettings>('/trash/settings').then(res => res.data),

  updateSettings: (data: { retention_hours: number | null }) =>
    api.put<TrashSettings>('/trash/settings', data).then(res => res.data),
};
