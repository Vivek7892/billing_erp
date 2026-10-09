import { useState, useEffect, useMemo, useCallback } from 'react'
import api from '../api'
import { Card, PageHeader, Modal, ConfirmDialog, TableSkeleton, EmptyState, Badge } from '../components/UI'
import { ROLES } from '../constants'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Search, Filter, ShieldCheck, Users as UsersIcon } from 'lucide-react'

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
        await api.patch(`/users/${editId}/`, payload)
        toast.success('User updated successfully')
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

      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

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
    <div className="space-y-4">
      <PageHeader
        title="Users & Roles"
        subtitle="Manage system credentials and access roles (Accountant, Admin, Manager, Cashier, Owner)"
        action={
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add User
          </button>
        }
      />

      {/* Role Summary Quick Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3">
        <button
          type="button"
          onClick={() => setRoleFilter('all')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
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
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
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
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            className="input pl-9 text-xs w-full"
            placeholder="Search by name, username, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="text-xs text-[var(--muted)] self-end sm:self-center">
          Showing {filteredUsers.length} of {users.length} users
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
            icon={Search}
            title="No matching users"
            description="No users matched your search and role filters."
            action={{ label: 'Clear Filters', onClick: () => { setSearch(''); setRoleFilter('all') } }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
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
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}>
                          {u.role || 'Staff'}
                        </span>
                      </td>
                      <td>
                        <Badge status={u.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(u)} className="icon-btn" title="Edit User">
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(u.id)}
                            className="icon-btn text-rose-600 hover:text-rose-700"
                            title="Delete User"
                          >
                            <Trash2 size={14} />
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
