import type { ApiKey } from '../types'

let counter = 0
export function makeKey(env: 'SANDBOX' | 'LIVE', status: 'ACTIVE' | 'INACTIVE'): ApiKey {
  counter += 1
  const rnd = Math.random().toString(36).slice(2, 14).padEnd(12, '0')
  return {
    id: `key_${Date.now().toString(36)}_${counter}`,
    name: 'default',
    env,
    key: `${env === 'LIVE' ? 'sk_live' : 'sk_test'}_${rnd}`,
    status,
  }
}
