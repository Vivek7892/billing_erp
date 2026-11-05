import { useState, useEffect, useMemo, useCallback } from 'react'
import api from '../api'
import { Card, PageHeader, Modal, ConfirmDialog, TableSkeleton, EmptyState, Badge, SearchInput } from '../components/UI'
import { ROLES, PERMISSIONS } from '../constants'
import { useAuth } from '../AuthContext'
import toast from 'react-hot-toast'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconX,
  IconShieldCheck,
  IconUsers as UsersIcon,
  IconPhone,
  IconLock,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react'

const ROLE_OPTIONS = [
  { value: ROLES.CASHIER, label: 'Cashier', description: 'POS billing, sales counters & customer receipts' },
  { value: ROLES.ADMIN, label: 'Admin', description: 'Store operations, inventory, staff & reports' },
]

const ROLE_BADGES = {
  [ROLES.OWNER]: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  [ROLES.ADMIN]: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  [ROLES.CASHIER]: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
}

const emptyForm = {
  phone_number: '',
  email: '',
  first_name: '',
  last_name: '',
  employee_id: '',
  department: '',
  role: ROLES.CASHIER,
  password: '',
  is_active: true,
  custom_permissions: [],
}

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(() => {
    setLoading(true)
    api
      .get('/users/')
      .then(r => setUsers(r.data.results || r.data || []))
      .catch(() => toast.error('Failed to load staff list'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const closeModal = useCallback(() => {
    setModal(false)
  }, [])

  const closeDeleteModal = useCallback(() => setDeleteId(null), [])

  const openAdd = () => {
    setForm(emptyForm)
    setEditId(null)
    setModal(true)
  }

  const openEdit = u => {
    let rawPhone = u.phone || ''
    if (rawPhone.startsWith('+91')) {
      rawPhone = rawPhone.slice(3)
    }

    setForm({
      phone_number: rawPhone,
      email: u.email || '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      employee_id: u.employee_id || '',
      department: u.department || '',
      role: u.role || ROLES.CASHIER,
      password: '',
      is_active: Boolean(u.is_active),
      custom_permissions: Array.isArray(u.custom_permissions) ? u.custom_permissions : [],
    })
    setEditId(u.id)
    setModal(true)
  }

  const save = async () => {
    const rawDigits = (form.phone_number || '').replace(/\D/g, '')
    if (!rawDigits || rawDigits.length !== 10) {
      toast.error('Valid 10-digit registered mobile number is required')
      return
    }

    const fullPhone = `+91${rawDigits}`

    if (!editId && (!form.password || form.password.length < 6)) {
      toast.error('Password must be at least 6 characters for new staff')
      return
    }

    if (form.password && form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    try {
      const payload = {
        phone: fullPhone,
        first_name: (form.first_name || '').trim(),
        last_name: (form.last_name || '').trim(),
        email: (form.email || '').trim(),
        role: form.role || ROLES.CASHIER,
        is_active: Boolean(form.is_active),
        employee_id: (form.employee_id || '').trim(),
        department: (form.department || '').trim(),
      }

      if (form.password) {
        payload.password = form.password
      }

      if (editId) {
        await api.patch(`/users/${editId}/`, payload)
        toast.success('Staff account updated successfully')
      } else {
        await api.post('/users/', payload)
        toast.success('Staff account created successfully')
      }
      setModal(false)
      load()
    } catch (e) {
      const errData = e.response?.data
      let errMsg = 'Error saving staff account'
      if (typeof errData === 'string') {
        errMsg = errData
      } else if (errData?.detail) {
        errMsg = errData.detail
      } else if (errData?.error) {
        errMsg = errData.error
      } else if (errData && typeof errData === 'object') {
        const firstField = Object.keys(errData)[0]
        if (firstField) {
          const val = errData[firstField]
          const fieldMsg = Array.isArray(val) ? val.join(' ') : String(val)
          errMsg = `${firstField.replace(/_/g, ' ')}: ${fieldMsg}`
        }
      }
      toast.error(errMsg)
    }
  }

  const del = async () => {
    try {
      await api.delete(`/users/${deleteId}/`)
      toast.success('Staff account deleted')
      setDeleteId(null)
      load()
    } catch (e) {
      const msg = e.response?.data?.detail || e.response?.data?.error || 'Failed to delete staff account'
      toast.error(msg)
    }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Filtered list
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(u => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase()
      const matchesSearch =
        !q ||
        fullName.includes(q) ||
        String(u.phone || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.employee_id || '').toLowerCase().includes(q)

      const userRole = String(u.role || '').toLowerCase()
      const matchesRole =
        roleFilter === 'all' ||
        (roleFilter === ROLES.ADMIN
          ? [ROLES.ADMIN, ROLES.OWNER].includes(userRole)
          : userRole === ROLES.CASHIER)

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? Boolean(u.is_active) : !u.is_active)

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, search, roleFilter, statusFilter])

  // Count by role
  const roleCounts = useMemo(() => {
    const counts = { all: users.length, [ROLES.ADMIN]: 0, [ROLES.CASHIER]: 0 }
    users.forEach(u => {
      const r = (u.role || 'cashier').toLowerCase()
      if ([ROLES.ADMIN, ROLES.OWNER].includes(r)) {
        counts[ROLES.ADMIN] = (counts[ROLES.ADMIN] || 0) + 1
      } else {
        counts[ROLES.CASHIER] = (counts[ROLES.CASHIER] || 0) + 1
      }
    })
    return counts
  }, [users])

  return (
    <div className="users-page w-full min-w-0 space-y-4">
      <PageHeader
        title="Staff & Users"
        subtitle="Manage employee access, edit mobile numbers and passwords, and assign cashier or admin roles."
        action={
          <button onClick={openAdd} className="btn-primary flex min-h-[42px] w-full items-center justify-center gap-2 sm:w-auto">
            <IconPlus size={16} /> Add Staff Member
          </button>
        }
      />

      {/* Role Summary Tabs */}
      <div className="erp-filter-panel no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-[var(--line)] pb-3">
        <button
          type="button"
          onClick={() => setRoleFilter('all')}
          className={`min-h-[38px] shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
            roleFilter === 'all'
              ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
              : 'bg-[var(--surface)] text-[var(--ink-secondary)] border-[var(--line)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <span>All Staff</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${roleFilter === 'all' ? 'bg-white/20' : 'bg-[var(--surface-subtle)]'}`}>
            {roleCounts.all || 0}
          </span>
        </button>

        {ROLE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setRoleFilter(opt.value)}
            className={`min-h-[38px] shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
              roleFilter === opt.value
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-[var(--surface)] text-[var(--ink-secondary)] border-[var(--line)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <span>{opt.label}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${roleFilter === opt.value ? 'bg-white/20' : 'bg-[var(--surface-subtle)]'}`}>
              {roleCounts[opt.value.toLowerCase()] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search staff by name, mobile, employee ID..."
          shortcut="Ctrl+K"
          className="w-full sm:w-80"
        />
      </div>

      <Card>
        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : users.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No staff members found"
            description="Create your first cashier or store administrator account with mobile authentication."
            action={{ label: 'Add Staff Member', onClick: openAdd }}
          />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={IconSearch}
            title="No matching staff"
            description="No staff members matched your search and role filters."
            action={{ label: 'Clear Filters', onClick: () => { setSearch(''); setRoleFilter('all'); setStatusFilter('all') } }}
          />
        ) : (
          <div className="overflow-x-auto min-h-[180px] pb-4">
            <table className="table w-full min-w-[780px]">
              <colgroup>
                <col style={{ width: '25%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Mobile Number</th>
                  <th>Role</th>
                  <th>Employee Info</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => {
                  const roleKey = String(u.role || '').toLowerCase()
                  const isOwner = roleKey === ROLES.OWNER
                  const fullName = (u.first_name || u.last_name) ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : 'Staff Member'

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="font-semibold text-[var(--ink)]">{fullName}</div>
                        {u.email && <div className="text-[11px] text-[var(--ink-secondary)]">{u.email}</div>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-[var(--ink)]">
                          <IconPhone size={13} className="text-slate-400" />
                          <span>{u.phone || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          ROLE_BADGES[roleKey] || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {isOwner ? 'Owner' : roleKey === ROLES.ADMIN ? 'Admin' : 'Cashier'}
                        </span>
                      </td>
                      <td className="text-xs text-[var(--ink-secondary)]">
                        {u.employee_id ? (
                          <div className="font-mono font-medium text-[var(--ink)]">{u.employee_id}</div>
                        ) : null}
                        {u.department ? <div>{u.department}</div> : (!u.employee_id && '—')}
                      </td>
                      <td className="text-center">
                        <Badge status={u.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(u)}
                            className="icon-btn"
                            title="Edit Staff Account"
                          >
                            <IconEdit size={14} />
                          </button>
                          {!isOwner && (
                            <button
                              onClick={() => setDeleteId(u.id)}
                              className="icon-btn text-rose-600 hover:text-rose-700"
                              title="Delete Staff Account"
                            >
                              <IconTrash size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Staff Modal */}
      <Modal
        open={modal}
        onClose={closeModal}
        title={editId ? 'Edit Staff Credentials' : 'Add New Staff Member'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input
                className="input"
                value={form.first_name}
                onChange={e => f('first_name', e.target.value)}
                placeholder="e.g. Rahul"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input
                className="input"
                value={form.last_name}
                onChange={e => f('last_name', e.target.value)}
                placeholder="e.g. Sharma"
              />
            </div>
          </div>

          {/* Edit Mobile Number Option */}
          <div>
            <label className="label">Registered Mobile Number * (Login Identifier)</label>
            <div className="flex gap-2">
              <div className="flex items-center justify-center px-3.5 text-xs font-mono font-bold rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--ink)] select-none shrink-0">
                🇮🇳 +91
              </div>
              <input
                type="tel"
                className="input font-mono flex-1"
                value={form.phone_number}
                onChange={e => f('phone_number', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="98765 43210"
                required
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--muted)]">Staff will log in using this 10-digit mobile number.</p>
          </div>

          {/* Edit Password Option */}
          <div>
            <label className="label">
              {editId ? 'New Password (leave blank to keep current)' : 'Account Password *'}
            </label>
            <input
              type="password"
              className="input font-mono"
              value={form.password}
              onChange={e => f('password', e.target.value)}
              placeholder={editId ? '••••••••' : 'Enter password (min 6 chars)'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Assigned Role *</label>
              <select
                className="input font-semibold"
                value={form.role}
                onChange={e => f('role', e.target.value)}
              >
                {ROLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Email Address (Optional)</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={e => f('email', e.target.value)}
                placeholder="rahul@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Employee ID (Optional)</label>
              <input
                className="input font-mono"
                value={form.employee_id}
                onChange={e => f('employee_id', e.target.value)}
                placeholder="EMP-101"
              />
            </div>

            <div>
              <label className="label">Department / Counter (Optional)</label>
              <input
                className="input"
                value={form.department}
                onChange={e => f('department', e.target.value)}
                placeholder="Counter 1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[var(--line)]">
            <input
              type="checkbox"
              id="active"
              checked={form.is_active}
              onChange={e => f('is_active', e.target.checked)}
              className="h-4 w-4 rounded border-[var(--line)] text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="active" className="text-xs font-medium text-[var(--ink-secondary)] cursor-pointer">
              Account Active (User can sign in with mobile number and password)
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={save} className="btn-primary flex-1">
            {editId ? 'Update Staff Member' : 'Create Staff Member'}
          </button>
          <button onClick={closeModal} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={closeDeleteModal}
        onConfirm={del}
        title="Delete Staff Account"
        message="Are you sure you want to delete this staff member? Their account access will be revoked immediately."
        danger
      />
    </div>
  )
}
