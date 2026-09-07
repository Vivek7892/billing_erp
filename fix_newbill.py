with open(r'd:\Billing_pos\billing_erp\frontend\src\pages\NewBill.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix outer div background
content = content.replace(
    'bg-[var(--surface-elevated)] text-[var(--ink)]',
    'bg-[var(--app-bg)] text-[var(--ink)]',
    1
)

# Fix style block - find and replace between markers
start_marker = '      <style>{`'
end_marker = '      `}</style>'
si = content.find(start_marker)
ei = content.find(end_marker, si) + len(end_marker)

new_style = """      <style>{`
        .btn-solid{display:inline-flex;align-items:center;justify-content:center;gap:.375rem;min-height:2.375rem;padding:0 1rem;border-radius:var(--radius);background:var(--primary);color:#fff;font-weight:600;font-size:.8125rem;letter-spacing:.01em;transition:all .15s ease;border:1.5px solid var(--primary);box-shadow:var(--shadow-primary)}
        .btn-solid:hover:not(:disabled){background:var(--primary-hover);border-color:var(--primary-hover)}
        .btn-solid:active:not(:disabled){transform:translateY(1px) scale(.99)}
        .btn-solid:disabled{opacity:.5;cursor:not-allowed}
        .btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:.375rem;min-height:2.375rem;padding:0 .875rem;border-radius:var(--radius);border:1.5px solid var(--line);background:var(--surface);color:var(--ink-secondary);font-weight:600;font-size:.8125rem;letter-spacing:.01em;transition:all .15s ease;box-shadow:var(--shadow-xs)}
        .btn-outline:hover:not(:disabled){background:var(--surface-hover);border-color:var(--muted-light);color:var(--ink)}
        .btn-outline:active:not(:disabled){transform:translateY(1px)}
        .btn-outline:disabled{opacity:.45;cursor:not-allowed}
        @media (max-width: 639px){
          .mobile-safe-button{min-height:2.75rem}
          .mobile-modal-content{max-height:calc(100dvh - 1.5rem);overflow-y:auto}
        }
      `}</style>"""

content = content[:si] + new_style + content[ei:]

with open(r'd:\Billing_pos\billing_erp\frontend\src\pages\NewBill.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('OK si=' + str(si) + ' ei=' + str(ei))
