import { create } from 'zustand'

interface AppState {
  apiKey: string | null
  apiBaseUrl: string
  aiProvider: 'openai' | 'mock'
  
  // Actions
  setApiKey: (key: string | null) => void
  setApiBaseUrl: (url: string) => void
  setAiProvider: (provider: 'openai' | 'mock') => void
}

// Simple localStorage helpers
const getStoredApiKey = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('paperflow-api-key')
  }
  return null
}

const setStoredApiKey = (key: string | null) => {
  if (typeof window !== 'undefined') {
    if (key) {
      localStorage.setItem('paperflow-api-key', key)
    } else {
      localStorage.removeItem('paperflow-api-key')
    }
  }
}

export const useAppStore = create<AppState>((set) => ({
  apiKey: getStoredApiKey(),
  apiBaseUrl: 'http://localhost:3002',
  aiProvider: 'mock',
  
  setApiKey: (key) => {
    setStoredApiKey(key)
    set({ apiKey: key })
  },
  setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
  setAiProvider: (provider) => set({ aiProvider: provider }),
}))