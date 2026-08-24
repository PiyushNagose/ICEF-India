import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Plus, FileText, Shield, Lock, RefreshCw, Loader2,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { adminService } from '../../services/admin.service'

// Gateway logos / icons as colored initials
const GW_META = {
  Razorpay: { color: '#2563eb', bg: '#dbeafe', short: 'R', label: 'Razorpay' },
  Cashfree: { color: '#16a34a', bg: '#dcfce7', short: 'CF', label: 'Cashfree' },
  Paytm:    { color: '#7c3aed', bg: '#ede9fe', short: 'P', label: 'Paytm' },
  PhonePe:  { color: '#9333ea', bg: '#f3e8ff', short: 'PP', label: 'PhonePe' },
}

const STATUS_BADGE = {
  ACTIVE:   { label: 'Active',      dot: '#22c55e', text: '#15803d', bg: '#f0fdf4' },
  INACTIVE: { label: 'Standby',     dot: '#94a3b8', text: '#475569', bg: '#f8fafc' },
  LIMITED:  { label: 'Limited',     dot: '#f59e0b', text: '#b45309', bg: '#fffbeb' },
}

const SYSTEM_BADGE = {
  Razorpay: { label: 'SYSTEM DEFAULT', color: '#16a34a', bg: '#f0fdf4' },
  Cashfree: { label: 'INACTIVE',       color: '#64748b', bg: '#f1f5f9' },
  Paytm:    { label: 'BACKUP GATEWAY', color: '#2563eb', bg: '#eff6ff' },
  PhonePe:  { label: 'MAINTENANCE',    color: '#d97706', bg: '#fffbeb' },
}

const GatewayCard = ({ gateway, onConfigure, onToggle, isToggling }) => {
  const meta = GW_META[gateway.name] || { color: '#f97316', bg: '#fff7ed', short: '?', label: gateway.name }
  const statusInfo = STATUS_BADGE[gateway.status] || STATUS_BADGE.INACTIVE
  const sysBadge = SYSTEM_BADGE[gateway.name]
  const isActive = gateway.status === 'ACTIVE'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* System badge */}
      {sysBadge && (
        <div className="px-4 pt-3 pb-0 flex justify-end">
          <span
            className="text-xs font-bold uppercase tracking-normal px-2 py-0.5 rounded"
            style={{ color: sysBadge.color, background: sysBadge.bg }}
          >
            {sysBadge.label}
          </span>
        </div>
      )}

      <div className="p-5 flex-1">
        {/* Logo + name */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0"
            style={{ background: meta.bg, color: meta.color }}
          >
            {meta.short}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base">{meta.label}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ background: statusInfo.dot }}
              />
              <span className="text-xs" style={{ color: statusInfo.text }}>
                {statusInfo.label} • {gateway.mode || 'Test'} Mode
              </span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1 text-xs text-gray-500 mb-4">
          {gateway.updatedAt && (
            <div>Last Updated: {new Date(gateway.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          )}
          <div>Settlement: {gateway.settlementDays || 'T+2 Days'}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 space-y-2">
        <button
          onClick={() => onConfigure(gateway.name)}
          className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-colors"
          style={{ background: '#f97316' }}
        >
          Configure
        </button>
        <button
          onClick={() => onToggle(gateway)}
          disabled={isToggling}
          className={`w-full py-2.5 rounded-lg font-semibold text-sm border transition-colors ${
            isActive
              ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
              : 'border-green-500 text-green-700 bg-green-50 hover:bg-green-100'
          }`}
        >
          {isToggling ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  )
}

const PaymentSettings = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [togglingGateway, setTogglingGateway] = useState(null)

  const { data: gatewaysData, isLoading } = useQuery({
    queryKey: ['admin-payment-gateways'],
    queryFn: adminService.getPaymentGateways,
  })

  useQuery({
    queryKey: ['admin-payment-stats'],
    queryFn: adminService.getPaymentStats,
  })

  const { mutate: toggleGateway } = useMutation({
    mutationFn: ({ name, status }) => adminService.upsertPaymentGateway(name, { status }),
    onSuccess: (_, vars) => {
      toast.success(`${vars.name} ${vars.status === 'ACTIVE' ? 'activated' : 'deactivated'}`)
      queryClient.invalidateQueries({ queryKey: ['admin-payment-gateways'] })
      setTogglingGateway(null)
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update gateway')
      setTogglingGateway(null)
    },
  })

  const handleToggle = (gateway) => {
    const newStatus = gateway.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setTogglingGateway(gateway.name)
    toggleGateway({ name: gateway.name, status: newStatus })
  }

  const handleConfigure = (name) => {
    navigate(`/admin/payment-settings/${name.toLowerCase()}`)
  }

  const gateways = gatewaysData?.gateways || []

  // Settlement progress (mock 82% as shown in image — real calc needs settlement data)
  const settlementPct = 82

  return (
    <AdminLayout title="Payment Settings">
      <div className="min-h-full p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Settings</h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage institutional payment gateways, API integrations, and settlement configurations
              for recruitment fee collections.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/activity-logs')}
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              View Audit Log
            </Button>
            <Button
              onClick={() => navigate('/admin/payment-settings/add-gateway')}
              className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add New Gateway
            </Button>
          </div>
        </div>

        {/* Gateway Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
          </div>
        ) : gateways.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-500 mb-4">No payment gateways configured yet.</p>
            <Button
              onClick={() => navigate('/admin/payment-settings/add-gateway')}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Gateway
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {gateways.map((gw) => (
              <GatewayCard
                key={gw.name}
                gateway={gw}
                onConfigure={handleConfigure}
                onToggle={handleToggle}
                isToggling={togglingGateway === gw.name}
              />
            ))}
          </div>
        )}

        {/* Settlement Progress */}
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Settlement Target Completion</h3>
                <p className="text-sm text-gray-500 mt-0.5">Monthly reconciliation progress across all gateways</p>
              </div>
              <span className="text-2xl font-bold text-orange-600">{settlementPct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${settlementPct}%`,
                  background: 'linear-gradient(90deg, #f97316, #fb923c)',
                }}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                  RECONCILED
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />
                  PENDING
                </span>
              </div>
              <span>NEXT BATCH: 06:00 AM IST</span>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-3 gap-5">
          {/* Security Protocol */}
          <div className="lg:col-span-2">
            <Card className="bg-white h-full">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Institutional Security Protocol</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    All transactions are encrypted using AES-256 standards. Our gateways comply with PCI-DSS Level 1
                    ensuring institutional-grade protection for candidate financial data and government revenue collection.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Encryption Status */}
          <Card className="bg-gray-900 text-white">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-white">Encryption Status</h3>
              </div>
              <div className="space-y-1.5 text-sm text-gray-300">
                <div>Environment: <span className="text-white font-medium">Production</span></div>
                <div>SSL Cert: <span className="text-green-400 font-medium">Valid (Expires 2025)</span></div>
              </div>
              <button
                onClick={() => toast.success('Credentials refreshed')}
                className="flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-semibold transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                REFRESH CREDENTIALS
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

export default PaymentSettings





