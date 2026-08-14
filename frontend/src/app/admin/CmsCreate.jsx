import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  MapPin, Briefcase, Bell, Image,
  Link2, Plus, X, ArrowLeft, Loader2, CheckCircle2,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { adminService } from '../../services/admin.service'
import CustomSelect from '../../components/ui/CustomSelect'
import BannerImageUpload from '../../components/ui/BannerImageUpload'

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
  'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
  'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
  'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal',
]

const Section = ({ icon: Icon, title, children, action }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
          <Icon className="w-4 h-4 text-orange-600" />
        </div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      {action}
    </div>
    <div className="px-6 py-5">{children}</div>
  </div>
)

const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent'
const Label = ({ children, required }) => (
  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
    {children}{required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
)

const CmsCreate = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    state: '',
    heroTitle: '',
    heroSubtitle: '',
    bannerImage: '',
    featuredJobs: [],
    announcements: [],
    quickLinks: {
      applyNow: true, latestNotifications: true,
      admitCards: true, results: true, support: true,
    },
    status: 'draft',
  })
  const [announcementText, setAnnouncementText] = useState('')
  const [jobSearch, setJobSearch] = useState('')

  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }))
  const setQL = (key, val) => setForm((p) => ({ ...p, quickLinks: { ...p.quickLinks, [key]: val } }))

  // Fetch admin jobs for featured job search
  const { data: jobsData } = useQuery({
    queryKey: ['admin-jobs-cms'],
    queryFn: () => adminService.getAdminJobs({ limit: 200, status: 'active' }),
  })
  const allJobs = jobsData?.jobs || []
  const filteredJobs = jobSearch.trim()
    ? allJobs.filter((j) =>
        (j.title || '').toLowerCase().includes(jobSearch.toLowerCase()) ||
        (j.postCode || '').toLowerCase().includes(jobSearch.toLowerCase())
      )
    : allJobs.slice(0, 6)

  const addJob = (job) => {
    if (!form.featuredJobs.find((j) => j._id === job._id)) {
      set('featuredJobs', [...form.featuredJobs, job])
    }
    setJobSearch('')
  }
  const removeJob = (id) => set('featuredJobs', form.featuredJobs.filter((j) => j._id !== id))

  const addAnnouncement = () => {
    if (!announcementText.trim()) return
    set('announcements', [...form.announcements, { text: announcementText.trim(), priority: 'medium' }])
    setAnnouncementText('')
  }
  const removeAnnouncement = (i) => set('announcements', form.announcements.filter((_, idx) => idx !== i))

  const PRIORITY_COLORS = { low: 'text-emerald-600', medium: 'text-amber-600', high: 'text-red-600' }

  const { mutate: createPage, isPending } = useMutation({
    mutationFn: (data) => adminService.createCmsPage(data),
    onSuccess: () => {
      toast.success('State page created successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-cms-pages'] })
      navigate('/admin/cms')
    },
    onError: (err) => toast.error(err.message || 'Failed to create page'),
  })

  const { mutate: createAndPublish, isPending: isPublishing } = useMutation({
    mutationFn: async (data) => {
      const res = await adminService.createCmsPage({ ...data, status: 'draft' })
      const state = res?.page?.state || data.state
      await adminService.publishCmsPage(state)
      return res
    },
    onSuccess: () => {
      toast.success('State page published')
      queryClient.invalidateQueries({ queryKey: ['admin-cms-pages'] })
      navigate('/admin/cms')
    },
    onError: (err) => toast.error(err.message || 'Failed to publish'),
  })

  const buildPayload = () => ({
    state: form.state,
    heroTitle: form.heroTitle,
    heroSubtitle: form.heroSubtitle,
    bannerImage: form.bannerImage,
    featuredJobs: form.featuredJobs.map((j) => j._id),
    announcements: form.announcements,
    quickLinks: form.quickLinks,
  })

  const handleSaveDraft = () => {
    if (!form.state) { toast.error('Please select a state'); return }
    createPage({ ...buildPayload(), status: 'draft' })
  }

  const handlePublish = () => {
    if (!form.state) { toast.error('Please select a state'); return }
    createAndPublish(buildPayload())
  }

  const liveSummary = [
    { label: 'State',            value: form.state || '—' },
    { label: 'Banner Image',     value: form.bannerImage ? '✅ Uploaded' : '—' },
    { label: 'Featured Projects',value: form.featuredJobs.length },
    { label: 'Status',           value: 'Draft' },
    { label: 'Last Edited',      value: 'Just now' },
  ]

  return (
    <AdminLayout title="CMS — Create State Page">
      <div className="p-6">
        <div className="w-full">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/admin/cms')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create State Landing Page</h1>
              <p className="text-sm text-gray-500 mt-0.5">Configure a new local-level landing page for state-specific recruitment drives.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 items-stretch lg:grid-cols-3 gap-6">

            {/* ── LEFT — Form ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* State Info */}
              <Section icon={MapPin} title="State Information">
                <Label required>Select State</Label>
                <CustomSelect
                  value={form.state}
                  onChange={(val) => set('state', val)}
                  options={INDIAN_STATES}
                  placeholder="Choose a state..."
                />
              </Section>

              {/* Hero */}
              <Section icon={Image} title="Hero Configuration">
                <div className="space-y-4">
                  <div>
                    <Label>Hero Title</Label>
                    <input
                      type="text"
                      placeholder="e.g., Government Jobs in Telangana"
                      value={form.heroTitle}
                      onChange={(e) => set('heroTitle', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <Label>Hero Subtitle</Label>
                    <textarea
                      rows={3}
                      placeholder="Enter a brief description to be displayed under the main title..."
                      value={form.heroSubtitle}
                      onChange={(e) => set('heroSubtitle', e.target.value)}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                  <div>
                    <Label>Banner Image</Label>
                    <BannerImageUpload
                      value={form.bannerImage}
                      onChange={(url) => set('bannerImage', url)}
                    />
                  </div>
                </div>
              </Section>

              {/* Featured Recruitments */}
              <Section icon={Briefcase} title="Featured Recruitments">
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search and select projects..."
                      value={jobSearch}
                      onChange={(e) => setJobSearch(e.target.value)}
                      className={inputCls}
                    />
                    {jobSearch && (
                      <div className="hover-scroll absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                        {filteredJobs.length === 0 && (
                          <p className="px-4 py-3 text-sm text-gray-400">No jobs found</p>
                        )}
                        {filteredJobs.map((j) => (
                          <button
                            key={j._id}
                            type="button"
                            onMouseDown={() => addJob(j)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 text-left transition-colors"
                          >
                            <Briefcase className="w-4 h-4 text-orange-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{j.title}</p>
                              <p className="text-xs text-gray-400">{j.postCode} · {j.department}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {form.featuredJobs.length > 0 && (
                    <div className="space-y-2">
                      {form.featuredJobs.map((job) => (
                        <div key={job._id} className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Briefcase className="w-4 h-4 text-orange-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{job.title}</p>
                              <p className="text-xs text-gray-400">{job.postCode}</p>
                            </div>
                          </div>
                          <button onClick={() => removeJob(job._id)} className="text-gray-400 hover:text-red-500 transition-colors ml-2">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>

              {/* Announcements */}
              <Section
                icon={Bell}
                title="Announcements"
                action={
                  <button
                    type="button"
                    onClick={addAnnouncement}
                    disabled={!announcementText.trim()}
                    className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" /> Add Notice
                  </button>
                }
              >
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Type announcement text and click Add Notice..."
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAnnouncement() } }}
                    className={inputCls}
                  />
                  {form.announcements.length > 0 && (
                    <div className="space-y-2">
                      {form.announcements.map((a, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2 h-2 rounded-full ${a.priority === 'high' ? 'bg-red-500' : a.priority === 'low' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <p className="text-sm text-gray-900">{a.text}</p>
                          </div>
                          <button onClick={() => removeAnnouncement(i)} className="text-gray-400 hover:text-red-500 transition-colors ml-2">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {form.announcements.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">No announcements added yet</p>
                  )}
                </div>
              </Section>

              {/* Quick Links */}
              <Section icon={Link2} title="Quick Links">
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(form.quickLinks).map(([key, val]) => {
                    const labels = {
                      applyNow: 'Apply Now', latestNotifications: 'Latest Notifications',
                      admitCards: 'Admit Cards', results: 'Results', support: 'Support',
                    }
                    return (
                      <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-orange-200 hover:bg-orange-50/30">
                        <span className="min-w-0 text-sm font-medium text-gray-900">{labels[key]}</span>
                        <button
                          type="button"
                          aria-pressed={val}
                          aria-label={`${val ? 'Disable' : 'Enable'} ${labels[key]}`}
                          onClick={() => setQL(key, !val)}
                          className={`relative h-5 w-10 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/25 focus:ring-offset-2 ${val ? 'bg-orange-500' : 'bg-gray-200'}`}
                        >
                          <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${val ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </Section>

            </div>

            {/* ── RIGHT — Sidebar ── */}
            <div className="space-y-4">

              {/* Live Page Summary */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-normal">Live Page Summary</h3>
                </div>
                <div className="space-y-2.5">
                  {liveSummary.map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{label}</span>
                      <span className={`font-semibold ${value === '—' ? 'text-gray-300' : 'text-gray-900'}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
                <button
                  onClick={handlePublish}
                  disabled={isPublishing || isPending}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isPublishing ? 'Publishing...' : 'Publish Page'}
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={isPending || isPublishing}
                  className="w-full py-2.5 border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save as Draft
                </button>
                <button
                  onClick={() => navigate('/admin/cms')}
                  className="w-full py-2.5 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>

              {/* Pro Tip */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 text-sm mt-0.5">💡</span>
                  <div>
                    <p className="text-xs font-bold text-blue-800 mb-1">Pro Tip</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Regularly updating the announcements section improves engagement rates by
                      up to 40% on state landing pages.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom actions bar */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
              All changes saved
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/admin/cms')} className="px-5 py-2.5 border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold rounded-xl text-sm transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={isPending || isPublishing}
                className="px-5 py-2.5 border border-orange-200 text-orange-600 hover:bg-orange-50 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                onClick={handlePublish}
                disabled={isPending || isPublishing}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {isPublishing && <Loader2 className="w-4 h-4 animate-spin" />}
                Publish Changes
              </button>
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  )
}

export default CmsCreate





