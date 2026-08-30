import { api } from './api'

export const chatApi = {
  getConversations: () => api.get('/conversations'),

  getConversation: (id: string) => api.get(`/conversations/${id}`),

  createConversation: (otherUserId: string) =>
    api.post('/conversations', { otherUserId }),

  getMessages: (conversationId: string, cursor?: string, limit = 20) =>
    api.get(`/conversations/${conversationId}/messages`, {
      params: { cursor, limit },
    }),

  sendMessage: (conversationId: string, data: { content?: string; mediaUrl?: string; clientId?: string }) =>
    api.post(`/conversations/${conversationId}/messages`, data),

  markAsRead: (conversationId: string) =>
    api.post(`/conversations/${conversationId}/read`),

  getUnreadCount: (conversationId: string) =>
    api.get(`/conversations/${conversationId}/unread-count`),
}