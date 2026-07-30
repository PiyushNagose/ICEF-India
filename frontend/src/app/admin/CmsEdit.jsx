import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Briefcase, Bell, Link2, Image,
  Plus, X, ArrowLeft, Loader2, CheckCircle2,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { adminService } from '../../services/admin.service'
import BannerImageUpload from '../../components/ui/BannerImageUpload'

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
const Label = ({ children }) => (
  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{children}</label>
)

const CmsEdit = () => {
  const { state: stateParam } = useParams()
  const stateName = decodeURIComponent(stateParam)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [form, setForm] = useState(null)
  const [announcementText, setAnnouncementText] = useState('')
  const [jobSearch, setJobSearch] = useState('')

  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ['admin-cms-page', stateName],
    queryFn: () => adminService.getCmsPage(stateName),
  })

  const { data: jobsData } = useQuery({
    queryKey: ['admin-jobs-cms'],
    queryFn: () => adminService.getAdminJobs({ limit: 200, status: 'active' }),
  })
  const allJobs = jobsData?.jobs || []

  // Populate form once data loaded
  useEffect(() => {
    if (!pageData?.page) return
    const p = pageData.page
    setForm({
      heroTitle:     p.heroTitle     || '',
      heroSubtitle:  p.heroSubtitle  || '',
      bannerImage:   p.bannerImage   || '',
      featuredJobs:  p.featuredJobs  || [],
      announcements: p.announcements || [],
      quickLinks: p.quickLinks || {
        applyNow: true, latestNotifications: true,
        admitCards: true, results: true, support: true,
      },
      status: p.status || 'draft',
    })
  }, [pageData])

  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }))
  const setQL = (key, val) => setForm((p) => ({ ...p, quickLinks: { ...p.quickLinks, [key]: val } }))

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

  const buildPayload = () => ({
    heroTitle:     form.heroTitle,
    heroSubtitle:  form.heroSubtitle,
    bannerImage:   form.bannerImage,
    featuredJobs:  form.featuredJobs.map((j) => j._id || j),
    announcements: form.announcements,
    quickLinks:    form.quickLinks,
  })

  const { mutate: saveUpdate, isPending: isSaving } = useMutation({
    mutationFn: (data) => adminService.updateCmsPage(stateName, data),
    onSuccess: () => {
      toast.success('Page saved as draft')
      queryClient.invalidateQueries({ queryKey: ['admin-cms-pages'] })
      queryClient.invalidateQueries({ queryKey: ['admin-cms-page', stateName] })
    },
    onError: (err) => toast.error(err.message || 'Failed to save'),
  })

  const { mutate: saveAndPublish, isPending: isPublishing } = useMutation({
    mutationFn: async (data) => {
      await adminService.updateCmsPage(stateName, data)
      await adminService.publishCmsPage(stateName)
    },
    onSuccess: () => {
      toast.success('Page published')
      queryClient.invalidateQueries({ queryKey: ['admin-cms-pages'] })
      queryClient.invalidateQueries({ queryKey: ['admin-cms-page', stateName] })
      navigate('/admin/cms')
    },
    onError: (err) => toast.error(err.message || 'Failed to publish'),
  })

  if (pageLoading || !form) {
    return (
      <AdminLayout title="CMS — Edit State Page">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </AdminLayout>
    )
  }

  const page = pageData?.page
  const liveSummary = [
    { label: 'State',             value: stateName },
    { label: 'Banner Image',      value: form.bannerImage ? '✅ Uploaded' : '—' },
    { label: 'Featured Projects', value: form.featuredJobs.length },
    { label: 'Status',            value: (page?.status || 'draft').charAt(0).toUpperCase() + (page?.status || 'draft').slice(1) },
    { label: 'Last Edited',       value: page?.updatedAt ? new Date(page.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—' },
  ]

  return (
    <AdminLayout title={`CMS — Edit ${stateName}`}>
      <div className="p-6">
        <div className="w-full">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/admin/cms')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit State Landing Page</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage public portal content for {stateName}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 items-stretch lg:grid-cols-3 gap-6">

            {/* ── LEFT ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Hero */}
              <Section icon={Image} title="Hero Configuration">
                <div className="space-y-4">
                  <div>
                    <Label>Hero Title</Label>
                    <input type="text" placeholder="e.g., Government Jobs in Telangana" value={form.heroTitle} onChange={(e) => set('heroTitle', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <Label>Hero Subtitle</Label>
                    <textarea rows={3} placeholder="Enter a brief description..." value={form.heroSubtitle} onChange={(e) => set('heroSubtitle', e.target.value)} className={`${inputCls} resize-none`} />
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
                    <input type="text" placeholder="Search and select projects..." value={jobSearch} onChange={(e) => setJobSearch(e.target.value)} className={inputCls} />
                    {jobSearch && (
                      <div className="hover-scroll absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                        {filteredJobs.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">No jobs found</p>}
                        {filteredJobs.map((j) => (
                          <button key={j._id} type="button" onMouseDown={() => addJob(j)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 text-left transition-colors">
                            <Briefcase className="w-4 h-4 text-orange-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{j.title}</p>
                              <p className="text-xs text-gray-400">{j.postCode}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {form.featuredJobs.length > 0 && (
                    <div className="space-y-2">
                      {form.featuredJobs.map((job) => (
                        <div key={job._id || job} className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Briefcase className="w-4 h-4 text-orange-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{job.title || 'Job'}</p>
                              <p className="text-xs text-gray-400">{job.postCode || ''}</p>
                            </div>
                          </div>
                          <button onClick={() => removeJob(job._id || job)} className="text-gray-400 hover:text-red-500 ml-2"><X className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>

              {/* Announcements */}
              <Section icon={Bell} title="Announcements" action={
                <button type="button" onClick={addAnnouncement} disabled={!announcementText.trim()} className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-40">
                  <Plus className="w-4 h-4" /> Add Notice
                </button>
              }>
                <div className="space-y-3">
                  <input type="text" placeholder="Type announcement and press Enter or click Add Notice..." value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAnnouncement() } }} className={inputCls} />
                  {form.announcements.map((a, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${a.priority === 'high' ? 'bg-red-500' : a.priority === 'low' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <p className="text-sm text-gray-900">{a.text}</p>
                      </div>
                      <button onClick={() => removeAnnouncement(i)} className="text-gray-400 hover:text-red-500 ml-2"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Quick Links */}
              <Section icon={Link2} title="Quick Links">
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(form.quickLinks).map(([key, val]) => {
                    const labels = { applyNow: 'Apply Now', latestNotifications: 'Latest Notifications', admitCards: 'Admit Cards', results: 'Results', support: 'Support' }
                    return (
                      <div key={key} className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-xl">
                        <span className="text-sm text-gray-700">{labels[key]}</span>
                        <button type="button" onClick={() => setQL(key, !val)} className={`w-10 h-5 rounded-full transition-colors ${val ? 'bg-orange-500' : 'bg-gray-200'} relative`}>
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </Section>
            </div>

            {/* ── RIGHT ── */}
            <div className="space-y-4">
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

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
                <button onClick={() => saveAndPublish(buildPayload())} disabled={isPublishing || isSaving} className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                  {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isPublishing ? 'Publishing...' : 'Publish Page'}
                </button>
                <button onClick={() => saveUpdate({ ...buildPayload(), status: 'draft' })} disabled={isSaving || isPublishing} className="w-full py-2.5 border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save as Draft
                </button>
                <button onClick={() => navigate('/admin/cms')} className="w-full py-2.5 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors flex items-center justify-center gap-1.5">
                  Preview Live
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 text-sm mt-0.5">💡</span>
                  <div>
                    <p className="text-xs font-bold text-blue-800 mb-1">Pro Tip</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Regularly updating the announcements section improves engagement rates by up to 40% on state landing pages.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
              All changes saved
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/admin/cms')} className="px-5 py-2.5 border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold rounded-xl text-sm transition-colors">Cancel</button>
              <button onClick={() => saveUpdate({ ...buildPayload(), status: 'draft' })} disabled={isSaving || isPublishing} className="px-5 py-2.5 border border-orange-200 text-orange-600 hover:bg-orange-50 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50">Save Draft</button>
              <button onClick={() => saveAndPublish(buildPayload())} disabled={isSaving || isPublishing} className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center gap-2">
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

export default CmsEdit





