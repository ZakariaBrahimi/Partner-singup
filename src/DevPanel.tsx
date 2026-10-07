import { FlaskConical } from 'lucide-react'
import * as React from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '@/api'
import { AE_ANNUAL_CAP_DZD, VOLUME_BANDS } from '@/shared/config/tbd'
import { Button } from '@/components/ui/button'

const KEY = 'mizaniya.dev'

/** QA-only panel (open the app with ?dev=1). It is not part of the product: it drives the mock backend. */
export function DevPanel() {
  const loc = useLocation()
  const [on, setOn] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)

  React.useEffect(() => {
    try {
      if (new URLSearchParams(loc.search).get('dev') === '1') localStorage.setItem(KEY, '1')
      if (new URLSearchParams(loc.search).get('dev') === '0') localStorage.removeItem(KEY)
      setOn(localStorage.getItem(KEY) === '1')
    } catch {
      setOn(false)
    }
  }, [loc.search])
  if (!on) return null

  const pct = (p: number) => Math.round(AE_ANNUAL_CAP_DZD * p)
  const set = async (label: string, input: { annualDzd?: number; monthlyDzd?: number }) => {
    const r = await api.dev.setVolumes(input)
    setMsg(r.ok ? label : 'Log in as an approved partner first')
    window.dispatchEvent(new Event('mizaniya:dev-changed'))
  }
  const band = VOLUME_BANDS[0]
  return (
    <div className="fixed bottom-3 end-3 z-50 max-w-xs text-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="ms-auto flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 font-semibold text-white shadow-lg"
      >
        <FlaskConical aria-hidden className="size-4" />
        QA tools
      </button>
      {open && (
        <div className="mt-2 grid gap-2 rounded-card border border-line bg-white p-4 shadow-xl" role="region" aria-label="QA tools">
          <p className="text-xs text-ink-2">Mock backend only. Needs a logged-in approved partner.</p>
          <p className="font-semibold">AE annual turnover</p>
          <div className="flex flex-wrap gap-2">
            {[0, 0.79, 0.8, 1].map((p) => (
              <Button key={p} size="sm" variant="outline" onClick={() => void set(`Annual ${p * 100}%`, { annualDzd: pct(p) })}>
                {p * 100}%
              </Button>
            ))}
          </div>
          <p className="font-semibold">Monthly volume vs band</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void set('Monthly within band', { monthlyDzd: 100_000 })}>
              Within band
            </Button>
            <Button size="sm" variant="outline" onClick={() => void set('Monthly above band', { monthlyDzd: (band.maxDzd ?? 1_000_000) + 1 })}>
              Above band
            </Button>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              void api.dev.reset().then(() => {
                localStorage.removeItem('mizaniya.signup.pending')
                window.location.assign('/signup?dev=1')
              })
            }}
          >
            Reset all mock data
          </Button>
          {msg && <p role="status" className="text-xs text-success">{msg}</p>}
        </div>
      )}
    </div>
  )
}
