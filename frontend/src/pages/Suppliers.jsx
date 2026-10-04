import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

import { Badge, Spinner, Modal } from '../components/UI'

import {
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  ChevronRight,
  Package,
  IndianRupee,
  Save,
  X,
  CreditCard,
} from 'lucide-react'

import toast from 'react-hot-toast'

/* ============================================================
   HELPERS
============================================================ */

const fmt = value =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const EMPTY = {
  name: '',
  phone: '',
  email: '',
  address: '',
  gstin: '',
}

/* ============================================================
   SUPPLIER FORM
============================================================ */

function SupplierForm({ initial, onSaved, onClose }) {
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name || '',
          phone: initial.phone || '',
          email: initial.email || '',
          address: initial.address || '',
          gstin: initial.gstin || '',
        }
      : EMPTY
  )

  const [saving, setSaving] = useState(false)

  const updateField = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Supplier name is required')
      return
    }

    setSaving(true)

    try {
      const res = initial?.id
        ? await api.put(`/suppliers/${initial.id}/`, form)
        : await api.post('/suppliers/', form)

      toast.success(
        initial?.id
          ? 'Supplier updated successfully'
          : 'Supplier added successfully'
      )

      onSaved(res.data)
      onClose()
    } catch (error) {
      toast.error(
        error.response?.data?.name?.[0] ||
          error.response?.data?.detail ||
          'Failed to save supplier'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* Supplier Name */}
      <div>
        <label className="label">
          Company / Supplier Name{' '}
          <span className="text-red-600">*</span>
        </label>

        <input
          type="text"
          className="input"
          value={form.name}
          onChange={e =>
            updateField('name', e.target.value)
          }
          autoFocus
          placeholder="e.g. Balaji Traders Pvt Ltd"
        />
      </div>

      {/* Phone / Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div>
          <label className="label">
            Phone / Mobile
          </label>

          <input
            type="text"
            className="input"
            value={form.phone}
            onChange={e =>
              updateField('phone', e.target.value)
            }
            placeholder="Mobile / Landline"
          />
        </div>

        <div>
          <label className="label">
            Email Address
          </label>

          <input
            type="email"
            className="input"
            value={form.email}
            onChange={e =>
              updateField('email', e.target.value)
            }
            placeholder="supplier@example.com"
          />
        </div>

      </div>

      {/* Address */}
      <div>
        <label className="label">
          Business Address
        </label>

        <textarea
          className="input resize-none"
          rows={3}
          value={form.address}
          onChange={e =>
            updateField('address', e.target.value)
          }
          placeholder="Shop / warehouse address"
        />
      </div>

      {/* GSTIN */}
      <div>
        <label className="label">
          GSTIN
        </label>

        <input
          type="text"
          maxLength={15}
          className="input font-mono uppercase"
          value={form.gstin}
          onChange={e =>
            updateField(
              'gstin',
              e.target.value.toUpperCase()
            )
          }
          placeholder="22AAAAA0000A1Z5"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] pt-4">

        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="btn-secondary h-9 px-4 text-xs"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary h-9 px-4 text-xs flex items-center justify-center gap-2"
        >
          <Save size={14} />

          {saving
            ? 'Saving...'
            : initial?.id
              ? 'Update Supplier'
              : 'Save Supplier'}
        </button>

      </div>

    </div>
  )
}

/* ============================================================
   LINKED PRODUCTS ROW
============================================================ */

function SupplierProductsRow({
  supplier,
  products,
  onClose,
}) {
  const supplierProducts = products.filter(
    product => product.supplier === supplier.id
  )

  return (
    <tr>
      <td
        colSpan={7}
        className="p-0 border-b border-[var(--line)] bg-slate-50"
      >

        <div className="px-4 py-4">

          {/* Expanded Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">

            <div className="flex items-center gap-2">

              <Package
                size={15}
                className="text-[#1E3A5F]"
              />

              <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
                Products supplied by{' '}
                {supplier.name}
              </span>

              <span className="inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded bg-slate-100 border border-[var(--line)] text-[10px] font-bold text-[#1E3A5F]">
                {supplierProducts.length}
              </span>

            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-500 hover:text-[#1E3A5F]"
            >
              Close
            </button>

          </div>

          {/* No Products */}
          {supplierProducts.length === 0 ? (

            <div className="border border-[var(--line)] bg-white px-4 py-8 text-center">

              <Package
                size={25}
                className="mx-auto text-slate-300 mb-2"
              />

              <p className="text-xs font-semibold text-slate-600">
                No products linked to this supplier
              </p>

              <p className="text-[11px] text-slate-400 mt-1">
                Products assigned to this supplier
                will appear here.
              </p>

            </div>

          ) : (

            <div className="overflow-x-auto border border-[var(--line)] bg-white">

              <table className="table text-xs">

                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th className="num-col">
                      Current Stock
                    </th>
                    <th className="num-col">
                      Purchase Price
                    </th>
                    <th className="num-col">
                      Selling Price
                    </th>
                    <th>
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {supplierProducts.map(product => {

                    const stock = Number(
                      product.current_stock || 0
                    )

                    return (
                      <tr key={product.id}>

                        <td>
                          <span className="font-semibold text-slate-800">
                            {product.name}
                          </span>
                        </td>

                        <td>
                          <span className="font-mono text-[11px] text-slate-500">
                            {product.sku || '—'}
                          </span>
                        </td>

                        <td
                          className={`num-col font-bold ${
                            stock <= 0
                              ? 'text-red-600'
                              : stock <= 10
                                ? 'text-amber-600'
                                : 'text-slate-800'
                          }`}
                        >
                          {product.current_stock ?? 0}
                        </td>

                        <td className="num-col font-mono">
                          {fmt(product.purchase_price)}
                        </td>

                        <td className="num-col font-mono font-bold">
                          {fmt(product.selling_price)}
                        </td>

                        <td>
                          <Badge
                            status={
                              product.stock_status ||
                              (
                                stock <= 0
                                  ? 'out_of_stock'
                                  : 'in_stock'
                              )
                            }
                          />
                        </td>

                      </tr>
                    )
                  })}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </td>
    </tr>
  )
}

/* ============================================================
   MAIN SUPPLIERS PAGE
============================================================ */

export default function Suppliers() {

  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])

  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const [deleteTarget, setDeleteTarget] =
    useState(null)

  const [deleting, setDeleting] =
    useState(false)

  const [expandedIds, setExpandedIds] =
    useState(new Set())

  /* Payment */
  const [payTarget, setPayTarget] =
    useState(null)

  const [payAmt, setPayAmt] =
    useState('')

  const [payMethod, setPayMethod] =
    useState('cash')

  const [paying, setPaying] =
    useState(false)

  /* ==========================================================
     LOAD
  ========================================================== */

  const load = async () => {

    setLoading(true)

    try {

      const [
        supplierResponse,
        productResponse,
      ] = await Promise.all([
        api.get('/suppliers/?page_size=500'),
        api.get('/products/?page_size=1000'),
      ])

      setSuppliers(
        supplierResponse.data?.results ||
          supplierResponse.data ||
          []
      )

      setProducts(
        productResponse.data?.results ||
          productResponse.data ||
          []
      )

    } catch (error) {

      toast.error(
        'Unable to load supplier data'
      )

    } finally {

      setLoading(false)

    }
  }

  useEffect(() => {
    load()
  }, [])

  /* ==========================================================
     ADD / EDIT
  ========================================================== */

  const openAdd = () => {
    setEditing(null)
    setModal(true)
  }

  const openEdit = supplier => {
    setEditing(supplier)
    setModal(true)
  }

  /* ==========================================================
     EXPAND
  ========================================================== */

  const toggleExpand = id => {

    setExpandedIds(previous => {

      const next = new Set(previous)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  const closeAllExpanded = () => {
    setExpandedIds(new Set())
  }

  /* ==========================================================
     SAVED
  ========================================================== */

  const onSaved = saved => {

    setSuppliers(previous => {

      const exists = previous.some(
        supplier => supplier.id === saved.id
      )

      if (exists) {

        return previous.map(
          supplier =>
            supplier.id === saved.id
              ? saved
              : supplier
        )
      }

      return [
        ...previous,
        saved,
      ]
    })
  }

  /* ==========================================================
     DELETE
  ========================================================== */

  const confirmDelete = async () => {

    if (!deleteTarget) return

    setDeleting(true)

    try {

      await api.delete(
        `/suppliers/${deleteTarget.id}/`
      )

      toast.success(
        'Supplier deleted successfully'
      )

      setSuppliers(previous =>
        previous.filter(
          supplier =>
            supplier.id !== deleteTarget.id
        )
      )

      setExpandedIds(previous => {

        const next = new Set(previous)

        next.delete(deleteTarget.id)

        return next
      })

      setDeleteTarget(null)

    } catch (error) {

      toast.error(
        'Cannot delete — supplier may have linked purchases or records'
      )

    } finally {

      setDeleting(false)

    }
  }

  /* ==========================================================
     PAYMENT
  ========================================================== */

  const openPayment = supplier => {

    const outstanding =
      Number(
        supplier.outstanding_amount || 0
      )

    setPayTarget(supplier)
    setPayAmt(String(outstanding))
    setPayMethod('cash')
  }

  const recordPayment = async () => {

    if (!payTarget) return

    const amount =
      parseFloat(payAmt)

    const outstanding =
      Number(
        payTarget.outstanding_amount || 0
      )

    if (!amount || amount <= 0) {

      toast.error(
        'Enter a valid payment amount'
      )

      return
    }

    if (amount > outstanding) {

      toast.error(
        'Payment cannot be greater than the outstanding balance'
      )

      return
    }

    setPaying(true)

    try {

      await api.post(
        '/supplier-payments/',
        {
          supplier: payTarget.id,
          amount,
          method: payMethod,
        }
      )

      await api.patch(
        `/suppliers/${payTarget.id}/`,
        {
          outstanding_amount:
            Math.max(
              0,
              outstanding - amount
            ),
        }
      )

      toast.success(
        'Payment recorded successfully'
      )

      setPayTarget(null)
      setPayAmt('')

      await load()

    } catch (error) {

      toast.error(
        error.response?.data?.detail ||
          'Failed to record payment'
      )

    } finally {

      setPaying(false)

    }
  }

  /* ==========================================================
     FILTER
  ========================================================== */

  const filtered = useMemo(() => {

    const search =
      q.trim().toLowerCase()

    if (!search) {
      return suppliers
    }

    return suppliers.filter(
      supplier =>
        (supplier.name || '')
          .toLowerCase()
          .includes(search) ||

        (supplier.phone || '')
          .toLowerCase()
          .includes(search) ||

        (supplier.email || '')
          .toLowerCase()
          .includes(search) ||

        (supplier.gstin || '')
          .toLowerCase()
          .includes(search)
    )

  }, [suppliers, q])

  /* ==========================================================
     METRICS
  ========================================================== */

  const totalOutstanding =
    suppliers.reduce(
      (sum, supplier) =>
        sum +
        Number(
          supplier.outstanding_amount || 0
        ),
      0
    )

  const suppliedProductCount =
    products.filter(
      product => product.supplier
    ).length

  const suppliersWithDue =
    suppliers.filter(
      supplier =>
        Number(
          supplier.outstanding_amount || 0
        ) > 0
    ).length

  /* ==========================================================
     RENDER
  ========================================================== */

  return (

    <div className="suppliers-page min-w-0 bg-white text-slate-800 pb-8">

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <header className="border-b border-slate-200 bg-white py-4">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">

          <div>

            <div className="flex items-center gap-2">

              <Building2
                size={19}
                className="text-[#1E3A5F]"
              />

              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                Suppliers
              </h1>

            </div>

            <p className="mt-1 text-xs text-slate-500">
              Manage supplier accounts, payable balances
              and linked inventory products.
            </p>

          </div>

          <button
            type="button"
            onClick={openAdd}
            className="btn-primary h-9 px-3.5 text-xs flex items-center justify-center gap-1.5 w-full sm:w-auto"
          >
            <Plus size={14} />
            Add Supplier
          </button>

        </div>

      </header>

      {/* ======================================================
          SUMMARY TABLE
      ====================================================== */}

      <section className="mt-4 border border-slate-200 bg-white overflow-hidden">

        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">

          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Supplier Summary
          </h2>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[650px] text-xs">

            <thead>

              <tr className="border-b border-slate-200">

                <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide text-[10px]">
                  Total Suppliers
                </th>

                <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide text-[10px]">
                  Outstanding Payable
                </th>

                <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide text-[10px]">
                  Suppliers With Due
                </th>

                <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide text-[10px]">
                  Linked Products
                </th>

              </tr>

            </thead>

            <tbody>

              <tr>

                <td className="px-4 py-3 border-r border-slate-200">

                  <div className="text-lg font-bold font-mono text-slate-900">
                    {suppliers.length}
                  </div>

                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Registered suppliers
                  </div>

                </td>

                <td className="px-4 py-3 border-r border-slate-200">

                  <div className="text-lg font-bold font-mono text-red-600">
                    {fmt(totalOutstanding)}
                  </div>

                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Total amount payable
                  </div>

                </td>

                <td className="px-4 py-3 border-r border-slate-200">

                  <div className="text-lg font-bold font-mono text-amber-600">
                    {suppliersWithDue}
                  </div>

                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Accounts requiring payment
                  </div>

                </td>

                <td className="px-4 py-3">

                  <div className="text-lg font-bold font-mono text-teal-600">
                    {suppliedProductCount}
                  </div>

                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Inventory products linked
                  </div>

                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </section>

      {/* ======================================================
          SEARCH TOOLBAR
      ====================================================== */}

      <section className="mt-4 border-b border-slate-200 pb-3">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

          <div className="flex items-center gap-2 w-full md:max-w-xl border border-slate-300 bg-white px-3 h-9">

            <Search
              size={14}
              className="text-slate-400 shrink-0"
            />

            <input
              type="text"
              value={q}
              onChange={e =>
                setQ(e.target.value)
              }
              placeholder="Search supplier name, phone, email or GSTIN"
              className="w-full bg-transparent outline-none text-xs text-slate-800 placeholder:text-slate-400"
            />

            {q && (

              <button
                type="button"
                onClick={() => setQ('')}
                className="text-slate-400 hover:text-slate-700"
                title="Clear search"
              >
                <X size={14} />
              </button>

            )}

          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 text-xs">

            <span className="text-slate-500">

              Showing

              <strong className="text-slate-900 mx-1">
                {filtered.length}
              </strong>

              of

              <strong className="text-slate-900 mx-1">
                {suppliers.length}
              </strong>

              suppliers

            </span>

            {expandedIds.size > 0 && (

              <button
                type="button"
                onClick={closeAllExpanded}
                className="text-[#1E3A5F] hover:text-[#162F4D] font-semibold"
              >
                Collapse all
              </button>

            )}

          </div>

        </div>

      </section>

      {/* ======================================================
          SUPPLIERS TABLE
      ====================================================== */}

      <section className="mt-4 border border-slate-200 bg-white overflow-hidden">

        {loading ? (

          <div className="py-20 flex items-center justify-center">
            <Spinner />
          </div>

        ) : filtered.length === 0 ? (

          <div className="py-16 text-center px-4">

            <Building2
              size={36}
              className="mx-auto text-slate-300 mb-3"
            />

            <p className="text-sm font-semibold text-slate-700">
              {q
                ? 'No suppliers matching your search'
                : 'No suppliers registered'}
            </p>

            <p className="text-xs text-slate-400 mt-1">
              {q
                ? 'Try another supplier name, phone, email or GSTIN.'
                : 'Add your first supplier to start managing vendor accounts.'}
            </p>

            {!q && (

              <button
                type="button"
                onClick={openAdd}
                className="btn-primary mt-4 h-9 px-4 text-xs inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                Add Supplier
              </button>

            )}

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="table min-w-[1050px]">

              <thead>

                <tr>

                  <th className="w-12 text-center">
                    #
                  </th>

                  <th>
                    Supplier
                  </th>

                  <th>
                    Contact Details
                  </th>

                  <th>
                    GSTIN
                  </th>

                  <th className="text-center">
                    Products
                  </th>

                  <th className="num-col">
                    Outstanding
                  </th>

                  <th className="text-right">
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody>

                {filtered.map(
                  (supplier, index) => {

                    const supplierProducts =
                      products.filter(
                        product =>
                          product.supplier ===
                          supplier.id
                      )

                    const expanded =
                      expandedIds.has(
                        supplier.id
                      )

                    const due =
                      Number(
                        supplier.outstanding_amount ||
                          0
                      )

                    return (
                      <React.Fragment
                        key={supplier.id}
                      >

                        {/* ============================
                            SUPPLIER ROW
                        ============================ */}

                        <tr
                          className={
                            expanded
                              ? 'bg-slate-50'
                              : 'bg-white'
                          }
                        >

                          {/* Number */}
                          <td className="text-center">

                            <div className="flex items-center justify-center gap-1">

                              <button
                                type="button"
                                onClick={() =>
                                  toggleExpand(
                                    supplier.id
                                  )
                                }
                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-[#1E3A5F] hover:bg-slate-100 rounded"
                                title={
                                  expanded
                                    ? 'Collapse products'
                                    : 'View products'
                                }
                              >

                                {expanded ? (
                                  <ChevronDown
                                    size={14}
                                  />
                                ) : (
                                  <ChevronRight
                                    size={14}
                                  />
                                )}

                              </button>

                              <span className="text-[10px] text-slate-400 font-mono">
                                {index + 1}
                              </span>

                            </div>

                          </td>

                          {/* Supplier */}
                          <td>

                            <div className="min-w-[210px]">

                              <div className="font-bold text-sm text-slate-900">
                                {supplier.name}
                              </div>

                              {supplier.address && (

                                <div className="flex items-start gap-1 mt-1 max-w-[280px] text-[11px] text-slate-500">

                                  <MapPin
                                    size={10}
                                    className="shrink-0 mt-0.5 text-slate-400"
                                  />

                                  <span className="line-clamp-2">
                                    {supplier.address}
                                  </span>

                                </div>

                              )}

                            </div>

                          </td>

                          {/* Contact */}
                          <td>

                            <div className="space-y-1 min-w-[180px]">

                              {supplier.phone ? (

                                <div className="flex items-center gap-1.5 text-xs text-slate-700">

                                  <Phone
                                    size={11}
                                    className="text-[#1E3A5F]"
                                  />

                                  <span>
                                    {supplier.phone}
                                  </span>

                                </div>

                              ) : (

                                <span className="text-[11px] text-slate-400">
                                  No phone
                                </span>

                              )}

                              {supplier.email && (

                                <div className="flex items-center gap-1.5 max-w-[200px] text-[11px] text-slate-500">

                                  <Mail
                                    size={11}
                                    className="shrink-0 text-slate-400"
                                  />

                                  <span className="truncate">
                                    {supplier.email}
                                  </span>

                                </div>

                              )}

                            </div>

                          </td>

                          {/* GSTIN */}
                          <td>

                            {supplier.gstin ? (

                              <span className="font-mono text-[11px] font-semibold text-slate-700">
                                {supplier.gstin}
                              </span>

                            ) : (

                              <span className="text-[11px] text-slate-400">
                                Not provided
                              </span>

                            )}

                          </td>

                          {/* Products */}
                          <td className="text-center">

                            <button
                              type="button"
                              onClick={() =>
                                toggleExpand(
                                  supplier.id
                                )
                              }
                              className="inline-flex items-center gap-1.5 h-7 px-2.5 border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-[#1E3A5F] hover:text-[#1E3A5F] rounded"
                            >

                              <Package
                                size={12}
                                className="text-[#1E3A5F]"
                              />

                              {supplierProducts.length}

                            </button>

                          </td>

                          {/* Outstanding */}
                          <td className="num-col">

                            <div
                              className={`font-mono text-sm font-bold ${
                                due > 0
                                  ? 'text-red-600'
                                  : 'text-teal-600'
                              }`}
                            >
                              {fmt(due)}
                            </div>

                            <div
                              className={`text-[10px] mt-0.5 ${
                                due > 0
                                  ? 'text-red-500'
                                  : 'text-teal-600'
                              }`}
                            >
                              {due > 0
                                ? 'Payment due'
                                : 'Paid / clear'}
                            </div>

                          </td>

                          {/* Actions */}
                          <td>

                            <div className="flex items-center justify-end gap-1.5">

                              {due > 0 && (

                                <button
                                  type="button"
                                  onClick={() =>
                                    openPayment(
                                      supplier
                                    )
                                  }
                                  className="h-7 px-2.5 bg-[#1E3A5F] text-white hover:bg-[#162F4D] text-[11px] font-semibold flex items-center gap-1 rounded"
                                  title="Record payment"
                                >
                                  <CreditCard
                                    size={12}
                                  />
                                  Pay
                                </button>

                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  openEdit(
                                    supplier
                                  )
                                }
                                className="h-7 px-2 border border-slate-300 bg-white text-slate-700 hover:border-[#1E3A5F] hover:text-[#1E3A5F] text-[11px] font-semibold flex items-center gap-1 rounded"
                                title="Edit supplier"
                              >

                                <Pencil size={12} />

                                <span className="hidden sm:inline">
                                  Edit
                                </span>

                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget(
                                    supplier
                                  )
                                }
                                className="h-7 w-7 border border-slate-300 bg-white text-red-500 hover:border-red-300 hover:bg-red-50 flex items-center justify-center"
                                title="Delete supplier"
                              >
                                <Trash2 size={12} />
                              </button>

                            </div>

                          </td>

                        </tr>

                        {/* ============================
                            PRODUCTS
                        ============================ */}

                        {expanded && (

                          <SupplierProductsRow
                            supplier={supplier}
                            products={products}
                            onClose={() =>
                              toggleExpand(
                                supplier.id
                              )
                            }
                          />

                        )}

                      </React.Fragment>
                    )
                  }
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

      {/* ======================================================
          ADD / EDIT MODAL
      ====================================================== */}

      <Modal
        open={modal}
        onClose={() =>
          setModal(false)
        }
        title={
          editing
            ? 'Edit Supplier'
            : 'Add Supplier'
        }
        size="sm"
      >

        <SupplierForm
          initial={editing}
          onSaved={onSaved}
          onClose={() =>
            setModal(false)
          }
        />

      </Modal>

      {/* ======================================================
          PAYMENT MODAL
      ====================================================== */}

      <Modal
        open={!!payTarget}
        onClose={() =>
          setPayTarget(null)
        }
        title={`Record Payment — ${
          payTarget?.name || ''
        }`}
        size="sm"
      >

        <div className="space-y-4">

          {/* Outstanding */}
          <div className="border border-red-200 bg-red-50 px-4 py-3">

            <div className="text-[10px] font-bold uppercase tracking-wide text-red-600">
              Outstanding Payable
            </div>

            <div className="mt-1 text-xl font-bold font-mono text-red-700">
              {fmt(
                payTarget?.outstanding_amount
              )}
            </div>

          </div>

          {/* Amount */}
          <div>

            <label className="label">
              Amount Paid (₹)
              <span className="text-red-600 ml-1">
                *
              </span>
            </label>

            <input
              type="number"
              step="0.01"
              min="0.01"
              max={
                payTarget?.outstanding_amount ||
                undefined
              }
              className="input font-mono text-right"
              value={payAmt}
              onChange={e =>
                setPayAmt(
                  e.target.value
                )
              }
              placeholder="0.00"
              autoFocus
            />

          </div>

          {/* Payment Method */}
          <div>

            <label className="label">
              Payment Method
            </label>

            <select
              className="input"
              value={payMethod}
              onChange={e =>
                setPayMethod(
                  e.target.value
                )
              }
            >

              <option value="cash">
                Cash
              </option>

              <option value="upi">
                UPI / QR
              </option>

              <option value="card">
                Bank Card
              </option>

              <option value="online">
                Net Banking / NEFT
              </option>

            </select>

          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">

            <button
              type="button"
              onClick={() =>
                setPayTarget(null)
              }
              className="btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={recordPayment}
              disabled={paying}
              className="btn-primary h-9 px-4 text-xs flex items-center justify-center gap-1.5"
            >

              <IndianRupee size={14} />

              {paying
                ? 'Recording...'
                : 'Record Payment'}

            </button>

          </div>

        </div>

      </Modal>

      {/* ======================================================
          DELETE MODAL
      ====================================================== */}

      <Modal
        open={!!deleteTarget}
        onClose={() =>
          setDeleteTarget(null)
        }
        title="Delete Supplier"
        size="sm"
      >

        <div className="space-y-4">

          <div className="border border-red-200 bg-red-50 p-3">

            <div className="flex items-start gap-2">

              <Trash2
                size={16}
                className="text-red-600 mt-0.5 shrink-0"
              />

              <div>

                <p className="text-sm font-semibold text-red-800">
                  Delete supplier record?
                </p>

                <p className="text-xs text-red-700 mt-1">
                  This action cannot be undone.
                </p>

              </div>

            </div>

          </div>

          <p className="text-sm text-slate-600">

            Are you sure you want to delete{' '}

            <span className="font-bold text-slate-900">
              "{deleteTarget?.name}"
            </span>

            ?

          </p>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">

            <button
              type="button"
              onClick={() =>
                setDeleteTarget(null)
              }
              disabled={deleting}
              className="btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="btn-danger h-9 px-4 text-xs"
            >
              {deleting
                ? 'Deleting...'
                : 'Delete Supplier'}
            </button>

          </div>

        </div>

      </Modal>

    </div>
  )
}