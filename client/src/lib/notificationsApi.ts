import { api } from './api'

export const notificationsApi = {
  getNotifications: (cursor?: string, limit = 20) =>
    api.get('/notifications', { params: { cursor, limit } }),

  getUnreadCount: () => api.get('/notifications/unread-count'),

  markAllAsRead: () => api.post('/notifications/read'),

  markAsRead: (id: string) => api.post(`/notifications/${id}/read`),
}