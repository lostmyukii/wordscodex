import type { User } from '@wordscodex/contracts'
import { create } from 'zustand'

type AuthState = {
  accessToken: string | null
  user: User | null
  initialized: boolean
  setSession: (session: { accessToken: string; user: User }) => void
  clearSession: () => void
  finishInitialization: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  initialized: false,
  setSession: ({ accessToken, user }) =>
    set({
      accessToken,
      user,
      initialized: true,
    }),
  clearSession: () =>
    set({
      accessToken: null,
      user: null,
      initialized: true,
    }),
  finishInitialization: () => set({ initialized: true }),
}))
