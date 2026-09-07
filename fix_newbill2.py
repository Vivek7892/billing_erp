"""
Batch UI improvements:
- Replace indigo-600 primary color with blue-600 (var(--primary)) in NewBill
- Improve cart row highlight color
- Improve product grid card styling
- Improve payment method buttons
- Improve top bar styling
- Improve search input focus ring
- Improve category filter pills
- Improve action buttons
"""

with open(r'd:\Billing_pos\billing_erp\frontend\src\pages\NewBill.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

replacements = [
    # Top bar - Quick Pay button: emerald is fine, keep it
    # Category filter pills: indigo -> blue (var(--primary))
    ("'bg-indigo-600 border-indigo-600 text-white' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'}`}>\n              >All</button>",
     "'bg-[var(--primary)] border-[var(--primary)] text-white shadow-[var(--shadow-primary)]' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'}`}>\n              >All</button>"),

    ("catFilter === String(c.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'",
     "catFilter === String(c.id) ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-[var(--shadow-primary)]' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'"),

    # Product grid card: inCart highlight indigo -> blue
    ("inCart ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-950/60' : 'border-[var(--line)] hover:border-indigo-300 hover:bg-indigo-50 dark:bg-indigo-950/60/50'",
     "inCart ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/40' : 'border-[var(--line)] hover:border-blue-200 hover:bg-blue-50/50 dark:hover:bg-blue-950/20'"),

    # Product grid badge counter: indigo -> blue
    ("<span className=\"absolute top-1.5 right-1.5 bg-indigo-600 text-white",
     "<span className=\"absolute top-1.5 right-1.5 bg-[var(--primary)] text-white"),

    # Product price in grid: indigo -> blue
    ("<span className=\"text-xs font-semibold text-indigo-600\">",
     "<span className=\"text-xs font-semibold text-[var(--primary-text)]\">"),

    # Cart row just-added highlight: indigo -> blue
    ("justAdded ? 'bg-indigo-50 dark:bg-indigo-950/60' : 'hover:bg-[var(--surface-elevated)]'",
     "justAdded ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-[var(--surface-elevated)]'"),

    ("justAdded ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''",
     "justAdded ? 'bg-blue-50 dark:bg-blue-950/30' : ''"),

    # Cart row qty input focus ring: indigo -> blue
    ("focus:ring-2 focus:ring-indigo-400\"\n            />\n            <button\n              aria-label={`Increase ${item.product_name} quantity`}\n              onClick={() => onQty(item.id, item.qty + 1)}\n              className=\"h-8 w-8",
     "focus:ring-2 focus:ring-[var(--primary)]\"\n            />\n            <button\n              aria-label={`Increase ${item.product_name} quantity`}\n              onClick={() => onQty(item.id, item.qty + 1)}\n              className=\"h-8 w-8"),

    # Mobile cart row total cell: indigo -> blue
    ("<div className=\"rounded-lg bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-2\">\n                <div className=\"text-[10px] text-indigo-500 dark:text-indigo-400\">Total</div>\n                <div className=\"font-bold text-indigo-700 dark:text-indigo-300 mt-0.5\">",
     "<div className=\"rounded-lg bg-blue-50 dark:bg-blue-950/30 px-2.5 py-2\">\n                <div className=\"text-[10px] text-blue-500 dark:text-blue-400\">Total</div>\n                <div className=\"font-bold text-blue-700 dark:text-blue-300 mt-0.5\">"),

    # Mobile qty input focus ring
    ("focus:ring-2 focus:ring-indigo-400\"\n                />\n                <button\n                  aria-label={`Increase ${item.product_name} quantity`}",
     "focus:ring-2 focus:ring-[var(--primary)]\"\n                />\n                <button\n                  aria-label={`Increase ${item.product_name} quantity`}"),

    # Search input focus ring
    ("className=\"w-full h-11 pl-10 pr-16 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400\"",
     "className=\"w-full h-11 pl-10 pr-16 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]\""),

    # Search dropdown hover: indigo -> blue
    ("className=\"w-full flex items-center justify-between px-3 py-2 text-left hover:bg-indigo-50 dark:bg-indigo-950/60 border-b border-slate-50 last:border-0\"",
     "className=\"w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950/30 border-b border-[var(--line-subtle)] last:border-0 transition-colors\""),

    # Customer input focus ring
    ("className=\"w-full h-9 pl-8 pr-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400\"",
     "className=\"w-full h-9 pl-8 pr-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]\""),

    # Customer dropdown hover: indigo -> blue
    ("className=\"w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:bg-indigo-950/60\">Walk-in Customer</button>",
     "className=\"w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors\">Walk-in Customer</button>"),

    ("className=\"w-full text-left px-3 py-2 hover:bg-indigo-50 dark:bg-indigo-950/60\">",
     "className=\"w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors\">"),

    # Payment method buttons: indigo -> blue
    ("payment.method === id ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'",
     "payment.method === id ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-[var(--shadow-primary)]' : 'border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:border-[var(--primary-border)]'"),

    # Cash amount input focus ring
    ("className=\"w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400\"\n                    value={payment.amount}",
     "className=\"w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]\"\n                    value={payment.amount}"),

    # Card/online amount input focus ring
    ("className=\"w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400\" value={payment.amount}",
     "className=\"w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]\" value={payment.amount}"),

    # Card reference input focus ring
    ("className=\"w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400\" value={payment.reference}",
     "className=\"w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]\" value={payment.reference}"),

    # Bill discount input focus ring
    ("className=\"w-24 h-7 px-2 text-right text-xs rounded border border-[var(--line)] focus:outline-none focus:ring-2 focus:ring-indigo-400\"",
     "className=\"w-24 h-7 px-2 text-right text-xs rounded border border-[var(--line)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]\""),

    # Mobile cart FAB: indigo -> blue
    ("className=\"md:hidden fixed bottom-3 inset-x-3 z-20 min-h-12 rounded-xl bg-indigo-600 text-white",
     "className=\"md:hidden fixed bottom-3 inset-x-3 z-20 min-h-12 rounded-xl bg-[var(--primary)] text-white"),

    # New customer modal inputs focus ring
    ("className=\"w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400\" value={newCustomer.name}",
     "className=\"w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]\" value={newCustomer.name}"),

    ("className=\"w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400\" value={newCustomer.mobile}",
     "className=\"w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]\" value={newCustomer.mobile}"),

    ("className=\"w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400\" value={newCustomer.email}",
     "className=\"w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]\" value={newCustomer.email}"),

    # QR modal amount input focus ring
    ("className=\"w-full h-12 pl-7 pr-3 rounded-lg border border-[var(--line)] text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-400\"",
     "className=\"w-full h-12 pl-7 pr-3 rounded-lg border border-[var(--line)] text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--success)] focus:border-[var(--success)]\""),

    # Clock icon: indigo -> blue
    ("<Clock size={13} className=\"text-indigo-500 dark:text-indigo-400\" />",
     "<Clock size={13} className=\"text-blue-500 dark:text-blue-400\" />"),

    # Clock time display: indigo -> blue
    ("<span className=\"font-mono text-indigo-600 font-semibold tracking-wide\">",
     "<span className=\"font-mono text-blue-600 dark:text-blue-400 font-semibold tracking-wide\">"),

    # New customer button: indigo -> blue
    ("<button className=\"text-xs text-indigo-600 font-medium flex items-center gap-0.5\" onClick={() => setShowCustomerModal(true)}>",
     "<button className=\"text-xs text-[var(--primary-text)] font-semibold flex items-center gap-0.5 hover:underline\" onClick={() => setShowCustomerModal(true)}>"),

    # Save bill button - make it larger and more prominent
    ("className=\"btn-solid w-full h-12 text-sm\"\n              onClick={() => saveBill(false)}",
     "className=\"btn-solid w-full h-12 text-sm font-bold tracking-wide\"\n              onClick={() => saveBill(false)}"),
]

count = 0
for old, new in replacements:
    if old in c:
        c = c.replace(old, new, 1)
        count += 1

with open(r'd:\Billing_pos\billing_erp\frontend\src\pages\NewBill.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print(f'Applied {count}/{len(replacements)} replacements')
