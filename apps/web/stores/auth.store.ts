// APG Manager RMS - Auth Store (Zustand - quản lý trạng thái đăng nhập)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  // Lưu vào localStorage để persist khi reload
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
    {
      name: 'apg-auth',
      // Chỉ lưu thông tin cơ bản, không lưu token
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
