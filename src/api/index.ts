// The UI imports `api` from here. Swap this export for the real HTTP client when the backend exists.
import { mockApi } from './mock/api'
export { configureMock, MOCK_OTP } from './mock/db'
export { DEMO_DUPLICATES, DEMO_PASSWORD } from './mock/seed/drafts'
export type * from './types'
export const api = mockApi
