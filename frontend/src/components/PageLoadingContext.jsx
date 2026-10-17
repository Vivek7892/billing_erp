import { createContext, useContext } from 'react'

export const PageLoadingContext = createContext(() => {})

export function usePageLoadingRegistration() {
  return useContext(PageLoadingContext)
}
