import { useState, useEffect } from 'react'
import api from '../api'
import { Card, PageHeader, Modal, ConfirmDialog, Spinner, EmptyState, Badge } from '../components/UI'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2 } from 'lucide-react'

const emptyForm = { username: '', email: '', first_name: '', last_name: '', phone: '', role: 'cashier', password: '', is_active: true }

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const load = () => {
    setLoading(true)
    api.get('/users/').then(r => setUsers(r.data.results || r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setForm(emptyForm); setEditId(null); setModal(true) }
  const openEdit = u => {
    setForm({ username: u.username, email: u.email, first_name: u.first_name, last_name: u.last_name, phone: u.phone, role: u.role, password: '', is_active: u.is_active })
    setEditId(u.id); setModal(true)
  }

  const save = async () => {
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password
      if (editId) { await api.patch(`/users/${editId}/`, payload); toast.success('User updated') }
      else { await api.post('/users/', payload); toast.success('User created') }
      setModal(false); load()
    } catch (e) { toast.error(JSON.stringify(e.response?.data) || 'Error') }
  }

  const del = async () => {
    try { await api.delete(`/users/${deleteId}/`); toast.success('Deleted'); load() }
    catch { toast.error('Failed') }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-4">
      <PageHeader title="Users" subtitle="Manage system users and roles"
        action={<button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus size={16} />Add User</button>} />

      <Card>
        {loading ? <Spinner /> : users.length === 0 ? <EmptyState /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.first_name} {u.last_name}</td>
                    <td className="font-mono text-sm">{u.username}</td>
                    <td className="text-sm">{u.email}</td>
                    <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span></td>
                    <td><Badge status={u.is_active ? 'active' : 'inactive'} /></td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(u)} className="icon-btn"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteId(u.id)} className="icon-btn text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Edit User' : 'Add User'} size="md">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">First Name</label><input className="input" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="label">Last Name</label><input className="input" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="label">Username *</label><input className="input" value={form.username} onChange={e => f('username', e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="label">Role</label>
            <select className="input" value={form.role} onChange={e => f('role', e.target.value)}>
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select></div>
          <div className="col-span-2"><label className="label">{editId ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input type="password" className="input" value={form.password} onChange={e => f('password', e.target.value)} /></div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.is_active} onChange={e => f('is_active', e.target.checked)} />
            <label htmlFor="active" className="text-sm text-gray-700">Active</label>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={save} className="btn-primary flex-1">Save</button>
          <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={del}
        title="Delete User" message="Are you sure?" danger />
    </div>
  )
}
