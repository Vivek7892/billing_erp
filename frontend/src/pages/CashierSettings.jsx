import { useState, useEffect } from 'react'
import {
  IconUser,
  IconLock,
  IconPhone,
  IconMail,
  IconShieldCheck,
  IconEye,
  IconEyeOff,
  IconCheck,
  IconDeviceMobile,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'
import http from '../api'
import { useAuth } from '../AuthContext'
import { Card, Badge } from '../components/UI'

export default function CashierSettings() {
  const { user, updateUser } = useAuth()

  // Profile Form State
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  })
  const [profileLoading, setProfileLoading] = useState(false)

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  // 2FA Status State
  const [twoFactorStatus, setTwoFactorStatus] = useState({
    enabled: false,
    confirmed_at: null,
  })

  // Load User Data & 2FA Status
  useEffect(() => {
    if (user) {
      let rawPhone = user.phone || ''
      if (rawPhone.startsWith('+91')) {
        rawPhone = rawPhone.slice(3)
      }
      setProfile({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: rawPhone,
      })
    }

    http.get('/auth/2fa/status/')
      .then(({ data }) => {
        setTwoFactorStatus({
          enabled: Boolean(data.totp_enabled),
          confirmed_at: data.confirmed_at,
        })
      })
      .catch(() => {})
  }, [user])

  // Save Profile Details
  const handleSaveProfile = async e => {
    e.preventDefault()
    const cleanDigits = (profile.phone || '').replace(/\D/g, '')
    if (!cleanDigits || cleanDigits.length !== 10) {
      toast.error('Please enter a valid 10-digit registered mobile number')
      return
    }

    setProfileLoading(true)
    try {
      const fullPhone = `+91${cleanDigits}`
      const payload = {
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        email: profile.email.trim(),
        phone: fullPhone,
      }

      const { data } = await http.put('/me/', payload)
      if (updateUser) {
        updateUser(data)
      }
      toast.success('Your profile details have been updated')
    } catch (err) {
      const msg = err.response?.data?.phone?.[0] || err.response?.data?.detail || 'Failed to update profile'
      toast.error(msg)
    } finally {
      setProfileLoading(false)
    }
  }

  // Change Password
  const handleChangePassword = async e => {
    e.preventDefault()
    if (!passwordForm.current_password) {
      toast.error('Enter your current password')
      return
    }
    if (!passwordForm.new_password || passwordForm.new_password.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match')
      return
    }

    setPasswordLoading(true)
    try {
      await http.post('/me/change-password/', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      toast.success('Password changed successfully!')
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      })
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to change password'
      toast.error(msg)
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">My Account &amp; Settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Manage your personal credentials, phone number, and security preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <Card title="Personal Information">
          <form onSubmit={handleSaveProfile} className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div>
                <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Account Role</span>
                <div className="mt-0.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                    Cashier / Staff
                  </span>
                </div>
              </div>
              {user?.department && (
                <div className="text-right">
                  <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Counter / Dept</span>
                  <div className="text-xs font-medium text-[var(--ink)] mt-0.5">{user.department}</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First Name</label>
                <input
                  type="text"
                  className="input"
                  value={profile.first_name}
                  onChange={e => setProfile(prev => ({ ...prev, first_name: e.target.value }))}
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input
                  type="text"
                  className="input"
                  value={profile.last_name}
                  onChange={e => setProfile(prev => ({ ...prev, last_name: e.target.value }))}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div>
              <label className="label">Registered Mobile Number (Login ID) *</label>
              <div className="flex gap-2">
                <div className="flex items-center justify-center px-3 text-xs font-mono font-bold rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--ink)] select-none shrink-0">
                  🇮🇳 +91
                </div>
                <input
                  type="tel"
                  className="input flex-1 font-mono"
                  value={profile.phone}
                  onChange={e => setProfile(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  placeholder="98765 43210"
                  required
                />
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted)]">You use this mobile number to log in to the POS.</p>
            </div>

            <div>
              <label className="label">Email Address (Optional)</label>
              <input
                type="email"
                className="input"
                value={profile.email}
                onChange={e => setProfile(prev => ({ ...prev, email: e.target.value }))}
                placeholder="cashier@example.com"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={profileLoading}
                className="btn-primary w-full"
              >
                {profileLoading ? 'Saving Profile…' : 'Save Profile Details'}
              </button>
            </div>
          </form>
        </Card>

        {/* Change Password Card */}
        <Card title="Change Password">
          <form onSubmit={handleChangePassword} className="p-4 sm:p-5 space-y-4">
            <div>
              <label className="label">Current Password *</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  className="input pr-10"
                  value={passwordForm.current_password}
                  onChange={e => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">New Password (min 6 characters) *</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="input pr-10"
                  value={passwordForm.new_password}
                  onChange={e => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirm New Password *</label>
              <input
                type="password"
                className="input"
                value={passwordForm.confirm_password}
                onChange={e => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordLoading}
                className="btn-primary w-full"
              >
                {passwordLoading ? 'Updating Password…' : 'Update Password'}
              </button>
            </div>
          </form>
        </Card>
      </div>

      {/* Security & 2FA Card */}
      <Card title="Two-Factor Authentication (Google Authenticator)">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600">
              <IconDeviceMobile size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 font-semibold text-sm text-[var(--ink)]">
                <span>Google Authenticator TOTP</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  twoFactorStatus.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {twoFactorStatus.enabled ? 'Enabled' : 'Not Enabled'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
                Add an extra layer of security to your cashier account when logging in to the POS.
              </p>
            </div>
          </div>

          <a
            href="/security"
            className="btn-secondary text-xs px-3.5 py-2 shrink-0 flex items-center justify-center gap-1.5"
          >
            <IconShieldCheck size={15} />
            <span>{twoFactorStatus.enabled ? 'Manage 2FA Security' : 'Enable Authenticator'}</span>
          </a>
        </div>
      </Card>
    </div>
  )
}
