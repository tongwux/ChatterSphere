import { create } from 'zustand';
export const useChat = create((set) => ({
  selected: null,
  drafts: {},
  unread: {},
  attempts: {},
  select: (user) => set((s) => ({ selected: user, unread: { ...s.unread, [user?._id]: 0 } })),
  draft: (id, text) => set((s) => ({ drafts: { ...s.drafts, [id]: text } })),
  notify: (id) => set((s) => ({ unread: { ...s.unread, [id]: (s.unread[id] || 0) + 1 } })),
  attempt: (id, attempt) => set((s) => ({ attempts: { ...s.attempts, [id]: attempt } })),
  reset: () => set({ selected: null, drafts: {}, unread: {}, attempts: {} }),
}));
