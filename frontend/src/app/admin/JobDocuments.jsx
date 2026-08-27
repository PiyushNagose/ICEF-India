import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import JobStepProgress from './JobStepProgress'
import { getJobWizardPath } from '../../utils/jobDraft'
import { 
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  FileText,
} from 'lucide-react'

const JobDocuments = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const savedDraft = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('job_draft') || '{}')
    } catch {
      return {}
    }
  })()
  const projectId = searchParams.get('project') || savedDraft.projectId || null
  const jobId = searchParams.get('job') || savedDraft._jobId || ''
  const returnToReview = searchParams.get('returnTo') === 'review'
  
  const [documents, setDocuments] = useState(() => {
    const saved = savedDraft
    if (saved.documentRequirements?.length) {
      return saved.documentRequirements.map((doc, index) => ({
        id: index + 1,
        name: doc.name,
        required: doc.required,
        formats: doc.formats || [],
        maxSizeKB: doc.maxSizeKB || 5120,
        description: doc.description || '',
      }))
    }
    return [
    {
      id: 1,
      name: 'Resume/CV',
      required: true,
      formats: ['PDF', 'DOC', 'DOCX'],
      maxSizeKB: 5120,
      description: 'Upload your latest resume or curriculum vitae'
    },
    {
      id: 2,
      name: 'Educational Certificates',
      required: true,
      formats: ['PDF', 'JPG', 'PNG'],
      maxSizeKB: 10240,
      description: 'Upload all educational qualification certificates'
    },
    {
      id: 3,
      name: 'Experience Letters',
      required: false,
      formats: ['PDF', 'DOC', 'DOCX'],
      maxSizeKB: 5120,
      description: 'Upload experience/service letters from previous employers'
    },
    {
      id: 4,
      name: 'Identity Proof',
      required: true,
      formats: ['PDF', 'JPG', 'PNG'],
      maxSizeKB: 2048,
      description: 'Upload government issued identity proof (Aadhar, PAN, etc.)'
    }
    ]
  })

  const [newDocument, setNewDocument] = useState({
    name: '',
    required: false,
    formats: [],
    maxSizeKB: 5120,
    description: ''
  })

  const [showAddForm, setShowAddForm] = useState(false)

  const handleAddDocument = () => {
    if (newDocument.name.trim()) {
      setDocuments([...documents, {
        id: Date.now(),
        ...newDocument
      }])
      setNewDocument({
        name: '',
        required: false,
        formats: [],
        maxSizeKB: 5120,
        description: ''
      })
      setShowAddForm(false)
    }
  }

  const handleRemoveDocument = (id) => {
    setDocuments(documents.filter(doc => doc.id !== id))
  }

  const handleNext = () => {
    const existing = JSON.parse(sessionStorage.getItem('job_draft') || '{}')
    sessionStorage.setItem('job_draft', JSON.stringify({
      ...existing,
      documentRequirements: documents.map((doc) => ({
        name: doc.name,
        description: doc.description,
        required: doc.required,
        formats: doc.formats,
        maxSizeKB: doc.maxSizeKB ? Math.max(1, Math.round(Number(doc.maxSizeKB))) : undefined,
      })),
    }))
    navigate(returnToReview
      ? getJobWizardPath('review', projectId, jobId)
      : getJobWizardPath('payment', projectId, jobId))
  }

  const handleBack = () => {
    navigate(getJobWizardPath('form-builder', projectId, jobId, { returnToReview }))
  }

  return (
    <AdminLayout title="Create Job - Documents">
      <div className="p-4 sm:p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create Job Posting</h1>
              <p className="text-gray-500 text-sm mt-0.5">Step 4 of 6: Required Documents</p>
            </div>
          </div>

          {/* Progress Steps */}
          <JobStepProgress currentStep={4} projectId={projectId} clickable />

          {/* Document Requirements */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">Document Requirements</h3>
                </div>
                <Button
                  onClick={() => setShowAddForm(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Document
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Document Form */}
              {showAddForm && (
                <div className="p-5 border-2 border-dashed border-orange-300 rounded-lg bg-orange-50 space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">New Document</h4>
                    <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Document Name *
                    </label>
                    <input
                      type="text"
                      value={newDocument.name}
                      onChange={(e) => setNewDocument({...newDocument, name: e.target.value})}
                      className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g. Caste Certificate"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={newDocument.description}
                      onChange={(e) => setNewDocument({...newDocument, description: e.target.value})}
                      rows={2}
                      className="w-full min-h-[76px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Describe what this document should contain..."
                    />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.9fr_0.9fr] gap-5 items-start">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Allowed Formats
                      </label>
                      <div className="flex min-h-12 flex-wrap items-center gap-2">
                        {['PDF', 'DOC', 'DOCX', 'JPG', 'PNG'].map(fmt => (
                          <label key={fmt} className="flex h-12 items-center space-x-2 bg-white px-3.5 rounded-lg border border-gray-200 cursor-pointer hover:bg-orange-50 hover:border-orange-200 transition-colors">
                            <input
                              type="checkbox"
                              checked={newDocument.formats?.includes(fmt) || false}
                              onChange={(e) => {
                                const newFormats = e.target.checked
                                  ? [...(newDocument.formats || []), fmt]
                                  : (newDocument.formats || []).filter(f => f !== fmt)
                                setNewDocument({ ...newDocument, formats: newFormats })
                              }}
                              className="rounded text-orange-600 focus:ring-orange-500"
                            />
                            <span className="text-sm font-medium text-gray-700">{fmt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max File Size (KB)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={newDocument.maxSizeKB}
                        onChange={(e) => setNewDocument({
                          ...newDocument,
                          maxSizeKB: e.target.value,
                        })}
                        className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="e.g. 5120"
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter size in KB only, e.g. 5120</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-transparent mb-2 select-none">
                        Required
                      </label>
                      <label className="flex h-12 items-center space-x-2 rounded-lg border border-gray-200 bg-white px-4 cursor-pointer hover:border-orange-200 hover:bg-orange-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={newDocument.required}
                          onChange={(e) => setNewDocument({...newDocument, required: e.target.checked})}
                          className="w-4 h-4 text-orange-600 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">Required document</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 border-t border-orange-100 pt-4">
                    <Button variant="outline" onClick={() => setShowAddForm(false)} className="h-11 px-6">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddDocument}
                      className="h-11 bg-orange-600 hover:bg-orange-700 text-white px-6"
                      disabled={!newDocument.name.trim() || !Number(newDocument.maxSizeKB)}
                    >
                      Add Document
                    </Button>
                  </div>
                </div>
              )}

              {/* Documents List */}
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:border-orange-200 hover:bg-orange-50/30 transition-colors">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-gray-900">{doc.name}</h4>
                        <Badge className={doc.required ? 'bg-red-100 text-red-800 text-xs' : 'bg-gray-100 text-gray-600 text-xs'}>
                          {doc.required ? 'Required' : 'Optional'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{doc.description}</p>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                        <span>Formats: <span className="text-gray-600 font-medium">{doc.formats.join(', ')}</span></span>
                        <span>Max: <span className="text-gray-600 font-medium">{doc.maxSizeKB} KB</span></span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <Button 
              onClick={handleBack}
              variant="outline" 
              className="px-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back: Form Builder
            </Button>
            <Button 
              onClick={handleNext}
              className="bg-orange-600 hover:bg-orange-700 text-white px-8"
            >
              {returnToReview ? 'Save & Return to Review' : 'Next: Payment'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default JobDocuments





