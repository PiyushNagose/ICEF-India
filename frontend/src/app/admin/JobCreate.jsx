import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminLayout from '../../components/layouts/AdminLayout'
import {
  JOB_DRAFT_STORAGE_KEY,
  getJobDraftResumePath,
  getJobWizardPath,
  readJobDraft,
} from '../../utils/jobDraft'

const JobCreate = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  useEffect(() => {
    const projectId = searchParams.get('project')
    const jobId = searchParams.get('job')
    const mode = searchParams.get('mode')
    const draft = readJobDraft()

    if (mode === 'new') {
      sessionStorage.removeItem(JOB_DRAFT_STORAGE_KEY)
      sessionStorage.setItem(
        JOB_DRAFT_STORAGE_KEY,
        JSON.stringify({ projectId }),
      )
      navigate(getJobWizardPath('basic-info', projectId, ''), { replace: true })
      return
    }

    if (draft?.projectId && (draft._jobId || draft.title || draft.postCode || draft.department)) {
      navigate(getJobDraftResumePath(draft, { jobId: jobId || draft._jobId }), { replace: true })
      return
    }
    navigate(getJobWizardPath('basic-info', projectId, jobId), { replace: true })
  }, [navigate, searchParams])

  return (
    <AdminLayout title="Create Job">
      <div className="min-h-full flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Redirecting to job creation...</span>
        </div>
      </div>
    </AdminLayout>
  )
}

export default JobCreate




