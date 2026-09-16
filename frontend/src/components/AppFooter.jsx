export default function AppFooter({ shopName }) {
  return (
    <footer className="px-4 py-3 text-center text-[11px] text-[var(--muted-light)] border-t border-[var(--line-subtle)]">
      © {new Date().getFullYear()} {shopName || 'Dreamwithtech'}. All rights reserved.
    </footer>
  )
}
