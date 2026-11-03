import { create } from 'zustand';
import { User } from '../types';
import { STORAGE_KEYS } from '../lib/constants';

interface AppState {
  user: User | null;
  token: string | null;
  setUser: (user: User | null, token: string | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  token: null,
  setUser: (user, token) => set({ user, token }),
  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    set({ user: null, token: null });
  },
}));
