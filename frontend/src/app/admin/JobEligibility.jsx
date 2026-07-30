import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import JobStepProgress from './JobStepProgress'
import { 
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  Calendar,
  Users,
  Plus,
  X,
  Award,
  BookOpen
} from 'lucide-react'

const JobEligibility = () => {
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
  const returnToReview = searchParams.get('returnTo') === 'review'

  const [formData, setFormData] = useState(() => {
    const saved = savedDraft
    return {
    ageLimit: {
      min: saved.ageLimit?.min || '',
      max: saved.ageLimit?.max || '',
      relaxation: {
        sc: saved.ageLimit?.relaxation?.sc || '',
        st: saved.ageLimit?.relaxation?.st || '',
        obc: saved.ageLimit?.relaxation?.obc || '',
        pwd: saved.ageLimit?.relaxation?.pwd || ''
      }
    },
    education: {
      essential: saved.education?.essential?.length ? saved.education.essential : [
        { degree: '', specialization: '', university: 'Any recognized university' }
      ],
      desirable: saved.education?.desirable || []
    },
    experience: {
      required: saved.experience?.required || false,
      years: saved.experience?.years || '',
      type: saved.experience?.type || '',
      description: saved.experience?.description || ''
    },
    otherRequirements: saved.otherRequirements || [],
    physicalStandards: {
      required: saved.physicalStandards?.required || false,
      height: saved.physicalStandards?.height || { male: '', female: '' },
      chest: saved.physicalStandards?.chest || { male: '', female: '' },
      weight: saved.physicalStandards?.weight || { male: '', female: '' }
    },
    medicalStandards: {
      required: saved.medicalStandards?.required || false,
      vision: saved.medicalStandards?.vision || '',
      hearing: saved.medicalStandards?.hearing || '',
      other: saved.medicalStandards?.other || ''
    }
  }})

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const keys = field.split('.')
      setFormData(prev => {
        const newData = { ...prev }
        let current = newData
        for (let i = 0; i < keys.length - 1; i++) {
          current = current[keys[i]]
        }
        current[keys[keys.length - 1]] = value
        return newData
      })
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const addEducationRequirement = (type) => {
    setFormData(prev => ({
      ...prev,
      education: {
        ...prev.education,
        [type]: [
          ...prev.education[type],
          { degree: '', specialization: '', university: 'Any recognized university' }
        ]
      }
    }))
  }

  const removeEducationRequirement = (type, index) => {
    setFormData(prev => ({
      ...prev,
      education: {
        ...prev.education,
        [type]: prev.education[type].filter((_, i) => i !== index)
      }
    }))
  }

  const updateEducationRequirement = (type, index, field, value) => {
    setFormData(prev => ({
      ...prev,
      education: {
        ...prev.education,
        [type]: prev.education[type].map((item, i) => 
          i === index ? { ...item, [field]: value } : item
        )
      }
    }))
  }

  const addOtherRequirement = () => {
    setFormData(prev => ({
      ...prev,
      otherRequirements: [...prev.otherRequirements, '']
    }))
  }

  const removeOtherRequirement = (index) => {
    setFormData(prev => ({
      ...prev,
      otherRequirements: prev.otherRequirements.filter((_, i) => i !== index)
    }))
  }

  const updateOtherRequirement = (index, value) => {
    setFormData(prev => ({
      ...prev,
      otherRequirements: prev.otherRequirements.map((item, i) => 
        i === index ? value : item
      )
    }))
  }

  const handleNext = () => {
    const existing = JSON.parse(sessionStorage.getItem('job_draft') || '{}')
    sessionStorage.setItem('job_draft', JSON.stringify({
      ...existing,
      ageLimit: {
        min: Number(formData.ageLimit.min) || undefined,
        max: Number(formData.ageLimit.max) || undefined,
        relaxation: {
          sc: Number(formData.ageLimit.relaxation.sc) || 0,
          st: Number(formData.ageLimit.relaxation.st) || 0,
          obc: Number(formData.ageLimit.relaxation.obc) || 0,
          pwd: Number(formData.ageLimit.relaxation.pwd) || 0,
        },
      },
      education: {
        essential: formData.education.essential.filter(e => e.degree),
        desirable: formData.education.desirable.filter(e => e.degree),
      },
      experience: formData.experience,
      physicalStandards: formData.physicalStandards,
      medicalStandards: formData.medicalStandards,
      otherRequirements: formData.otherRequirements.filter(r => r.trim()),
    }))
    navigate(returnToReview
      ? `/admin/jobs/create/review${projectId ? `?project=${projectId}` : ''}`
      : `/admin/jobs/create/form-builder${projectId ? `?project=${projectId}` : ''}`)
  }

  const handleBack = () => {
    navigate(`/admin/jobs/create/basic-info${projectId ? `?project=${projectId}` : ''}`)
  }



  return (
    <AdminLayout title="Create Job - Eligibility">
      <div className="p-4 sm:p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create Job Posting</h1>
            <p className="text-gray-500 text-sm mt-0.5">Step 2 of 6: Eligibility Criteria</p>
          </div>
        </div>

        {/* Progress Steps */}
        <JobStepProgress currentStep={2} projectId={projectId} clickable />

        <div className="grid grid-cols-1 items-stretch lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Age Limit */}
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">Age Limit</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Age (Years)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 21"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      value={formData.ageLimit.min}
                      onChange={(e) => handleInputChange('ageLimit.min', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Age (Years)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 40"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      value={formData.ageLimit.max}
                      onChange={(e) => handleInputChange('ageLimit.max', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Age Relaxation (Years)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">SC</label>
                      <input
                        type="number"
                        placeholder="5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={formData.ageLimit.relaxation.sc}
                        onChange={(e) => handleInputChange('ageLimit.relaxation.sc', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">ST</label>
                      <input
                        type="number"
                        placeholder="5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={formData.ageLimit.relaxation.st}
                        onChange={(e) => handleInputChange('ageLimit.relaxation.st', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">OBC</label>
                      <input
                        type="number"
                        placeholder="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={formData.ageLimit.relaxation.obc}
                        onChange={(e) => handleInputChange('ageLimit.relaxation.obc', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">PWD</label>
                      <input
                        type="number"
                        placeholder="10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={formData.ageLimit.relaxation.pwd}
                        onChange={(e) => handleInputChange('ageLimit.relaxation.pwd', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Educational Qualifications */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <GraduationCap className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">Educational Qualifications</h3>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Essential Qualifications */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">Essential Qualifications</h4>
                    <Button 
                      onClick={() => addEducationRequirement('essential')}
                      variant="outline" 
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Qualification
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {formData.education.essential.map((qual, index) => (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start mb-4">
                          <h5 className="font-medium text-gray-700">Qualification {index + 1}</h5>
                          {formData.education.essential.length > 1 && (
                            <Button 
                              onClick={() => removeEducationRequirement('essential', index)}
                              variant="ghost" 
                              size="sm"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Degree/Qualification
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Ph.D."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                              value={qual.degree}
                              onChange={(e) => updateEducationRequirement('essential', index, 'degree', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Subject/Specialization
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Physics"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                              value={qual.specialization}
                              onChange={(e) => updateEducationRequirement('essential', index, 'specialization', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              University/Board
                            </label>
                            <input
                              type="text"
                              placeholder="Any recognized university"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                              value={qual.university}
                              onChange={(e) => updateEducationRequirement('essential', index, 'university', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desirable Qualifications */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">Desirable Qualifications</h4>
                    <Button 
                      onClick={() => addEducationRequirement('desirable')}
                      variant="outline" 
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Qualification
                    </Button>
                  </div>
                  {formData.education.desirable.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No desirable qualifications added</p>
                  ) : (
                    <div className="space-y-4">
                      {formData.education.desirable.map((qual, index) => (
                        <div key={index} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex justify-between items-start mb-4">
                            <h5 className="font-medium text-gray-700">Desirable {index + 1}</h5>
                            <Button 
                              onClick={() => removeEducationRequirement('desirable', index)}
                              variant="ghost" 
                              size="sm"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Degree/Qualification
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. M.Phil."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                value={qual.degree}
                                onChange={(e) => updateEducationRequirement('desirable', index, 'degree', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Subject/Specialization
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Physics"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                value={qual.specialization}
                                onChange={(e) => updateEducationRequirement('desirable', index, 'specialization', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                University/Board
                              </label>
                              <input
                                type="text"
                                placeholder="Any recognized university"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                value={qual.university}
                                onChange={(e) => updateEducationRequirement('desirable', index, 'university', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Experience Requirements */}
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">Experience Requirements</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="experienceRequired"
                    className="w-4 h-4 text-orange-600 rounded"
                    checked={formData.experience.required}
                    onChange={(e) => handleInputChange('experience.required', e.target.checked)}
                  />
                  <label htmlFor="experienceRequired" className="text-sm font-medium text-gray-700">
                    Experience Required
                  </label>
                </div>

                {formData.experience.required && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Years of Experience
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 3"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          value={formData.experience.years}
                          onChange={(e) => handleInputChange('experience.years', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Experience Type
                        </label>
                        <select 
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          value={formData.experience.type}
                          onChange={(e) => handleInputChange('experience.type', e.target.value)}
                        >
                          <option value="">Select Type</option>
                          <option value="Teaching">Teaching</option>
                          <option value="Research">Research</option>
                          <option value="Industry">Industry</option>
                          <option value="Government">Government</option>
                          <option value="Any">Any Relevant</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Experience Description
                      </label>
                      <textarea
                        rows="3"
                        placeholder="Describe the type of experience required..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={formData.experience.description}
                        onChange={(e) => handleInputChange('experience.description', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Other Requirements */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">Other Requirements</h3>
                  </div>
                  <Button 
                    onClick={addOtherRequirement}
                    variant="outline" 
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Requirement
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {formData.otherRequirements.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No additional requirements added</p>
                ) : (
                  <div className="space-y-3">
                    {formData.otherRequirements.map((req, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <input
                          type="text"
                          placeholder="e.g. Valid driving license, Computer proficiency, etc."
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          value={req}
                          onChange={(e) => updateOtherRequirement(index, e.target.value)}
                        />
                        <Button 
                          onClick={() => removeOtherRequirement(index)}
                          variant="ghost" 
                          size="sm"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Physical Standards */}
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">Physical Standards</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="physicalRequired"
                    className="w-4 h-4 text-orange-600 rounded"
                    checked={formData.physicalStandards.required}
                    onChange={(e) => handleInputChange('physicalStandards.required', e.target.checked)}
                  />
                  <label htmlFor="physicalRequired" className="text-sm font-medium text-gray-700">
                    Physical Standards Required
                  </label>
                </div>

                {formData.physicalStandards.required && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Height (cm)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="Male"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          value={formData.physicalStandards.height.male}
                          onChange={(e) => handleInputChange('physicalStandards.height.male', e.target.value)}
                        />
                        <input
                          type="number"
                          placeholder="Female"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          value={formData.physicalStandards.height.female}
                          onChange={(e) => handleInputChange('physicalStandards.height.female', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Medical Standards */}
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">Medical Standards</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="medicalRequired"
                    className="w-4 h-4 text-orange-600 rounded"
                    checked={formData.medicalStandards.required}
                    onChange={(e) => handleInputChange('medicalStandards.required', e.target.checked)}
                  />
                  <label htmlFor="medicalRequired" className="text-sm font-medium text-gray-700">
                    Medical Standards Required
                  </label>
                </div>

                {formData.medicalStandards.required && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vision Requirements
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 6/6 or 6/9"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={formData.medicalStandards.vision}
                        onChange={(e) => handleInputChange('medicalStandards.vision', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Eligibility Tips */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6">
                <h3 className="font-semibold text-blue-800 mb-3">Eligibility Tips</h3>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• Follow government reservation policies</li>
                  <li>• Ensure age limits comply with regulations</li>
                  <li>• Be specific about educational requirements</li>
                  <li>• Consider relaxations for different categories</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <Button 
            onClick={handleBack}
            variant="outline" 
            className="px-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back: Basic Info
          </Button>
          <Button 
            onClick={handleNext}
            className="bg-orange-600 hover:bg-orange-700 text-white px-8"
          >
            {returnToReview ? 'Save & Return to Review' : 'Next: Form Builder'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
      </div>
    </AdminLayout>
  )
}

export default JobEligibility





