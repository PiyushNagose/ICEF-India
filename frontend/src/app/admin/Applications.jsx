import { useState } from 'react'
import Papa from "papaparse";
import { saveAs } from "file-saver";
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  FileText, Eye, CheckCircle, X, Search, Download,
  ChevronLeft, ChevronRight, Loader2, Users, Clock,
  TrendingUp, AlertCircle, Filter, MoreHorizontal,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { adminService } from '../../services/admin.service'

const STATUS_CONFIG = {
  draft:        { label: 'Draft',        bg: 'bg-gray-100',   text: 'text-gray-700',   dot: 'bg-gray-400'   },
  submitted:    { label: 'Submitted',    bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500'   },
  under_review: { label: 'Under Review', bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-500'  },
  verified:     { label: 'Verified',     bg: 'bg-emerald-100',text: 'text-emerald-800',dot: 'bg-emerald-500'},
  approved:     { label: 'Approved',     bg: 'bg-emerald-100',text: 'text-emerald-800',dot: 'bg-emerald-500'},
  rejected:     { label: 'Rejected',     bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500'    },
}

const PAYMENT_CONFIG = {
  paid:      { label: 'Paid',      bg: 'bg-emerald-100', text: 'text-emerald-800' },
  success:   { label: 'Paid',      bg: 'bg-emerald-100', text: 'text-emerald-800' },
  pending:   { label: 'Pending',   bg: 'bg-amber-100',   text: 'text-amber-800'   },
  failed:    { label: 'Failed',    bg: 'bg-red-100',     text: 'text-red-800'     },
  initiated: { label: 'Initiated', bg: 'bg-blue-100',    text: 'text-blue-800'    },
  unpaid:    { label: 'Unpaid',    bg: 'bg-gray-100',    text: 'text-gray-600'    },
}

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

const PaymentBadge = ({ status }) => {
  const cfg = PAYMENT_CONFIG[status] || PAYMENT_CONFIG.unpaid
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

const CandidateAvatar = ({ name }) => {
  const initials = name
    ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  const colors = [
    'bg-orange-500', 'bg-blue-500', 'bg-purple-500',
    'bg-teal-500', 'bg-rose-500', 'bg-indigo-500',
  ]
  const color = colors[(initials.charCodeAt(0) || 0) % colors.length]
  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {initials}
    </div>
  )
}

const Applications = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [bulkAction, setBulkAction] = useState('')
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)

  const status = activeTab === 'all' ? undefined : activeTab

  const { data, isLoading } = useQuery({
    queryKey: ['admin-applications', status, search, page],
    queryFn: () => adminService.getApplications({
      status,
      limit: 10,
      page,
      ...(search && { search }),
    }),
  })

  const { data: statsData } = useQuery({
    queryKey: ['admin-application-stats'],
    queryFn: adminService.getApplicationStats,
  })

  const { mutate: updateStatus, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, status, rejectionReason }) =>
      adminService.updateApplicationStatus(id, { status, rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-applications'] })
      queryClient.invalidateQueries({ queryKey: ['admin-application-stats'] })
      toast.success('Application status updated')
    },
    onError: (err) => toast.error(err.message || 'Failed to update'),
  })

  const applications = data?.applications || []
  const pagination = data?.pagination || {}
  const totalPages = pagination.totalPages || 1
  const totalItems = pagination.totalItems || applications.length

  const statusStats = statsData?.statusStats || []
  const countByStatus = (key) => statusStats.find((item) => item._id === key)?.count || 0
  const total = totalItems || statsData?.totalApplications || applications.length

  const stats = [
    {
      title: 'Total Applications',
      value: total,
      icon: FileText,
      gradient: 'from-orange-500 to-orange-600',
      bg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      change: null,
    },
    {
      title: 'Under Review',
      value: countByStatus('under_review'),
      icon: Clock,
      gradient: 'from-amber-500 to-amber-600',
      bg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      change: null,
    },
    {
      title: 'Verified',
      value: countByStatus('verified') + countByStatus('approved'),
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      change: null,
    },
    {
      title: 'Rejected',
      value: countByStatus('rejected'),
      icon: X,
      gradient: 'from-red-500 to-red-600',
      bg: 'bg-red-50',
      iconColor: 'text-red-600',
      change: null,
    },
  ]

  const tabs = [
    { id: 'all',          label: 'All',          count: total },
    { id: 'submitted',    label: 'Submitted',    count: countByStatus('submitted') },
    { id: 'under_review', label: 'Under Review', count: countByStatus('under_review') },
    { id: 'verified',     label: 'Verified',     count: countByStatus('verified') },
    { id: 'rejected',     label: 'Rejected',     count: countByStatus('rejected') },
  ]

  const allSelected = applications.length > 0 && selected.length === applications.length
  const toggleAll = () => setSelected(allSelected ? [] : applications.map(a => a._id))
  const toggleOne = (id) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  )

  const handleBulkApply = async () => {
    if (!bulkAction || selected.length === 0) return
    const newStatus = bulkAction === 'approve' ? 'approved' : 'rejected'
    let done = 0
    for (const id of selected) {
      await new Promise(resolve => {
        updateStatus({ id, status: newStatus, rejectionReason: '' }, { onSettled: resolve })
      })
      done++
    }
    toast.success(`${done} application(s) ${newStatus}`)
    setSelected([])
    setBulkAction('')
    setShowBulkConfirm(false)
  }

  const handleExport = async () => {
  try {
    toast.loading("Preparing export...", {
      id: "export",
    });

    // STEP 1: get all applications
    const allAppsResponse =
      await adminService.getApplications({
        limit: 999999,
      });

    const allApplications =
      allAppsResponse?.applications || [];

    // STEP 2: fetch full details one by one
    const detailedApplications =
      await Promise.all(
        allApplications.map(async (app) => {
          try {
            const res =
              await adminService.getApplication(
                app._id
              );

            return res?.application || res;
          } catch (err) {
            console.error(
              "Failed app",
              app._id
            );

            return null;
          }
        })
      );

    // remove failed
    const validApps =
      detailedApplications.filter(Boolean);

    // STEP 3: flatten data
    const exportData = validApps.map(
      (app) => ({
        "Application ID":
          app.applicationId || "",

        "Candidate Name":
          app.personalDetails?.fullName ||
          app.candidateId?.fullName ||
          "",

        Email:
          app.candidateId?.email || "",

        Mobile:
          app.personalDetails
            ?.registeredMobile || "",

        Gender:
          app.personalDetails?.gender || "",

        Category:
          app.personalDetails?.category || "",

        DOB:
          app.personalDetails?.dateOfBirth
            ? new Date(
                app.personalDetails.dateOfBirth
              ).toLocaleDateString("en-IN")
            : "",

        Religion:
          app.personalDetails?.religion || "",

        "10th Percentage":
          app.education?.tenth
            ?.percentage || "",

        "12th Percentage":
          app.education?.twelfth
            ?.percentage || "",

        Graduation:
          app.education?.graduation
            ?.degree || "",

        Department:
          app.jobId?.department || "",

        "Job Title":
          app.jobId?.title || "",

        Status: app.status || "",

        "Payment Status":
          app.paymentStatus || "",

        Fee: app.totalFee || "",

        TransactionID:
          app.transactionId || "",

        State:
          app.address?.permanent?.state ||
          "",

        District:
          app.address?.permanent
            ?.district || "",

        Pincode:
          app.address?.permanent
            ?.pincode || "",

        SubmittedAt:
          app.submittedAt
            ? new Date(
                app.submittedAt
              ).toLocaleDateString("en-IN")
            : "",
      })
    );

    // STEP 4: convert to CSV
    const csv =
      Papa.unparse(exportData);

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    saveAs(
      blob,
      `applications-${Date.now()}.csv`
    );

    toast.success(
      "CSV downloaded successfully",
      {
        id: "export",
      }
    );
  } catch (error) {
    console.error(error);

    toast.error(
      "Failed to export applications",
      {
        id: "export",
      }
    );
  }
};

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setPage(1)
    setSelected([])
  }

  const handleSearch = (val) => {
    setSearch(val)
    setPage(1)
    setSelected([])
  }

  // Helper: get candidate name from aggregation result (backend returns "candidate" not "candidateId")
  const getCandidateName = (app) =>
    app.personalDetails?.fullName ||
    app.candidate?.fullName ||
    app.candidateId?.fullName ||
    null

  const getCandidateEmail = (app) =>
    app.candidate?.email || app.candidateId?.email || app.personalDetails?.email || null

  const getCandidateMobile = (app) =>
    app.personalDetails?.registeredMobile ||
    app.candidate?.registeredMobile ||
    app.candidateId?.registeredMobile ||
    null

  const getJobTitle = (app) =>
    app.job?.title || app.jobId?.title || null

  const getJobDept = (app) =>
    app.job?.department || app.jobId?.department || null

  return (
    <AdminLayout title="Applications">
      <div className="p-6 space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Review and manage all candidate applications
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            className="flex items-center gap-2 border-gray-300 hover:border-orange-400 hover:text-orange-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.title}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-2">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      {Number(stat.value || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Main Card ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Tabs */}
          <div className="border-b border-gray-200 px-6">
            <nav className="-mb-px flex space-x-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`py-4 px-3 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                    activeTab === tab.id
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Search + Bulk Actions Bar */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap bg-gray-50/50">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or application ID..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm bg-white"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            {selected.length > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                <span className="text-sm font-semibold text-orange-800">
                  {selected.length} selected
                </span>
                <select
                  className="admin-select text-sm !py-1.5 !px-2 !rounded-md border-orange-300"
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                >
                  <option value="">Bulk Action</option>
                  <option value="approve">Approve All</option>
                  <option value="reject">Reject All</option>
                </select>
                <Button
                  size="sm"
                  disabled={!bulkAction || isUpdating}
                  onClick={() => setShowBulkConfirm(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3"
                >
                  {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                </Button>
                <button
                  onClick={() => setSelected([])}
                  className="text-gray-400 hover:text-gray-600 ml-1 p-0.5 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="admin-data-scroll hover-scroll overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 text-orange-600 rounded border-gray-300 cursor-pointer"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Candidate
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Application ID
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Job Applied
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Payment
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Submitted
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td colSpan="8" className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                        <span className="text-sm">Loading applications...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading && applications.length === 0 && (
                  <tr>
                    <td colSpan="8" className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                          <FileText className="w-7 h-7 text-gray-300" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">No applications found</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {search ? 'Try adjusting your search query' : 'Applications will appear here once submitted'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {applications.map((app) => {
                  const candidateName = getCandidateName(app)
                  const candidateEmail = getCandidateEmail(app)
                  const candidateMobile = getCandidateMobile(app)
                  const jobTitle = getJobTitle(app)
                  const jobDept = getJobDept(app)
                  const isSelected = selected.includes(app._id)

                  return (
                    <tr
                      key={app._id}
                      className={`group transition-colors ${
                        isSelected
                          ? 'bg-orange-50/70'
                          : 'hover:bg-gray-50/80'
                      }`}
                    >
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(app._id)}
                          className="w-4 h-4 text-orange-600 rounded border-gray-300 cursor-pointer"
                        />
                      </td>

                      {/* Candidate */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <CandidateAvatar name={candidateName} />
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">
                              {candidateName || (
                                <span className="text-gray-400 italic font-normal">Not provided</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {candidateEmail || '—'}
                            </p>
                            {candidateMobile && (
                              <p className="text-xs text-gray-400 truncate">
                                {candidateMobile}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Application ID */}
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                          {app.applicationId}
                        </span>
                      </td>

                      {/* Job */}
                      <td className="py-4 px-4">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate max-w-[180px]">
                            {jobTitle || (
                              <span className="text-gray-400 italic font-normal">Not assigned</span>
                            )}
                          </p>
                          {jobDept && (
                            <p className="text-xs text-gray-500 truncate">{jobDept}</p>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <StatusBadge status={app.status} />
                      </td>

                      {/* Payment */}
                      <td className="py-4 px-4">
                        <PaymentBadge status={app.paymentStatus || 'unpaid'} />
                      </td>

                      {/* Submitted */}
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-700">
                          {app.submittedAt
                            ? new Date(app.submittedAt).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              })
                            : <span className="text-gray-400">—</span>
                          }
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/admin/applications/${app._id}`)}
                            className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {['submitted', 'under_review'].includes(app.status) && (
                            <>
                              <button
                                onClick={() => updateStatus({ id: app._id, status: 'approved', rejectionReason: '' })}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Approve"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => updateStatus({ id: app._id, status: 'rejected', rejectionReason: '' })}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLoading && applications.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50">
              <p className="text-sm text-gray-500">
                Showing{' '}
                <span className="font-medium text-gray-700">{applications.length}</span>
                {' '}of{' '}
                <span className="font-medium text-gray-700">
                  {Number(total).toLocaleString('en-IN')}
                </span>{' '}
                applications
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="border-gray-300">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {(() => {
                  const pages = []
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i)
                  } else {
                    pages.push(1)
                    if (page > 3) pages.push('...')
                    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
                    if (page < totalPages - 2) pages.push('...')
                    pages.push(totalPages)
                  }
                  return pages.map((p, i) =>
                    p === '...'
                      ? <span key={`d${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
                      : <button key={p} onClick={() => setPage(p)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-orange-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {p}
                        </button>
                  )
                })()}
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="border-gray-300">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk Confirm Modal ── */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  bulkAction === 'approve' ? 'bg-emerald-100' : 'bg-red-100'
                }`}>
                  {bulkAction === 'approve'
                    ? <CheckCircle className="w-5 h-5 text-emerald-600" />
                    : <AlertCircle className="w-5 h-5 text-red-600" />
                  }
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Confirm Bulk Action</h3>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 text-sm">
                You are about to{' '}
                <strong className={bulkAction === 'approve' ? 'text-emerald-700' : 'text-red-700'}>
                  {bulkAction}
                </strong>{' '}
                <strong>{selected.length}</strong> application(s). This action cannot be undone.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowBulkConfirm(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleBulkApply}
                disabled={isUpdating}
                className={
                  bulkAction === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }
              >
                {isUpdating
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                  : `Confirm ${bulkAction === 'approve' ? 'Approval' : 'Rejection'}`
                }
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default Applications





