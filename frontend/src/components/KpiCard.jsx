/**
 * ERP Metrics KPI Components
 * Follows the strict Phase 1 Enterprise Design System:
 * - Container: rounded-md border bg-[var(--surface)]
 * - Grid: grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x
 * - Padding: p-3 sm:p-3.5
 * - Label: text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]
 * - Main Value: font-mono text-lg font-bold
 * - Colors: text-[var(--ink)], text-teal-600, text-[#4F46E5]
 * - Shadow: None | Icons: None
 */

export function KpiContainer({ children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-none ${className}`}>
      {children}
    </div>
  )
}

export function KpiGrid({ children, className = '' }) {
  return (
    <div className={`grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x ${className}`}>
      {children}
    </div>
  )
}

export function KpiItem({ label, value, supporting, tone = 'default', onClick }) {
  const valueColor = {
    default: 'text-[var(--ink)]',
    positive: 'text-teal-700 dark:text-teal-400',
    paid: 'text-teal-700 dark:text-teal-400',
    accent: 'text-[#1E3A5F] dark:text-slate-200',
    warning: 'text-amber-700 dark:text-amber-400',
    danger: 'text-red-600',
  }[tone] || 'text-[var(--ink)]'

  return (
    <div
      onClick={onClick}
      className={`p-3 sm:p-3.5 ${onClick ? 'cursor-pointer hover:bg-[var(--surface-elevated)] transition' : ''}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      <p className={`mt-1 font-mono text-lg font-bold ${valueColor}`}>
        {value}
      </p>
      {supporting && (
        <p className="text-[10px] text-[var(--muted)]">
          {supporting}
        </p>
      )}
    </div>
  )
}

export default function KpiStrip({ items = [], className = '' }) {
  return (
    <KpiContainer className={className}>
      <KpiGrid>
        {items.map((item, index) => (
          <KpiItem key={item.label || index} {...item} />
        ))}
      </KpiGrid>
    </KpiContainer>
  )
}
