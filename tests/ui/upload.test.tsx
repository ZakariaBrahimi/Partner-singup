import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { api, configureMock } from '@/api'
import { UploadTile } from '@/components/form/UploadTile'
import type { UploadedDocument } from '@/shared/types'

function Harness({ accept = ['jpg', 'png', 'pdf'] as Array<'jpg' | 'png' | 'pdf'> }) {
  const [v, setV] = useState<UploadedDocument | null>(null)
  return <UploadTile id="f-doc" docType="idFront" accept={accept} label="ID" value={v} onChange={setV} />
}
const tile = () => document.querySelector('[data-slot="upload-tile"]')!

beforeEach(async () => {
  await api.dev.reset()
  configureMock({ latencyMs: 0, uploadStepMs: 0 })
})

describe('UploadTile states', () => {
  it('empty -> uploaded (filename + Replace)', async () => {
    render(<Harness />)
    expect(tile()).toHaveAttribute('data-state', 'empty')
    await userEvent.upload(screen.getByTestId('f-doc-input'), new File(['x'], 'cni.jpg', { type: 'image/jpeg' }))
    await waitFor(() => expect(tile()).toHaveAttribute('data-state', 'uploaded'))
    expect(screen.getByText('cni.jpg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Replace/ })).toBeInTheDocument()
  })

  it('shows a progress bar while uploading', async () => {
    configureMock({ uploadStepMs: 30 })
    render(<Harness />)
    await userEvent.upload(screen.getByTestId('f-doc-input'), new File(['x'], 'cni.jpg', { type: 'image/jpeg' }))
    await waitFor(() => expect(tile()).toHaveAttribute('data-state', 'uploading'))
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    await waitFor(() => expect(tile()).toHaveAttribute('data-state', 'uploaded'))
  })

  it('server failure -> inline error with Retry', async () => {
    render(<Harness />)
    await userEvent.upload(screen.getByTestId('f-doc-input'), new File(['x'], 'will-fail.jpg', { type: 'image/jpeg' }))
    await waitFor(() => expect(tile()).toHaveAttribute('data-state', 'error'))
    expect(screen.getByRole('alert')).toHaveTextContent('Upload failed')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('rejects wrong type and > 5 MB before uploading', async () => {
    const { unmount } = render(<Harness />)
    // applyAccept:false so the browser-level accept filter does not hide the wrong file
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(screen.getByTestId('f-doc-input'), new File(['x'], 'virus.exe', { type: 'application/x-msdownload' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only JPG, PNG or PDF')
    unmount()
    render(<Harness />)
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 })
    await user.upload(screen.getByTestId('f-doc-input'), big)
    expect(await screen.findByRole('alert')).toHaveTextContent('larger than 5 MB')
  })
})
