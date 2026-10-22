import { useEffect, useState } from 'react'
import {
  IconFileText,
  IconLoader2,
  IconCurrencyRupee,
  IconCheck,
} from '@tabler/icons-react'
import DreamVisualContainer from './DreamVisualContainer'

const PAYMENT_STEPS = [
  {
    label: 'Invoice Created',
    desc: 'Invoice generated successfully',
    icon: IconFileText,
  },
  {
    label: 'Payment Processing',
    desc: 'Payment is being processed',
    icon: IconLoader2,
  },
  {
    label: 'Amount Paid',
    desc: 'Payment amount received',
    icon: IconCurrencyRupee,
  },
  {
    label: 'Payment Successful',
    desc: 'Settlement confirmed',
    icon: IconCheck,
  },
]

const SPARKLES = [
  { char: '✦', x: -48, y: -42, scale: 1.35, color: '#0057B8', delay: 0 },
  { char: '✦', x: 48, y: -42, scale: 1.4, color: '#16A9D8', delay: 40 },
  { char: '✧', x: -52, y: 2, scale: 1.25, color: '#F59E0B', delay: 70 },
  { char: '✦', x: 52, y: 2, scale: 1.35, color: '#10B981', delay: 20 },
  { char: '✧', x: -40, y: 42, scale: 1.35, color: '#8B5CF6', delay: 60 },
  { char: '✦', x: 40, y: 42, scale: 1.3, color: '#F97316', delay: 90 },
  { char: '✦', x: -28, y: -54, scale: 1.5, color: '#EF4444', delay: 30 },
  { char: '✦', x: -28, y: -54, scale: 1.5, color: '#EF4444', delay: 30 },
  { char: '✦', x: -28, y: -54, scale: 1.5, color: '#EF4444', delay: 30 },
  { char: '✦', x: -28, y: -54, scale: 1.5, color: '#EF4444', delay: 30 },
  { char: '✦', x: -28, y: -54, scale: 1.5, color: '#EF4444', delay: 30 },
  { char: '✦', x: -28, y: -54, scale: 1.5, color: '#EF4444', delay: 30 },
  { char: '✦', x: -28, y: -54, scale: 1.5, color: '#EF4444', delay: 30 },
  { char: '✦', x: 28, y: 54, scale: 1.5, color: '#06B6D4', delay: 80 },
]

export default function PaymentCompletedVisual({
  className = '',
  amount = '1,250.00',
  invoiceNo = 'INV-2026-104',
  customerName = 'Rahul Sharma',
  uploadedSrc,
}) {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (currentStep >= PAYMENT_STEPS.length - 1) return

    const timer = setTimeout(() => {
      setCurrentStep(prev => prev + 1)
    }, 1800)

    return () => clearTimeout(timer)
  }, [currentStep])

  const isComplete = currentStep === PAYMENT_STEPS.length - 1
  const CurrentIcon = PAYMENT_STEPS[currentStep].icon

  const safeCustomerName =
    customerName?.trim() || 'Walk-in Customer'

  return (
    <DreamVisualContainer
      slotKey="payment-completed"
      title="Payment Completed"
      uploadedSrc={uploadedSrc}
      className={`
        p-4 sm:p-5
        bg-gradient-to-b
        from-white
        to-[#F5F6F8]
        dark:from-slate-900
        dark:to-slate-950
        ${className}
      `}
      badgeText={
        isComplete
          ? 'Payment Successful'
          : 'Processing Transaction'
      }
      badgeVariant={isComplete ? 'success' : 'cyan'}
    >
      <div className="w-full max-w-md mx-auto">
        <div className="flex flex-col items-center text-center">

          {/* STATUS ICON */}
          <div className="relative h-14 w-24 flex items-center justify-center mb-2">

            {isComplete ? (
              <div className="relative h-12 w-12 flex items-center justify-center">

                {/* ONE-TIME FIREWORK / CRACKER BURST */}
                <div
                  className="absolute inset-[-65px] z-0 pointer-events-none overflow-visible"
                  aria-hidden="true"
                >
                  {SPARKLES.map((sparkle, index) => (
                    <span
                      key={index}
                      className="absolute left-1/2 top-1/2 select-none"
                      style={{
                        color: sparkle.color,
                        fontSize: '24px',
                        fontWeight: 800,
                        lineHeight: 1,
                        opacity: 0,
                        transform:
                          'translate(-50%, -50%) translate(0, 0) scale(0)',
                        animation: `payment-sparkle-burst 950ms cubic-bezier(.2,.8,.2,1) ${sparkle.delay}ms forwards`,
                        '--sparkle-x': `${sparkle.x}px`,
                        '--sparkle-y': `${sparkle.y}px`,
                        '--sparkle-scale': sparkle.scale,
                      }}
                    >
                      {sparkle.char}
                    </span>
                  ))}
                </div>

                {/* STATIC SUCCESS CHECK */}
                <IconCheck
                  size={48}
                  strokeWidth={2.6}
                  className="relative z-10 text-emerald-600"
                />

              </div>
            ) : (
              <CurrentIcon
                size={32}
                strokeWidth={2}
                className={
                  currentStep === 1
                    ? 'text-[#16A9D8] animate-spin'
                    : currentStep === 2
                      ? 'text-[#003F8F]'
                      : 'text-[#0057B8]'
                }
              />
            )}

          </div>

          {/* AMOUNT */}
          <div
            className={`
              text-xl sm:text-2xl
              font-bold
              leading-none
              ${
                isComplete
                  ? 'text-emerald-600'
                  : 'text-[#111111] dark:text-white'
              }
            `}
          >
            ₹{amount}
          </div>

          {/* CUSTOMER */}
          <div className="mt-1 h-5 max-w-full truncate px-2 text-xs sm:text-sm font-semibold text-[#111111] dark:text-white">
            {safeCustomerName}
          </div>

          {/* CURRENT STATUS */}
          <h3 className="mt-1 h-5 text-sm sm:text-base font-bold text-[#111111] dark:text-white">
            {PAYMENT_STEPS[currentStep].label}
          </h3>

          {/* DESCRIPTION */}
          <p className="mt-1 h-4 max-w-full truncate px-2 text-[10px] sm:text-xs text-[#555555] dark:text-gray-300">
            {isComplete
              ? `Payment completed successfully for ${safeCustomerName}`
              : currentStep === 1
                ? `Processing payment for ${safeCustomerName}`
                : currentStep === 2
                  ? `₹${amount} received from ${safeCustomerName}`
                  : PAYMENT_STEPS[currentStep].desc}
          </p>

          {/* PAYMENT PROGRESS */}
          <div className="w-full mt-4">

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
              <div
                className={`
                  h-full rounded-full
                  transition-all duration-700 ease-out
                  ${
                    isComplete
                      ? 'bg-emerald-500'
                      : 'bg-[#0057B8]'
                  }
                `}
                style={{
                  width: `${((currentStep + 1) / PAYMENT_STEPS.length) * 100}%`,
                }}
              />
            </div>

            {/* STAGE LABELS */}
            <div className="mt-2 flex h-3 items-center justify-between text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500">

              <span
                className={
                  currentStep >= 0
                    ? 'text-[#0057B8]'
                    : ''
                }
              >
                Invoice
              </span>

              <span
                className={
                  currentStep >= 1
                    ? 'text-[#0057B8]'
                    : ''
                }
              >
                Processing
              </span>

              <span
                className={
                  currentStep >= 2
                    ? 'text-[#0057B8]'
                    : ''
                }
              >
                Paid
              </span>

              <span
                className={
                  isComplete
                    ? 'font-semibold text-emerald-600'
                    : ''
                }
              >
                Complete
              </span>

            </div>
          </div>

          {/* BILLING REFERENCE */}
          <div className="mt-3 flex h-4 items-center justify-center gap-2 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">

            <span className="max-w-[120px] truncate">
              {safeCustomerName}
            </span>

            <span className="text-slate-300 dark:text-slate-600">
              •
            </span>

            <span className="font-semibold">
              {invoiceNo}
            </span>

            {isComplete && (
              <>
                <span className="text-slate-300 dark:text-slate-600">
                  •
                </span>

                <span className="font-medium text-emerald-600">
                  Settled
                </span>
              </>
            )}

          </div>

        </div>
      </div>

      {/* LOCAL COMPONENT ANIMATION */}
      <style>{`
        @keyframes payment-sparkle-burst {
          0% {
            opacity: 0;
            transform:
              translate(-50%, -50%)
              translate(0, 0)
              scale(0);
          }

          12% {
            opacity: 1;
            transform:
              translate(-50%, -50%)
              translate(
                calc(var(--sparkle-x) * 0.18),
                calc(var(--sparkle-y) * 0.18)
              )
              scale(0.65);
          }

          45% {
            opacity: 1;
            transform:
              translate(-50%, -50%)
              translate(
                calc(var(--sparkle-x) * 0.65),
                calc(var(--sparkle-y) * 0.65)
              )
              scale(0.95);
          }

          100% {
            opacity: 0;
            transform:
              translate(-50%, -50%)
              translate(
                var(--sparkle-x),
                var(--sparkle-y)
              )
              scale(var(--sparkle-scale));
          }
        }
      `}</style>
    </DreamVisualContainer>
  )
}