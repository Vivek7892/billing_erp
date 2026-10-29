import React, { forwardRef } from 'react'
import { IconSearch, IconX } from '@tabler/icons-react'

/**
 * SearchInput - Unified, minimalist, modern search component for DreamWithTech Billing ERP.
 * 
 * Design system specifications:
 * - Background: Pure white (#FFFFFF) in light mode, dark surface (#1A1B1E / var(--surface)) in dark mode
 * - Border: Thin, subtle neutral border (#D9E0E8 / var(--line))
 * - Border radius: 6px to 8px (rounded-md / rounded-lg)
 * - Height: 38px to 40px for standard, 34px for compact, 40px for product
 * - Search icon: Small, simple Tabler search icon (~16px), #8490A3
 * - Input text: 14px, dark neutral (#172033 / var(--ink))
 * - Placeholder: 14px, muted neutral (#8490A3 / var(--placeholder))
 * - Horizontal padding: 12px (px-3), icon-to-text spacing 8px (mr-2)
 * - Focus border: Primary blue (#0057B8 in light mode)
 * - Focus ring: Very subtle accessible focus indicator (ring-2 ring-[#0057B8]/15)
 * - Transition: Smooth 150ms transition
 * - Shadow: None by default
 */
const SearchInput = forwardRef(function SearchInput({
  value = '',
  onChange,
  onClear,
  placeholder = 'Search...',
  shortcut,
  variant = 'standard', // 'standard' | 'compact' | 'product' | 'global'
  className = '',
  inputClassName = '',
  iconClassName = '',
  clearButtonClassName = '',
  inputProps = {},
  disabled = false,
  autoFocus = false,
  children,
  ...props
}, ref) {
  const isCompact = variant === 'compact'
  const isProduct = variant === 'product'

  const heightClass = isCompact 
    ? 'h-[34px]' 
    : isProduct 
      ? 'h-[40px]' 
      : 'h-[38px]'

  const textSizeClass = isCompact ? 'text-xs' : 'text-sm'
  const iconSize = isCompact ? 15 : 16

  const handleClear = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (onClear) {
      onClear()
    }
    if (onChange) {
      // Support both event-style or direct-value onChange
      if (typeof onChange === 'function') {
        onChange({ target: { value: '' } })
      }
    }
  }

  const handleChange = (e) => {
    if (onChange) {
      onChange(e)
    }
  }

  return (
    <div
      className={`group relative flex items-center min-w-0 w-full rounded-md border border-[#D9E0E8] dark:border-[var(--line)] bg-white dark:bg-[var(--surface)] px-3 transition-all duration-150 shadow-none hover:border-slate-400 dark:hover:border-slate-500 focus-within:border-[#0057B8] focus-within:ring-2 focus-within:ring-[#0057B8]/15 dark:focus-within:border-slate-300 dark:focus-within:ring-white/10 ${heightClass} ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      {...props}
    >
      {/* Search Icon */}
      <IconSearch
        size={iconSize}
        strokeWidth={1.8}
        className={`shrink-0 text-[#8490A3] dark:text-[var(--muted)] group-focus-within:text-[#0057B8] dark:group-focus-within:text-slate-200 transition-colors mr-2 ${iconClassName}`}
        aria-hidden="true"
      />

      {/* Actual Input */}
      <input
        ref={ref}
        type="search"
        value={value ?? ''}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`w-full min-w-0 bg-transparent py-0 ${textSizeClass} font-normal text-[#172033] dark:text-[var(--ink)] placeholder:text-[#8490A3] dark:placeholder:text-[var(--placeholder)] outline-none border-none shadow-none focus:outline-none focus:ring-0 focus:border-none [appearance:none] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden ${inputClassName}`}
        {...inputProps}
      />

      {/* Clear Button */}
      {Boolean(value) && (
        <button
          type="button"
          onClick={handleClear}
          onMouseDown={(e) => e.preventDefault()}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#8490A3] hover:text-[#172033] dark:text-[var(--muted)] dark:hover:text-[var(--ink)] hover:bg-slate-100 dark:hover:bg-[var(--surface-hover)] transition-colors active:scale-95 ml-1 ${clearButtonClassName}`}
          aria-label="Clear search"
          title="Clear search"
        >
          <IconX size={14} strokeWidth={2} />
        </button>
      )}

      {/* Keyboard Shortcut Hint */}
      {!value && shortcut && (
        <kbd className="hidden sm:inline-flex shrink-0 items-center rounded border border-[#D9E0E8] dark:border-[var(--line)] bg-[#F8FAFC] dark:bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[10px] font-medium text-[#8490A3] dark:text-[var(--muted)] select-none ml-1.5">
          {shortcut}
        </kbd>
      )}

      {/* Dropdown or embedded children */}
      {children}
    </div>
  )
})

export default SearchInput

