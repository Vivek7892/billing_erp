import { useState, useEffect, useCallback } from 'react'
import api from '../api'
import { Card, PageHeader, Modal } from '../components/UI'
import toast from 'react-hot-toast'
import {
  IconShieldCheck,
  IconLock,
  IconCopy,
  IconDownload,
  IconCheck,
  IconAlertTriangle,
  IconDeviceMobile,
  IconKey,
  IconRefresh,
  IconX,
} from '@tabler/icons-react'

export default function SecuritySettings() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState({ totp_enabled: false, recovery_codes_remaining: 0, confirmed_at: null })

  // Setup modal state
  const [setupModal, setSetupModal] = useState(false)
  const [setupData, setSetupData] = useState(null)
  const [confirmCode, setConfirmCode] = useState('')
  const [setupStep, setSetupStep] = useState(1) // 1: QR & Secret, 2: Recovery codes
  const [generatedCodes, setGeneratedCodes] = useState([])
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Disable modal state
  const [disableModal, setDisableModal] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableCode, setDisableCode] = useState('')

  // Regenerate codes modal state
  const [regenModal, setRegenModal] = useState(false)
  const [regenPassword, setRegenPassword] = useState('')
  const [regenCode, setRegenCode] = useState('')
  const [regenStep, setRegenStep] = useState(1) // 1: prompt, 2: display new codes

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/auth/2fa/status/')
      setStatus(res.data)
    } catch {
      toast.error('Failed to load two-factor authentication status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  // Initiate setup
  const startSetup = async () => {
    setSubmitting(true)
    try {
      const res = await api.post('/auth/2fa/setup/')
      setSetupData(res.data)
      setConfirmCode('')
      setSetupStep(1)
      setCopiedSecret(false)
      setCopiedCodes(false)
      setSetupModal(true)
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to initiate 2FA setup')
    } finally {
      setSubmitting(false)
    }
  }

  // Confirm setup code
  const handleConfirmSetup = async e => {
    if (e) e.preventDefault()
    if (!confirmCode || confirmCode.length !== 6) {
      toast.error('Please enter the 6-digit code from your authenticator app')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post('/auth/2fa/confirm/', { code: confirmCode.trim() })
      toast.success('Two-factor authentication successfully verified!')
      setGeneratedCodes(res.data.recovery_codes || [])
      setSetupStep(2) // Show recovery codes
      loadStatus()
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Invalid verification code')
    } finally {
      setSubmitting(false)
    }
  }

  // Disable 2FA
  const handleDisable2FA = async e => {
    if (e) e.preventDefault()
    if (!disablePassword || !disableCode) {
      toast.error('Password and verification code are required')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/auth/2fa/disable/', {
        password: disablePassword,
        code: disableCode.trim(),
      })
      toast.success('Two-factor authentication has been disabled')
      setDisableModal(false)
      setDisablePassword('')
      setDisableCode('')
      loadStatus()
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to disable 2FA')
    } finally {
      setSubmitting(false)
    }
  }

  // Regenerate recovery codes
  const handleRegenerateCodes = async e => {
    if (e) e.preventDefault()
    if (!regenPassword || !regenCode) {
      toast.error('Password and verification code are required')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post('/auth/2fa/recovery-codes/regenerate/', {
        password: regenPassword,
        code: regenCode.trim(),
      })
      toast.success('Backup recovery codes regenerated successfully!')
      setGeneratedCodes(res.data.recovery_codes || [])
      setRegenStep(2)
      loadStatus()
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to regenerate recovery codes')
    } finally {
      setSubmitting(false)
    }
  }

  const copyToClipboard = (text, setCopiedState) => {
    navigator.clipboard.writeText(text)
    setCopiedState(true)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopiedState(false), 2000)
  }

  const downloadRecoveryCodes = codes => {
    const text = `DreamWithTech ERP - Backup Recovery Codes\nGenerated: ${new Date().toLocaleString()}\n\nKeep these codes in a secure location. Each code can be used once to access your account if you lose your authenticator device.\n\n${codes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'dreamwithtech-recovery-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="security-settings-page w-full min-w-0 space-y-5">
      <PageHeader
        title="Security & Two-Factor Authentication (2FA)"
        subtitle="Protect your account with Google Authenticator, Microsoft Authenticator, or 2FAS time-based one-time passwords (TOTP)."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-4 p-2 sm:p-4">
              <div className="flex gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  status.totp_enabled
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200'
                    : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200'
                }`}>
                  <IconShieldCheck size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--ink)]">Google Authenticator (TOTP)</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      status.totp_enabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}>
                      {status.totp_enabled ? 'Active / Protected' : 'Not Configured'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--ink-secondary)] leading-relaxed">
                    Adds an additional layer of login security. After entering your mobile number and password, you will be prompted for a 6-digit code generated by your authenticator app.
                  </p>
                </div>
              </div>

              {!status.totp_enabled ? (
                <button
                  type="button"
                  onClick={startSetup}
                  disabled={submitting}
                  className="btn-primary shrink-0 text-xs px-3.5 py-2 font-semibold"
                >
                  Enable 2FA
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDisablePassword('')
                    setDisableCode('')
                    setDisableModal(true)
                  }}
                  className="btn-secondary text-rose-600 hover:text-rose-700 border-rose-200 hover:border-rose-300 shrink-0 text-xs px-3 py-2 font-semibold"
                >
                  Disable 2FA
                </button>
              )}
            </div>

            {status.totp_enabled && (
              <div className="mt-4 pt-4 border-t border-[var(--line)] px-2 sm:px-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-[var(--ink)]">Backup Recovery Codes: </span>
                    <span className="font-mono font-bold text-indigo-600">
                      {status.recovery_codes_remaining} codes remaining
                    </span>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5">
                      Use single-use recovery codes if you ever lose your authenticator device.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRegenPassword('')
                      setRegenCode('')
                      setRegenStep(1)
                      setRegenModal(true)
                    }}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0"
                  >
                    <IconRefresh size={14} /> Regenerate Codes
                  </button>
                </div>
              </div>
            )}
          </Card>

         
        </div>

        <div className="space-y-4">
          <Card title="Security Advice">
            <div className="p-2 sm:p-4 text-xs text-[var(--ink-secondary)] space-y-2.5">
              <div className="flex items-start gap-2">
                <IconKey size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <p><strong>Keep Backup Codes Safe:</strong> Store recovery codes in a secure password manager or print them out.</p>
              </div>
              <div className="flex items-start gap-2">
                <IconAlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p><strong>Anti-Replay Protection:</strong> Generated 6-digit codes can only be used once within each 30-second time window.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Enable 2FA Modal */}
      <Modal
        open={setupModal}
        onClose={() => setSetupModal(false)}
        title={setupStep === 1 ? 'Set Up Google Authenticator' : 'Save Your Backup Recovery Codes'}
        size="md"
      >
        {setupStep === 1 ? (
          <div className="space-y-4 text-xs">
            <p className="text-[var(--ink-secondary)]">
              Scan the QR code below in your authenticator app, or copy the manual key:
            </p>

            {setupData?.qr_code && (
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-[var(--line)] shadow-inner">
                <img src={setupData.qr_code} alt="2FA QR Code" className="w-48 h-48 object-contain" />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-secondary)]">Manual Setup Key</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={setupData?.secret || ''}
                  className="input font-mono text-xs bg-[var(--surface-subtle)] text-[var(--ink)] select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(setupData?.secret, setCopiedSecret)}
                  className="btn-secondary px-3 py-2 shrink-0 flex items-center gap-1 text-xs"
                >
                  {copiedSecret ? <IconCheck size={14} className="text-emerald-600" /> : <IconCopy size={14} />}
                  <span>{copiedSecret ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleConfirmSetup} className="space-y-3 pt-2 border-t border-[var(--line)]">
              <div>
                <label className="label">Enter 6-Digit Code from App *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmCode}
                  onChange={e => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="input font-mono text-center text-lg tracking-widest font-bold"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting || confirmCode.length !== 6}
                  className="btn-primary flex-1 py-2 text-xs font-semibold"
                >
                  {submitting ? 'Verifying…' : 'Confirm & Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => setSetupModal(false)}
                  className="btn-secondary flex-1 py-2 text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 rounded-lg text-xs">
              <p className="font-bold flex items-center gap-1.5">
                <IconAlertTriangle size={15} /> Save these 10 backup codes now!
              </p>
              <p className="mt-1 text-[11px]">
                Each code can be used once to sign in if you lose access to your phone or authenticator app. They will not be displayed again.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 bg-[var(--surface-subtle)] rounded-lg border border-[var(--line)] font-mono text-xs font-bold text-center">
              {generatedCodes.map((code, idx) => (
                <div key={idx} className="p-1.5 bg-[var(--surface)] border border-[var(--line)] rounded">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard(generatedCodes.join('\n'), setCopiedCodes)}
                className="btn-secondary flex-1 flex items-center justify-center gap-1 text-xs py-2"
              >
                {copiedCodes ? <IconCheck size={14} className="text-emerald-600" /> : <IconCopy size={14} />}
                <span>{copiedCodes ? 'Codes Copied' : 'Copy All Codes'}</span>
              </button>

              <button
                type="button"
                onClick={() => downloadRecoveryCodes(generatedCodes)}
                className="btn-secondary flex-1 flex items-center justify-center gap-1 text-xs py-2"
              >
                <IconDownload size={14} />
                <span>Download .TXT</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSetupModal(false)}
              className="btn-primary w-full py-2.5 text-xs font-semibold mt-2"
            >
              I have saved my backup codes
            </button>
          </div>
        )}
      </Modal>

      {/* Disable 2FA Modal */}
      <Modal
        open={disableModal}
        onClose={() => setDisableModal(false)}
        title="Disable Two-Factor Authentication"
        size="sm"
      >
        <form onSubmit={handleDisable2FA} className="space-y-4 text-xs">
          <p className="text-[var(--ink-secondary)]">
            To disable 2FA, please verify your account password and a current 6-digit authenticator code:
          </p>

          <div>
            <label className="label">Current Account Password *</label>
            <input
              type="password"
              value={disablePassword}
              onChange={e => setDisablePassword(e.target.value)}
              placeholder="••••••••"
              className="input font-mono"
              autoFocus
            />
          </div>

          <div>
            <label className="label">6-Digit Code (or Recovery Code) *</label>
            <input
              type="text"
              value={disableCode}
              onChange={e => setDisableCode(e.target.value)}
              placeholder="123456 or A1B2-C3D4"
              className="input font-mono text-center tracking-wider font-bold"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || !disablePassword || !disableCode}
              className="btn-primary bg-rose-600 hover:bg-rose-700 flex-1 py-2 text-xs font-semibold"
            >
              {submitting ? 'Disabling…' : 'Disable 2FA'}
            </button>
            <button
              type="button"
              onClick={() => setDisableModal(false)}
              className="btn-secondary flex-1 py-2 text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Regenerate Recovery Codes Modal */}
      <Modal
        open={regenModal}
        onClose={() => setRegenModal(false)}
        title="Regenerate Backup Recovery Codes"
        size="md"
      >
        {regenStep === 1 ? (
          <form onSubmit={handleRegenerateCodes} className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 rounded-lg text-xs">
              <p className="font-bold flex items-center gap-1.5">
                <IconAlertTriangle size={15} /> Warning: Previous recovery codes will be invalidated!
              </p>
              <p className="mt-1 text-[11px]">
                Generating new recovery codes immediately replaces all previously generated codes.
              </p>
            </div>

            <div>
              <label className="label">Current Account Password *</label>
              <input
                type="password"
                value={regenPassword}
                onChange={e => setRegenPassword(e.target.value)}
                placeholder="••••••••"
                className="input font-mono"
                autoFocus
              />
            </div>

            <div>
              <label className="label">6-Digit Code from Authenticator App *</label>
              <input
                type="text"
                maxLength={6}
                value={regenCode}
                onChange={e => setRegenCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="input font-mono text-center tracking-widest font-bold"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting || !regenPassword || regenCode.length !== 6}
                className="btn-primary flex-1 py-2 text-xs font-semibold"
              >
                {submitting ? 'Generating…' : 'Regenerate Codes'}
              </button>
              <button
                type="button"
                onClick={() => setRegenModal(false)}
                className="btn-secondary flex-1 py-2 text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-[var(--ink-secondary)]">Here are your 10 new single-use backup recovery codes:</p>
            <div className="grid grid-cols-2 gap-2 p-3 bg-[var(--surface-subtle)] rounded-lg border border-[var(--line)] font-mono text-xs font-bold text-center">
              {generatedCodes.map((code, idx) => (
                <div key={idx} className="p-1.5 bg-[var(--surface)] border border-[var(--line)] rounded">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard(generatedCodes.join('\n'), setCopiedCodes)}
                className="btn-secondary flex-1 flex items-center justify-center gap-1 text-xs py-2"
              >
                {copiedCodes ? <IconCheck size={14} className="text-emerald-600" /> : <IconCopy size={14} />}
                <span>{copiedCodes ? 'Codes Copied' : 'Copy All'}</span>
              </button>

              <button
                type="button"
                onClick={() => downloadRecoveryCodes(generatedCodes)}
                className="btn-secondary flex-1 flex items-center justify-center gap-1 text-xs py-2"
              >
                <IconDownload size={14} />
                <span>Download .TXT</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setRegenModal(false)}
              className="btn-primary w-full py-2.5 text-xs font-semibold mt-2"
            >
              Done
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

