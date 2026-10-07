// In-memory + localStorage backed "database" for the mock API. Passwords are stored in clear text
// ON PURPOSE: this is test data in the browser, never a real backend.
import type {
  ApiKey,
  AuditEntry,
  NotificationItem,
  UpgradeInfo,
} from '../types'
import type { KybStatus, KycLevel, Limits, MerchantStatus, PartnerDraft, RejectionInfo } from '@/shared/types'
import { seedPartners } from './seed/partners'

export interface PartnerRecord {
  id: string
  createdAt: string
  status: MerchantStatus
  kyb: KybStatus | null
  draft: PartnerDraft
  kycLevel: KycLevel | null
  submittedAt: string | null
  reviewedAt: string | null
  rejection: RejectionInfo | null
  rejectionHistory: RejectionInfo[]
  limits: Limits | null
  sandboxKeys: ApiKey[]
  liveKeys: ApiKey[]
  contractSignedAt: string | null
  contractSignedBy: string | null
  annualVolumeDzd: number
  monthlyVolumeDzd: number
  checklist: Record<string, boolean>
  notifications: NotificationItem[]
  audit: AuditEntry[]
  upgrade: (UpgradeInfo & { draft: PartnerDraft; checklist: Record<string, boolean> }) | null
}

export interface MockDb {
  partners: PartnerRecord[]
  sessionPartnerId: string | null
  verified: string[] // `${channel}:${value}` verified by OTP
  seq: number
}

const KEY = 'mizaniya.mock.db.v1'
let cache: MockDb | null = null

export const MOCK_OTP = '123456'

function hasStorage() {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

function fresh(): MockDb {
  return { partners: seedPartners(), sessionPartnerId: null, verified: [], seq: 1000 }
}

export function db(): MockDb {
  if (cache) return cache
  if (hasStorage()) {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        cache = JSON.parse(raw) as MockDb
        return cache
      }
    } catch {
      /* corrupted: fall through to a fresh db */
    }
  }
  cache = fresh()
  return cache
}

export function persist() {
  if (!cache || !hasStorage()) return
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* quota or private mode: keep working in memory */
  }
}

export function resetDb() {
  cache = fresh()
  if (hasStorage()) {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  }
  persist()
}

export const nextId = (prefix: string) => `${prefix}_${db().seq++}`
export const nowIso = () => new Date().toISOString()

export interface MockOptions {
  latencyMs: number
  uploadStepMs: number
}
export const mockOptions: MockOptions = {
  latencyMs: typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test' ? 0 : 350,
  uploadStepMs: typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test' ? 0 : 160,
}
export function configureMock(o: Partial<MockOptions>) {
  Object.assign(mockOptions, o)
}
export const wait = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve())
