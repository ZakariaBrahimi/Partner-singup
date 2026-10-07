import * as React from 'react'
import { api, type ApiResult, type PartnerSummary } from '@/api'
import { changePartnerType, contextFromDraft, emptyDraft } from '@/shared/flow'
import type { FlowContext } from '@/shared/config/schemaTypes'
import { hasPartnerType } from '@/shared/config/partnerTypes'
import type { PartnerDraft, PartnerType, StepData, StepId } from '@/shared/types'

const PENDING_KEY = 'mizaniya.signup.pending'

function loadPending(): PartnerDraft {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (raw) {
      const d = JSON.parse(raw) as PartnerDraft
      if (!d.partnerType || hasPartnerType(d.partnerType)) return d
    }
  } catch {
    /* ignore */
  }
  return emptyDraft()
}
function savePending(d: PartnerDraft | null) {
  try {
    if (d) localStorage.setItem(PENDING_KEY, JSON.stringify(d))
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    /* ignore */
  }
}

export interface SignupApi {
  ready: boolean
  summary: PartnerSummary | null
  draft: PartnerDraft
  ctx: FlowContext | null
  /** Re-read session + draft from the API. */
  refresh: () => Promise<PartnerSummary | null>
  /** Choose or change the partner type (local before the account exists, via the API after). */
  selectType: (type: PartnerType) => Promise<ApiResult<unknown>>
  /** Pre-account: keep typed values locally. */
  stashStep: (stepId: StepId, data: StepData) => void
  /** Save a step. For the account step without a session this creates the account. */
  saveStep: (stepId: StepId, data: StepData, complete: boolean) => Promise<ApiResult<unknown>>
  login: (email: string, password: string) => Promise<ApiResult<PartnerSummary>>
  logout: () => Promise<void>
}

const Ctx = React.createContext<SignupApi | null>(null)

export function useSignup(): SignupApi {
  const v = React.useContext(Ctx)
  if (!v) throw new Error('useSignup outside <SignupProvider>')
  return v
}

export function SignupProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false)
  const [summary, setSummary] = React.useState<PartnerSummary | null>(null)
  const [draft, setDraft] = React.useState<PartnerDraft>(() => loadPending())

  const refresh = React.useCallback(async () => {
    const s = await api.getSession()
    if (s.ok && s.data) {
      const d = await api.getDraft()
      if (d.ok) {
        setSummary(d.data.summary)
        setDraft(d.data.draft)
        setReady(true)
        return d.data.summary
      }
    }
    setSummary(null)
    setDraft(loadPending())
    setReady(true)
    return null
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const value = React.useMemo<SignupApi>(
    () => ({
      ready,
      summary,
      draft,
      ctx: contextFromDraft(draft),
      refresh,
      selectType: async (type) => {
        if (!summary) {
          const next = changePartnerType(draft.partnerType ? draft : { ...draft, partnerType: type }, type)
          setDraft(next)
          savePending(next)
          return { ok: true, data: null }
        }
        const r = await api.setPartnerType(type)
        if (r.ok) {
          setDraft(r.data.draft)
          setSummary(r.data.summary)
        }
        return r
      },
      stashStep: (stepId, data) => {
        if (summary) return
        const next = { ...draft, steps: { ...draft.steps, [stepId]: data } }
        setDraft(next)
        savePending(next)
      },
      saveStep: async (stepId, data, complete) => {
        if (!summary) {
          if (stepId !== 'account') return { ok: false, error: 'UNAUTHENTICATED' }
          if (!complete) {
            const next = { ...draft, steps: { ...draft.steps, account: data } }
            setDraft(next)
            savePending(next)
            return { ok: true, data: null }
          }
          const r = await api.createAccount({ partnerType: draft.partnerType!, data })
          if (r.ok) {
            savePending(null)
            await refresh()
          }
          return r
        }
        const r = await api.saveStep({ stepId, data, complete })
        if (r.ok) {
          setDraft(r.data.draft)
          setSummary(r.data.summary)
        }
        return r
      },
      login: async (email, password) => {
        const r = await api.login({ email, password })
        if (r.ok) await refresh()
        return r
      },
      logout: async () => {
        await api.logout()
        savePending(null)
        setSummary(null)
        setDraft(emptyDraft())
      },
    }),
    [ready, summary, draft, refresh],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
