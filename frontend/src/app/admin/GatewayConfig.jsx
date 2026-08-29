import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Eye, EyeOff, Copy, AlertTriangle, Key, Link2,
  CheckCircle, XCircle, Loader2, ArrowLeft, Wifi,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { adminService } from '../../services/admin.service'
import { WEBHOOK_BASE_URL } from '../../api/config'

const GW_META = {
  razorpay: { label: 'Razorpay',  color: '#2563eb', bg: '#dbeafe', short: 'R',  webhookPath: 'razorpay' },
  cashfree: { label: 'Cashfree',  color: '#16a34a', bg: '#dcfce7', short: 'CF', webhookPath: 'cashfree' },
  paytm:    { label: 'Paytm',     color: '#7c3aed', bg: '#ede9fe', short: 'P',  webhookPath: 'paytm' },
  phonepe:  { label: 'PhonePe',   color: '#9333ea', bg: '#f3e8ff', short: 'PP', webhookPath: 'phonepe' },
}

const GatewayConfig = () => {
  const { name } = useParams() // e.g. "razorpay"
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const meta = GW_META[name?.toLowerCase()] || GW_META.razorpay
  const gatewayName = meta.label // "Razorpay"

  const [showSecret, setShowSecret] = useState(false)
  const [showWebhook, setShowWebhook] = useState(false)
  const [showMerchant, setShowMerchant] = useState(false)
  const [testResult, setTestResult] = useState(null) // { connected, message }
  const [isTesting, setIsTesting] = useState(false)

  const [form, setForm] = useState({
    status: 'INACTIVE',
    mode: 'Test',
    apiKey: '',
    secretKey: '',
    webhookSecret: '',
    merchantId: '',
    settlementDays: 'T+2 Days',
  })

  // Fetch existing config
  const { data: gwData, isLoading } = useQuery({
    queryKey: ['admin-payment-gateway', gatewayName],
    queryFn: () => adminService.getPaymentGateway(gatewayName),
  })

  useEffect(() => {
    if (gwData?.gateway) {
      const gw = gwData.gateway
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(f => ({
        ...f,
        status: gw.status || 'INACTIVE',
        mode: gw.mode || 'Test',
        settlementDays: gw.settlementDays || 'T+2 Days',
        // Don't pre-fill secrets — show placeholder if they exist
      }))
    }
  }, [gwData])

  const { mutate: saveConfig, isPending: isSaving } = useMutation({
    mutationFn: (data) => adminService.upsertPaymentGateway(gatewayName, data),
    onSuccess: () => {
      toast.success(`${gatewayName} configuration saved`)
      queryClient.invalidateQueries({ queryKey: ['admin-payment-gateways'] })
      queryClient.invalidateQueries({ queryKey: ['admin-payment-gateway', gatewayName] })
    },
    onError: (err) => toast.error(err.message || 'Failed to save'),
  })

  const { mutate: activateGateway, isPending: isActivating } = useMutation({
    mutationFn: () => adminService.upsertPaymentGateway(gatewayName, { status: 'ACTIVE' }),
    onSuccess: () => {
      toast.success(`${gatewayName} activated successfully`)
      queryClient.invalidateQueries({ queryKey: ['admin-payment-gateways'] })
      queryClient.invalidateQueries({ queryKey: ['admin-payment-gateway', gatewayName] })
    },
    onError: (err) => toast.error(err.message || 'Failed to activate'),
  })

  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await adminService.testPaymentGateway(gatewayName)
      setTestResult(result)
    } catch (err) {
      setTestResult({ connected: false, message: err.message || 'Connection failed' })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = () => {
    const payload = {
      status: form.status,
      mode: form.mode,
      settlementDays: form.settlementDays,
      ...(form.apiKey.trim() && { apiKey: form.apiKey.trim() }),
      ...(form.secretKey.trim() && { secretKey: form.secretKey.trim() }),
      ...(form.webhookSecret.trim() && { webhookSecret: form.webhookSecret.trim() }),
      ...(form.merchantId.trim() && { merchantId: form.merchantId.trim() }),
    }
    saveConfig(payload)
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const gw = gwData?.gateway
  const isActive = gw?.status === 'ACTIVE'
  const hasApiKey = gw?.hasApiKey
  const hasSecretKey = gw?.hasSecretKey
  const hasWebhookSecret = gw?.hasWebhookSecret

  const WEBHOOK_URL = `${WEBHOOK_BASE_URL}/api/candidate/payments/${meta.webhookPath}/webhook`

  if (isLoading) return (
    <AdminLayout title={`${gatewayName} Configuration`}>
      <div className="flex items-center justify-center min-h-full">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout title={`${gatewayName} Configuration`}>
      <div className="min-h-full p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/payment-settings')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl"
                style={{ background: meta.bg, color: meta.color }}
              >
                {meta.short}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{gatewayName}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`flex items-center gap-1.5 text-sm font-medium ${isActive ? 'text-green-600' : 'text-gray-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    Status: {isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-orange-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    Mode: {form.mode}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 font-medium">GATEWAY MODE</span>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {['Test', 'Live'].map(m => (
                <button
                  key={m}
                  onClick={() => set('mode', m)}
                  className={`px-5 py-2 text-sm font-semibold transition-colors ${
                    form.mode === m
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch lg:grid-cols-3 gap-6">
          {/* Left: Config Form */}
          <div className="lg:col-span-2 space-y-5">
            {/* API Configuration */}
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">API Configuration</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-2">
                    API KEY ID
                  </label>
                  <input
                    type="text"
                    placeholder={hasApiKey ? '••••••••••••••••••••' : `Enter ${gatewayName} API key`}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-orange-50/30 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono"
                    value={form.apiKey}
                    onChange={(e) => set('apiKey', e.target.value)}
                  />
                  {hasApiKey && !form.apiKey && (
                    <p className="text-xs text-green-600 mt-1">✓ API key is configured</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-2">
                      API SECRET
                    </label>
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        placeholder={hasSecretKey ? '••••••••••••••' : 'Enter API secret'}
                        className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono"
                        value={form.secretKey}
                        onChange={(e) => set('secretKey', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {hasSecretKey && !form.secretKey && (
                      <p className="text-xs text-green-600 mt-1">✓ Secret key is configured</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-2">
                      WEBHOOK SECRET
                    </label>
                    <div className="relative">
                      <input
                        type={showWebhook ? 'text' : 'password'}
                        placeholder={hasWebhookSecret ? '••••••••••••••' : 'Enter webhook secret'}
                        className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono"
                        value={form.webhookSecret}
                        onChange={(e) => set('webhookSecret', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebhook(!showWebhook)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {hasWebhookSecret && !form.webhookSecret && (
                      <p className="text-xs text-green-600 mt-1">✓ Webhook secret is configured</p>
                    )}
                  </div>
                </div>

                {/* Merchant ID (Paytm / PhonePe) */}
                {(name === 'paytm' || name === 'phonepe') && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-2">
                      MERCHANT ID
                    </label>
                    <div className="relative">
                      <input
                        type={showMerchant ? 'text' : 'password'}
                        placeholder="Enter merchant ID"
                        className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono"
                        value={form.merchantId}
                        onChange={(e) => set('merchantId', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowMerchant(!showMerchant)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showMerchant ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-2">
                    SETTLEMENT DAYS
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. T+2 Days"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    value={form.settlementDays}
                    onChange={(e) => set('settlementDays', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Webhook Endpoint */}
            <Card className="border-l-4 border-l-yellow-400">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-yellow-600" />
                  <h3 className="font-semibold text-gray-900">Webhook Endpoint</h3>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Configure this URL in your {gatewayName} Dashboard under Settings → Webhooks to receive
                  real-time notifications for payment successes, failures, and refunds.
                </p>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <code className="flex-1 text-sm text-gray-700 break-all">{WEBHOOK_URL}</code>
                  <button
                    onClick={() => handleCopy(WEBHOOK_URL)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-white transition-colors flex-shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    COPY
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Security Alert */}
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700 uppercase tracking-normal mb-1">
                  SECURITY PROTOCOL ALERT
                </p>
                <p className="text-sm text-red-700">
                  Your API Secret and Webhook Secret are extremely sensitive. Never share them or commit them
                  to public repositories. This portal encrypts these keys using AES-256-GCM before storage.
                  If you suspect a compromise, rotate your keys immediately in the {gatewayName} dashboard.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Connectivity + Actions */}
          <div className="space-y-5">
            {/* Connectivity Card */}
            <Card className={`border-2 ${testResult?.connected ? 'border-green-300 bg-green-50' : testResult?.connected === false ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
              <CardContent className="p-6 text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  testResult?.connected ? 'bg-green-100' : testResult?.connected === false ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  {isTesting ? (
                    <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                  ) : testResult?.connected ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : testResult?.connected === false ? (
                    <XCircle className="w-8 h-8 text-red-500" />
                  ) : (
                    <Wifi className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Connectivity</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {testResult
                    ? testResult.message
                    : 'Validate your API credentials with the gateway servers.'}
                </p>
                {testResult?.connected && (
                  <div className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold mb-3">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Connection Successful
                  </div>
                )}
                <button
                  onClick={handleTest}
                  disabled={isTesting}
                  className="w-full py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </button>
              </CardContent>
            </Card>

            {/* Supported Methods */}
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">Supported Methods</h3>
                <div className="space-y-2">
                  {(gw?.supportedMethods || ['card', 'upi', 'netbanking', 'wallet']).map(m => (
                    <div key={m} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="capitalize">{m.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={() => navigate('/admin/payment-settings')}>
            Cancel
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isSaving}
              className="border-gray-300 text-gray-700 px-6"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Configuration'}
            </Button>
            <Button
              onClick={() => activateGateway()}
              disabled={isActivating || isActive}
              className="bg-orange-600 hover:bg-orange-700 text-white px-6"
            >
              {isActivating ? <Loader2 className="w-4 h-4 animate-spin" /> : isActive ? '✓ Gateway Active' : 'Activate Gateway'}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default GatewayConfig





