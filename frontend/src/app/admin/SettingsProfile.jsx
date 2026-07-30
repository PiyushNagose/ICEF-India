import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  User, Lock, Bell, Shield, Save, Eye, EyeOff,
  Mail, Phone, Building, Calendar, Loader2, Hash,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { adminService } from '../../services/admin.service'

const inp = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm transition-colors'
const inpDisabled = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 text-sm cursor-not-allowed'

const TABS = [
  { id: 'profile',       label: 'Profile',       icon: User  },
  { id: 'security',      label: 'Security',      icon: Lock  },
  { id: 'notifications', label: 'Notifications', icon: Bell  },
]

const SettingsProfile = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('profile')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [profileForm, setProfileForm] = useState({
    fullName: '', contactNumber: '', department: '', roleDesignation: '', dateOfJoining: '',
  })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [notifPrefs, setNotifPrefs] = useState({
    emailNotifications: true, paymentAlerts: true,
    applicationUpdates: true, systemAlerts: true, weeklyReport: false,
  })

  // Fetch own profile
  const { data: profileData, isLoading } = useQuery({
    queryKey: ['admin-my-profile'],
    queryFn: adminService.getMyProfile,
  })
  const profile = profileData?.employee || profileData || {}

  // Populate form when data loads
  useEffect(() => {
    if (profile?.fullName) {
      setProfileForm({
        fullName:        profile.fullName || '',
        contactNumber:   profile.contactNumber || '',
        department:      profile.department || '',
        roleDesignation: profile.roleDesignation || '',
        dateOfJoining:   profile.dateOfJoining ? profile.dateOfJoining.split('T')[0] : '',
      })
    }
  }, [profile?.fullName])

  const { mutate: updateProfile, isPending: saving } = useMutation({
    mutationFn: (data) => adminService.updateMyProfile(data),
    onSuccess: () => {
      toast.success('Profile updated successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-my-profile'] })
    },
    onError: (err) => toast.error(err.message || 'Failed to update profile'),
  })

  const { mutate: updatePassword, isPending: changingPwd } = useMutation({
    mutationFn: (data) => adminService.updateMyProfile(data),
    onSuccess: () => {
      toast.success('Password updated successfully')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    },
    onError: (err) => toast.error(err.message || 'Failed to update password'),
  })

  const handleProfileSave = () => {
    if (!profileForm.fullName.trim()) { toast.error('Full name is required'); return }
    updateProfile(profileForm)
  }

  const handlePasswordChange = () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) { toast.error('Fill all password fields'); return }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error('Passwords do not match'); return }
    if (passwordForm.newPassword.length < 8) { toast.error('Minimum 8 characters'); return }
    updatePassword({ password: passwordForm.newPassword })
  }

  const initials = (profile?.fullName || 'A').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  if (isLoading) return (
    <AdminLayout title="Settings & Profile">
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout title="Settings & Profile">
      <div className="min-h-full p-5 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings &amp; Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your account settings and preferences</p>
        </div>

        {/* Profile hero */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-md flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{profile?.fullName || '—'}</h2>
            <p className="text-sm text-gray-500">{profile?.roleDesignation || profile?.systemRole?.roleName || 'Administrator'}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {profile?.officialEmail && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Mail className="w-3 h-3" /> {profile.officialEmail}
                </span>
              )}
              {profile?.employeeId && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Hash className="w-3 h-3" /> {profile.employeeId}
                </span>
              )}
              {profile?.department && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Building className="w-3 h-3" /> {profile.department}
                </span>
              )}
            </div>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            profile?.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {profile?.status || 'Active'}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Profile Tab ── */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h3 className="font-semibold text-gray-900">Personal Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1.5">Full Name *</label>
                <input type="text" className={inp} value={profileForm.fullName}
                  onChange={e => setProfileForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1.5">Official Email</label>
                <input type="email" className={inpDisabled} value={profile?.officialEmail || ''} disabled />
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1.5">Contact Number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm rounded-l-xl">+91</span>
                  <input type="tel" maxLength={10}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    value={profileForm.contactNumber}
                    onChange={e => setProfileForm(f => ({ ...f, contactNumber: e.target.value.replace(/\D/g, '') }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1.5">Employee ID</label>
                <input type="text" className={inpDisabled} value={profile?.employeeId || ''} disabled />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1.5">Department</label>
                <input type="text" className={inp} value={profileForm.department}
                  onChange={e => setProfileForm(f => ({ ...f, department: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1.5">Role / Designation</label>
                <input type="text" className={inp} value={profileForm.roleDesignation}
                  onChange={e => setProfileForm(f => ({ ...f, roleDesignation: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1.5">Date of Joining</label>
                <input type="date" className={inp} value={profileForm.dateOfJoining}
                  onChange={e => setProfileForm(f => ({ ...f, dateOfJoining: e.target.value }))} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <Button variant="outline" onClick={() => setProfileForm({ fullName: profile?.fullName || '', contactNumber: profile?.contactNumber || '', department: profile?.department || '', roleDesignation: profile?.roleDesignation || '', dateOfJoining: profile?.dateOfJoining ? profile.dateOfJoining.split('T')[0] : '' })}>
                Reset
              </Button>
              <Button onClick={handleProfileSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Security Tab ── */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">Change Password</h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1.5">New Password</label>
                <div className="relative">
                  <input type={showNew ? 'text' : 'password'} placeholder="Min 8 characters" className={inp}
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))} />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <input type={showConfirm ? 'text' : 'password'} placeholder="Repeat new password" className={inp}
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handlePasswordChange} disabled={changingPwd} className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2">
                  {changingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  {changingPwd ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Security Tips</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Use uppercase, lowercase, numbers, and symbols</li>
                  <li>• Never share your password with anyone</li>
                  <li>• Change your password every 90 days</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── Notifications Tab ── */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
            <h3 className="font-semibold text-gray-900 mb-4">Notification Preferences</h3>
            {[
              { key: 'emailNotifications', label: 'Email Notifications',  desc: 'Receive important updates via email' },
              { key: 'paymentAlerts',      label: 'Payment Alerts',       desc: 'Get notified about payment transactions' },
              { key: 'applicationUpdates', label: 'Application Updates',  desc: 'Receive updates on job applications' },
              { key: 'systemAlerts',       label: 'System Alerts',        desc: 'Critical system notifications' },
              { key: 'weeklyReport',       label: 'Weekly Report',        desc: 'Receive weekly summary reports' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={notifPrefs[item.key]}
                    onChange={e => setNotifPrefs(n => ({ ...n, [item.key]: e.target.checked }))} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600" />
                </label>
              </div>
            ))}
            <div className="flex justify-end pt-3 border-t border-gray-100">
              <Button onClick={() => toast.success('Preferences saved')} className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Preferences
              </Button>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  )
}

export default SettingsProfile





