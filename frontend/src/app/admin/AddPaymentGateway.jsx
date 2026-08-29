import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Shield } from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import Button from '../../components/ui/Button'
import { adminService } from '../../services/admin.service'

const GATEWAYS = [
  {
    name: 'Razorpay',
    slug: 'razorpay',
    description: "India's leading payments solution. Trusted by millions for secure and fast transactions.",
    tagline: 'ACTIVE SINCE JAN 2024',
    color: '#2563eb',
    bg: '#dbeafe',
    short: 'R',
    features: ['UPI', 'Cards', 'Net Banking', 'Wallets', 'EMI'],
  },
  {
    name: 'Cashfree',
    slug: 'cashfree',
    description: 'Fastest way to collect payments and offer payouts. Optimized for high-volume transactions.',
    tagline: 'SETUP IN 2 MINS',
    color: '#16a34a',
    bg: '#dcfce7',
    short: 'CF',
    features: ['UPI', 'Cards', 'Net Banking', 'Payout'],
  },
  {
    name: 'Paytm',
    slug: 'paytm',
    description: "Built for every business size. Seamless integration with India's most popular wallet.",
    tagline: 'ENTERPRISE GRADE',
    color: '#7c3aed',
    bg: '#ede9fe',
    short: 'P',
    features: ['Paytm Wallet', 'UPI', 'Cards', 'Net Banking'],
  },
  {
    name: 'PhonePe',
    slug: 'phonepe',
    description: 'Accept payments from 500M+ users. Superior success rates for UPI transactions.',
    tagline: 'BEST-IN-CLASS UPI',
    color: '#9333ea',
    bg: '#f3e8ff',
    short: 'PP',
    features: ['PhonePe', 'UPI', 'Cards', 'Net Banking'],
  },
]

const AddPaymentGateway = () => {
  const navigate = useNavigate()

  const { data: gatewaysData } = useQuery({
    queryKey: ['admin-payment-gateways'],
    queryFn: adminService.getPaymentGateways,
  })

  const apiGateways = gatewaysData?.gateways || []
  const getExisting = (name) => apiGateways.find(g => g.name === name)

  return (
    <AdminLayout title="Add Payment Gateway">
      <div className="min-h-full p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/payment-settings')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add Payment Gateway</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Integrate secure payment channels to facilitate Bihar Recruitment Portal transactions.
            </p>
          </div>
        </div>

        {/* Gateway Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {GATEWAYS.map((gw) => {
            const existing = getExisting(gw.name)
            const isConfigured = !!existing
            const isActive = existing?.status === 'ACTIVE'

            return (
              <div
                key={gw.name}
                className={`bg-white rounded-2xl border-2 transition-all ${
                  isActive
                    ? 'border-green-400'
                    : isConfigured
                    ? 'border-gray-300'
                    : 'border-gray-200 hover:border-orange-300'
                } overflow-hidden`}
              >
                <div className="p-6">
                  {/* Badge */}
                  <div className="flex justify-end mb-3">
                    <span className={`whitespace-nowrap text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'text-green-700 bg-green-100'
                        : isConfigured
                        ? 'text-gray-600 bg-gray-100'
                        : 'text-gray-500 bg-gray-100'
                    }`}>
                      {isActive ? '✓ Configured' : isConfigured ? '✓ Configured' : '+ Not configured'}
                    </span>
                  </div>

                  {/* Logo + Name */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0"
                      style={{ background: gw.bg, color: gw.color }}
                    >
                      {gw.short}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{gw.name}</h3>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">{gw.description}</p>

                  {/* Tagline */}
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-normal mb-3">
                    {gw.tagline}
                  </p>

                  {/* Features */}
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {gw.features.map(f => (
                      <span
                        key={f}
                        className="whitespace-nowrap px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium"
                      >
                        {f}
                      </span>
                    ))}
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => navigate(`/admin/payment-settings/${gw.slug}`)}
                    className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                      isConfigured
                        ? 'bg-gray-900 text-white hover:bg-gray-800'
                        : 'bg-orange-600 text-white hover:bg-orange-700'
                    }`}
                  >
                    {isConfigured ? (
                      <>✏️ Edit</>
                    ) : (
                      <>⚡ Enable</>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Security Notice */}
        <div className="flex items-start gap-4 p-5 bg-orange-50 border border-orange-200 rounded-2xl">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-orange-900 mb-1">Institutional Security Protocol</h3>
            <p className="text-sm text-orange-800">
              All gateways must comply with PCI-DSS standards and Bihar Government digital security mandates
              before going live. API credentials are encrypted with AES-256-GCM before storage.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AddPaymentGateway





