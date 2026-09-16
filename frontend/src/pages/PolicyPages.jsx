import { useEffect, useState } from 'react'
import api from '../api'
import { PageHeader, Card } from '../components/UI'
import { FileText, Shield, RefreshCw, Package, Truck, ExternalLink } from 'lucide-react'

const POLICY_CONFIG = {
  terms: {
    key: 'terms_url',
    title: 'Terms & Conditions',
    icon: FileText,
    defaultContent: null,
  },
  privacy: {
    key: 'privacy_url',
    title: 'Privacy Policy',
    icon: Shield,
    defaultContent: null,
  },
  refund: {
    key: 'refund_url',
    title: 'Refund Policy',
    icon: RefreshCw,
    defaultContent: null,
  },
  return: {
    key: 'return_url',
    title: 'Return Policy',
    icon: Package,
    defaultContent: 'My Business does not support returns.',
  },
  shipping: {
    key: 'shipping_url',
    title: 'Shipping Policy',
    icon: Truck,
    defaultContent: 'My Business does not ship goods.',
  },
}

export function PolicyPage({ type }) {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const config = POLICY_CONFIG[type]

  useEffect(() => {
    api.get('/settings/all/').then(r => setSettings(r.data)).finally(() => setLoading(false))
  }, [])

  if (!config) return null

  const Icon = config.icon
  const url = settings[config.key]
  const shopName = settings.shop_name || 'ShopEase POS'

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      <PageHeader title={config.title} subtitle={shopName} />
      <Card className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center">
            <Icon size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">{config.title}</h2>
        </div>

        {url ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Our {config.title.toLowerCase()} is available at the link below.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
            >
              <ExternalLink size={14} />
              View {config.title}
            </a>
          </div>
        ) : config.defaultContent ? (
          <p className="text-sm text-[var(--ink-secondary)] leading-relaxed">{config.defaultContent}</p>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            This policy has not been configured yet. Please contact the business for details.
          </p>
        )}
      </Card>
    </div>
  )
}

export function TermsPage() { return <PolicyPage type="terms" /> }
export function PrivacyPage() { return <PolicyPage type="privacy" /> }
export function RefundPage() { return <PolicyPage type="refund" /> }
export function ReturnPage() { return <PolicyPage type="return" /> }
export function ShippingPage() { return <PolicyPage type="shipping" /> }
