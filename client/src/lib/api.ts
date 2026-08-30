import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Auth endpoints
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, username: string, displayName: string) =>
    api.post('/auth/register', { email, password, username, displayName }),
  me: () => api.get('/auth/me'),
}

// User endpoints
export const userApi = {
  getProfile: (username: string) => api.get(`/users/${username}`),
  updateProfile: (data: any) => api.patch('/users/me', data),
  follow: (userId: string) => api.post(`/users/${userId}/follow`),
  unfollow: (userId: string) => api.delete(`/users/${userId}/follow`),
  getFollowers: (username: string) => api.get(`/users/${username}/followers`),
  getFollowing: (username: string) => api.get(`/users/${username}/following`),
  getTopCreators: () => api.get('/users/top/creators'),
  getMostLiked: () => api.get('/users/most-likes'),
}

export { API_BASE_URL }

// Upload endpoints
export const uploadApi = {
  uploadImage: (file: File) => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', file)
    return axios.post(`${API_BASE_URL}/upload/image`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  uploadVideo: (file: File) => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', file)
    return axios.post(`${API_BASE_URL}/upload/video`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}

// Video endpoints
export const videoApi = {
  getVideoStatus: (postId: string) =>
    api.get(`/videos/post/${postId}/status`),
  getVideoStatusById: (videoId: string) =>
    api.get(`/videos/${videoId}/status`),
}

// Hashtag endpoints
export const hashtagApi = {
  getPosts: (tag: string, type: 'popular' | 'latest' | 'following' = 'latest') =>
    api.get(`/hashtags/${encodeURIComponent(tag)}/posts`, { params: { type } }),
  getTrending: () => api.get('/hashtags/trending'),
}

// Post endpoints
export const postApi = {
  getHashtagPosts: (tag: string, type: 'popular' | 'latest' | 'following') =>
    api.get(`/hashtags/${encodeURIComponent(tag)}/posts`, { params: { type } }),
  getFeed: (cursor?: string) => api.get('/posts/feed', { params: { cursor } }),
  getFollowingFeed: (cursor?: string) => api.get('/posts/following-feed', { params: { cursor } }),
  getUserPosts: (username: string, cursor?: string) => api.get(`/posts/user/${username}`, { params: { cursor } }),
  getUserReposts: (username: string, cursor?: string) =>
    api.get(`/posts/user/${username}/reposts`, { params: { cursor } }),
  getUserLikedPosts: (username: string, cursor?: string) =>
    api.get(`/posts/user/${username}/likes`, { params: { cursor } }),
  getPost: (postId: string) => api.get(`/posts/${postId}`),
  createPost: (content: string, mediaUrls?: string[], videoId?: string) =>
    api.post('/posts', { content, mediaUrls, videoId }),
  deletePost: (postId: string) => api.delete(`/posts/${postId}`),
  like: (postId: string) => api.post(`/posts/${postId}/like`),
  unlike: (postId: string) => api.delete(`/posts/${postId}/like`),
  toggleLike: (postId: string) => api.post(`/posts/${postId}/like`),
  repost: (postId: string) => api.post(`/posts/${postId}/repost`),
  unrepost: (postId: string) => api.delete(`/posts/${postId}/repost`),
  quotePost: (postId: string, content: string) =>
    api.post(`/posts/${postId}/quote`, { content }),
  pinPost: (postId: string) => api.post(`/posts/${postId}/pin`),
  unpinPost: (postId: string) => api.delete(`/posts/${postId}/pin`),
  getComments: (postId: string, cursor?: string) =>
    api.get(`/posts/${postId}/comments`, { params: { cursor } }),
  createComment: (postId: string, content: string) =>
    api.post(`/posts/${postId}/comment`, { content }),
  deleteComment: (commentId: string) => api.delete(`/posts/comments/${commentId}`),
  getThread: (postId: string) => api.get(`/posts/${postId}/thread`),
  createReply: (postId: string, content: string) =>
    api.post(`/posts/${postId}/reply`, { content }),
}

// Chat endpoints
export const chatApi = {
  getConversations: () => api.get('/conversations'),
  createConversation: (otherUserId: string) =>
    api.post('/conversations', { otherUserId }),
  getConversation: (conversationId: string) =>
    api.get(`/conversations/${conversationId}`),
  getMessages: (conversationId: string, cursor?: string, limit = 20) =>
    api.get(`/conversations/${conversationId}/messages`, { params: { cursor, limit } }),
  sendMessage: (conversationId: string, data: { content?: string; mediaUrl?: string; clientId?: string }) =>
    api.post(`/conversations/${conversationId}/messages`, data),
  markAsRead: (conversationId: string) =>
    api.post(`/conversations/${conversationId}/read`),
  getUnreadCount: (conversationId: string) =>
    api.get(`/conversations/${conversationId}/unread-count`),
}