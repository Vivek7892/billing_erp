import { useState, useEffect, useMemo, useCallback } from 'react'
import api from '../api'
import { Card, PageHeader, Modal, ConfirmDialog, TableSkeleton, EmptyState, Badge } from '../components/UI'
import { ROLES } from '../constants'
import toast from 'react-hot-toast'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconX,
  IconFilter,
  IconShieldCheck,
  IconUsers as UsersIcon,
} from '@tabler/icons-react'

const ROLE_OPTIONS = [
  { value: ROLES.OWNER, label: 'Owner', description: 'Full business & system control' },
  { value: ROLES.ADMIN, label: 'Admin', description: 'System administration & configuration' },
  { value: ROLES.MANAGER, label: 'Manager', description: 'Store & inventory operations management' },
  { value: ROLES.ACCOUNTANT, label: 'Accountant', description: 'Financial statements, taxes & report audits' },
  { value: ROLES.CASHIER, label: 'Cashier', description: 'POS counter billing & receipt generation' },
]

const ROLE_BADGES = {
  [ROLES.OWNER]: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  [ROLES.ADMIN]: 'bg-slate-100 text-[#1E3A5F] border-[var(--line)] dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  [ROLES.MANAGER]: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  [ROLES.ACCOUNTANT]: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
  [ROLES.CASHIER]: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
}

const emptyForm = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  phone: '',
  role: ROLES.CASHIER,
  password: '',
  is_active: true,
}

export default function Users() {
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
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const closeModal = useCallback(() => setModal(false), [])
  const closeDeleteModal = useCallback(() => setDeleteId(null), [])

  const openAdd = () => {
    setForm(emptyForm)
    setEditId(null)
    setModal(true)
  }

  const openEdit = u => {
    setForm({
      username: u.username || '',
      email: u.email || '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      phone: u.phone || '',
      role: u.role || ROLES.CASHIER,
      password: '',
      is_active: Boolean(u.is_active),
    })
    setEditId(u.id)
    setModal(true)
  }

  const save = async () => {
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password
      if (editId) {
        const res = await api.patch(`/users/${editId}/`, payload)
        if (res?.status === 202 || res?.data?.requires_approval) {
          toast.success(res?.data?.message || 'Role change submitted for Admin approval')
        } else {
          toast.success('User updated successfully')
        }
      } else {
        await api.post('/users/', payload)
        toast.success('User created successfully')
      }
      setModal(false)
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || JSON.stringify(e.response?.data) || 'Error saving user')
    }
  }

  const del = async () => {
    try {
      await api.delete(`/users/${deleteId}/`)
      toast.success('User deleted')
      setDeleteId(null)
      load()
    } catch {
      toast.error('Failed to delete user')
    }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Filtered list
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(u => {
      const matchesSearch =
        !q ||
        `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(q) ||
        String(u.username || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.phone || '').includes(q)

      const matchesRole =
        roleFilter === 'all' ||
        String(u.role || '').toLowerCase() === roleFilter.toLowerCase()

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? Boolean(u.is_active) : !u.is_active)

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, search, roleFilter, statusFilter])

  const exportUsers = () => {
    const columns = ['Name', 'Username', 'Email', 'Phone', 'Role', 'Status']
    const rows = filteredUsers.map(u => [
      `${u.first_name || ''} ${u.last_name || ''}`.trim(),
      u.username,
      u.email,
      u.phone,
      u.role,
      u.is_active ? 'Active' : 'Inactive',
    ])
    const csv = [columns, ...rows]
      .map(row => row.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'users.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  // Count by role
  const roleCounts = useMemo(() => {
    const counts = { all: users.length }
    users.forEach(u => {
      const r = (u.role || 'other').toLowerCase()
      counts[r] = (counts[r] || 0) + 1
    })
    return counts
  }, [users])

  return (
    <div className="users-page w-full min-w-0 space-y-4">
      <PageHeader
        title="Users & Roles"
        subtitle="Manage system credentials and access roles (Accountant, Admin, Manager, Cashier, Owner)"
        action={
          <button onClick={openAdd} className="btn-primary flex min-h-[42px] w-full items-center justify-center gap-2 sm:w-auto">
            <IconPlus size={16} /> Add User
          </button>
        }
      />

      {/* Role Summary Quick Filter Tabs */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-[var(--line)] pb-3">
        <button
          type="button"
          onClick={() => setRoleFilter('all')}
          className={`min-h-[38px] shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
            roleFilter === 'all'
              ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
              : 'bg-[var(--surface)] text-[var(--ink-secondary)] border-[var(--line)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <span>All Roles</span>
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

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="group relative flex items-center min-h-[42px] w-full sm:w-80 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600 focus-within:border-[#1E3A5F] focus-within:ring-2 focus-within:ring-[#1E3A5F]/15 dark:focus-within:border-sky-500 dark:focus-within:ring-sky-500/20 shadow-xs">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-elevated)] text-[var(--muted)] transition-colors group-focus-within:bg-blue-50 group-focus-within:text-[#1E3A5F] dark:group-focus-within:bg-blue-950/50 dark:group-focus-within:text-sky-300">
            <IconSearch size={14} strokeWidth={2.2} />
          </div>
          <input
            type="text"
            className="w-full bg-transparent px-2.5 text-xs sm:text-sm font-medium text-[var(--ink)] placeholder:text-[var(--placeholder)] outline-none"
            placeholder="Search by name, username, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)] active:scale-95"
              title="Clear search"
              aria-label="Clear search"
            >
              <IconX size={13} strokeWidth={2.5} />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex shrink-0 items-center rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] shadow-2xs">
              Ctrl+K
            </kbd>
          )}
        </div>
        <div className="flex w-full items-center justify-between gap-2 text-xs text-[var(--muted)] sm:w-auto">
          <label className="flex items-center gap-2">
            <span>Status</span>
            <select className="input h-9 min-h-9 w-auto py-1 text-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <span>Showing {filteredUsers.length} of {users.length}</span>
          <button type="button" onClick={exportUsers} disabled={!filteredUsers.length} className="btn-secondary h-9 px-3 text-xs disabled:opacity-50">
            Export CSV
          </button>
        </div>
      </div>

      <Card>
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : users.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No users found"
            description="Create your first team member with an assigned role."
            action={{ label: 'Add User', onClick: openAdd }}
          />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={IconSearch}
            title="No matching users"
            description="No users matched your search and role filters."
            action={{ label: 'Clear Filters', onClick: () => { setSearch(''); setRoleFilter('all'); setStatusFilter('all') } }}
          />
        ) : (
          <div className="overflow-x-auto min-h-[180px] pb-4">
            <table className="table w-full min-w-[820px]">
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => {
                  const roleKey = String(u.role || '').toLowerCase()
                  const badgeClass = ROLE_BADGES[roleKey] || 'bg-slate-100 text-slate-700 border-slate-200'
                  return (
                    <tr key={u.id}>
                      <td className="font-medium text-[var(--ink)]">
                        {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '—'}
                      </td>
                      <td className="font-mono text-xs">{u.username}</td>
                      <td className="text-xs text-[var(--ink-secondary)]">{u.email || '—'}</td>
                      <td className="font-mono text-xs text-[var(--ink-secondary)]">{u.phone || '—'}</td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}>
                          {u.role || 'Staff'}
                        </span>
                      </td>
                      <td className="text-center">
                        <Badge status={u.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(u)} className="icon-btn" title="Edit User">
                            <IconEdit size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(u.id)}
                            className="icon-btn text-rose-600 hover:text-rose-700"
                            title="Delete User"
                          >
                            <IconTrash size={14} />
                          </button>
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

      {/* Add / Edit User Modal */}
      <Modal
        open={modal}
        onClose={closeModal}
        title={editId ? 'Edit User Credentials & Role' : 'Add New User'}
        size="md"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">First Name</label>
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
          <div>
            <label className="label">Username *</label>
            <input
              className="input font-mono"
              value={form.username}
              onChange={e => f('username', e.target.value)}
              placeholder="e.g. rahul_accountant"
              required
            />
          </div>
          <div>
            <label className="label">Role *</label>
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
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={e => f('email', e.target.value)}
              placeholder="rahul@example.com"
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={e => f('phone', e.target.value)}
              placeholder="9876543210"
            />
          </div>
          <div className="col-span-2">
            <label className="label">
              {editId ? 'New Password (leave blank to keep current)' : 'Password *'}
            </label>
            <input
              type="password"
              className="input font-mono"
              value={form.password}
              onChange={e => f('password', e.target.value)}
              placeholder={editId ? '••••••••' : 'Enter strong password'}
            />
          </div>
          <div className="col-span-2 flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="active"
              checked={form.is_active}
              onChange={e => f('is_active', e.target.checked)}
              className="h-4 w-4 rounded border-[var(--line)]"
            />
            <label htmlFor="active" className="text-sm font-medium text-[var(--ink-secondary)]">
              Account Active (User can log in)
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={save} className="btn-primary flex-1">
            {editId ? 'Update User' : 'Create User'}
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
        title="Delete User"
        message="Are you sure you want to delete this user? Their account and access will be permanently revoked."
        danger
      />
    </div>
  )
}
