import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Eye, EyeOff, Copy, AlertTriangle, Key,
  Link, CheckCircle, Loader2,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import CustomSelect from '../../components/ui/CustomSelect'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { adminService } from '../../services/admin.service'
import { WEBHOOK_BASE_URL } from '../../api/config'

const RazorpayConfig = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showSecret, setShowSecret] = useState(false)
  const [showWebhook, setShowWebhook] = useState(false)
  const [form, setForm] = useState({
    status: 'INACTIVE',
    mode: 'Test',
    apiKey: '',
    secretKey: '',
    webhookSecret: '',
    settlementDays: '1-2 Days',
  })

  const { data: gatewaysData, isLoading } = useQuery({
    queryKey: ['admin-payment-gateways'],
    queryFn: adminService.getPaymentGateways,
  })

  // Populate form from existing config
  useEffect(() => {
    const gateways = gatewaysData?.gateways || []
    const razorpay = gateways.find(g => g.name === 'Razorpay')
    if (razorpay) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(f => ({
        ...f,
        status: razorpay.status || 'INACTIVE',
        mode: razorpay.mode || 'Test',
        settlementDays: razorpay.settlementDays || '1-2 Days',
        // Don't pre-fill secrets for security
      }))
    }
  }, [gatewaysData])

  const { mutate: saveConfig, isPending } = useMutation({
    mutationFn: (data) => adminService.upsertPaymentGateway('Razorpay', data),
    onSuccess: () => {
      toast.success('Razorpay configuration saved')
      queryClient.invalidateQueries({ queryKey: ['admin-payment-gateways'] })
    },
    onError: (err) => toast.error(err.message || 'Failed to save configuration'),
  })

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const handleSave = () => {
    if (!form.apiKey.trim() && !form.secretKey.trim()) {
      // Only update status/mode if no keys provided
      saveConfig({ status: form.status, mode: form.mode, settlementDays: form.settlementDays })
    } else {
      saveConfig(form)
    }
  }

  const gateways = gatewaysData?.gateways || []
  const razorpay = gateways.find(g => g.name === 'Razorpay')
  const isActive = razorpay?.status === 'ACTIVE'

  const WEBHOOK_URL = `${WEBHOOK_BASE_URL}/api/candidate/payments/razorpay/webhook`

  return (
    <AdminLayout title="Razorpay Configuration">
      <div className="min-h-full p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/payment-settings')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">R</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Razorpay Configuration</h1>
                <div className="flex items-center gap-3 mt-1">
                  <Badge className={isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}>
                    {isActive ? '● Active' : '○ Inactive'}
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-800">
                    {razorpay?.mode || form.mode} Mode
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Mode:</span>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {['Test', 'Live'].map(m => (
                <button
                  key={m}
                  onClick={() => setForm(f => ({ ...f, mode: m }))}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    form.mode === m
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch lg:grid-cols-3 gap-6">
          {/* Config Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* API Keys */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">API Configuration</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <CustomSelect
                    value={form.status}
                    onChange={(val) => setForm(f => ({ ...f, status: val }))}
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'INACTIVE', label: 'Inactive' },
                      { value: 'LIMITED', label: 'Limited' },
                    ]}
                    className="w-full border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key ID
                  </label>
                  <input
                    type="text"
                    placeholder="rzp_test_... or rzp_live_..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono"
                    value={form.apiKey}
                    onChange={(e) => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  />
                  <p className="text-xs text-gray-400 mt-1">Leave blank to keep existing key</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Secret</label>
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        placeholder="Enter API secret"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono"
                        value={form.secretKey}
                        onChange={(e) => setForm(f => ({ ...f, secretKey: e.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Secret</label>
                    <div className="relative">
                      <input
                        type={showWebhook ? 'text' : 'password'}
                        placeholder="Enter webhook secret"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono"
                        value={form.webhookSecret}
                        onChange={(e) => setForm(f => ({ ...f, webhookSecret: e.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebhook(!showWebhook)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Days</label>
                  <input
                    type="text"
                    placeholder="e.g. 1-2 Days"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    value={form.settlementDays}
                    onChange={(e) => setForm(f => ({ ...f, settlementDays: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Webhook */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Link className="w-5 h-5 text-yellow-600" />
                  <h3 className="font-semibold text-gray-900">Webhook Endpoint</h3>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-4">
                  Add this URL in your Razorpay Dashboard under Settings → Webhooks to receive real-time payment notifications.
                </p>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
                  <code className="flex-1 text-sm text-gray-800 break-all">{WEBHOOK_URL}</code>
                  <Button variant="outline" size="sm" onClick={() => handleCopy(WEBHOOK_URL)}>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Security Alert */}
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-800 mb-1">Security Protocol Alert</h4>
                    <p className="text-red-700 text-sm">
                      Your API Secret and Webhook Secret are extremely sensitive. Never share them or commit them to repositories.
                      All keys are encrypted with AES-256-GCM before storage. If compromised, rotate keys immediately in the Razorpay dashboard.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Panel */}
          <div className="space-y-6">
            <Card className={isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}>
              <CardContent className="p-6 text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <CheckCircle className={`w-8 h-8 ${isActive ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <h3 className={`font-semibold mb-2 ${isActive ? 'text-green-800' : 'text-gray-700'}`}>
                  {isActive ? 'Gateway Active' : 'Gateway Inactive'}
                </h3>
                <p className={`text-sm mb-4 ${isActive ? 'text-green-700' : 'text-gray-500'}`}>
                  {isActive
                    ? 'Razorpay is accepting payments.'
                    : 'Configure and activate to start accepting payments.'}
                </p>
                {razorpay?.updatedAt && (
                  <p className="text-xs text-gray-500">
                    Last updated: {new Date(razorpay.updatedAt).toLocaleDateString('en-IN')}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-3">
                <h3 className="font-semibold text-gray-900">Supported Methods</h3>
                {['UPI', 'Credit/Debit Cards', 'Net Banking', 'Wallets', 'EMI'].map(m => (
                  <div key={m} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {m}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={() => navigate('/admin/payment-settings')}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending || isLoading}
            className="bg-orange-600 hover:bg-orange-700 text-white px-8"
          >
            {isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              : <><CheckCircle className="w-4 h-4 mr-2" />Save Configuration</>
            }
          </Button>
        </div>
      </div>
    </AdminLayout>
  )
}

export default RazorpayConfig





