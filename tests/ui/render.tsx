import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '@/App'
import { api } from '@/api'

export async function resetWorld() {
  await api.dev.reset()
  await api.logout()
  localStorage.clear()
}

export function renderApp(path = '/signup') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}
