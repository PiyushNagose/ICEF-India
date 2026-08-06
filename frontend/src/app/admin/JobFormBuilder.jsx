import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import JobStepProgress from './JobStepProgress'
import { 
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  Edit,
  Eye,
  Settings,
  Type,
  List,
  Calendar,
  FileText,
  CheckSquare,
  Radio,
  Upload,
  Hash,
  Mail,
  Phone,
  MapPin,
  GripVertical
} from 'lucide-react'

const BUILT_IN_SECTIONS = [
  {
    id: 'system-personal',
    system: true,
    title: 'Personal Details',
    required: true,
    fields: [
      { id: 'system-personal-name', label: 'Full Name', type: 'text', required: true },
      { id: 'system-personal-father', label: "Father's Name", type: 'text', required: true },
      { id: 'system-personal-dob', label: 'Date of Birth', type: 'date', required: true },
      { id: 'system-personal-gender', label: 'Gender', type: 'radio', required: true, options: ['Male', 'Female', 'Other'] },
      { id: 'system-personal-category', label: 'Category', type: 'select', required: true, options: ['General', 'OBC', 'SC', 'ST', 'EWS'] },
      { id: 'system-personal-mobile', label: 'Registered Mobile', type: 'tel', required: true },
      { id: 'system-personal-email', label: 'Email', type: 'email', required: true },
    ],
  },
  {
    id: 'system-education',
    system: true,
    title: 'Educational Info',
    required: true,
    fields: [
      { id: 'system-education-level', label: 'Qualification Level', type: 'text', required: true },
      { id: 'system-education-board', label: 'Board / University', type: 'text', required: true },
      { id: 'system-education-year', label: 'Passing Year', type: 'number', required: true },
      { id: 'system-education-result', label: 'Result / Percentage', type: 'text', required: true },
    ],
  },
  {
    id: 'system-additional',
    system: true,
    title: 'Additional Information',
    required: false,
    fields: [
      { id: 'system-additional-religion', label: 'Religion', type: 'text', required: false },
      { id: 'system-additional-marital', label: 'Marital Status', type: 'select', required: false, options: ['Single', 'Married'] },
      { id: 'system-additional-mark', label: 'Identification Mark', type: 'textarea', required: false },
      { id: 'system-additional-domicile', label: 'Domicile Details', type: 'text', required: false },
    ],
  },
  {
    id: 'system-address',
    system: true,
    title: 'Address Details',
    required: true,
    fields: [
      { id: 'system-address-permanent', label: 'Permanent Address', type: 'textarea', required: true },
      { id: 'system-address-correspondence', label: 'Correspondence Address', type: 'textarea', required: true },
      { id: 'system-address-state', label: 'State', type: 'select', required: true },
      { id: 'system-address-district', label: 'District', type: 'text', required: true },
      { id: 'system-address-pincode', label: 'Pincode', type: 'number', required: true },
    ],
  },
]

const makeCustomSection = (section, sectionIndex) => ({
  id: section.id || `custom-${sectionIndex + 1}`,
  title: section.title,
  required: section.required,
  fields: (section.fields || []).map((field, fieldIndex) => ({
    id: field.id || Date.now() + sectionIndex * 100 + fieldIndex,
    ...field,
  })),
})

const JobFormBuilder = () => {
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

  const [formSections, setFormSections] = useState(() => {
    const saved = savedDraft
    const systemSections = BUILT_IN_SECTIONS.map(section => ({
      ...section,
      fields: section.fields.map(field => ({ ...field })),
    }))
    if (saved.formSections?.length) {
      return [
        ...systemSections,
        ...saved.formSections.map(makeCustomSection),
      ]
    }
    return [
      ...systemSections,
      {
        id: 'custom-1',
        title: 'General Info',
        required: false,
        fields: []
      }
    ]
  })

  const [selectedSection, setSelectedSection] = useState('custom-1')
  const [showFieldModal, setShowFieldModal] = useState(false)
  const [showSectionSettings, setShowSectionSettings] = useState(true)
  const [editingField, setEditingField] = useState(null)
  const [newField, setNewField] = useState({
    type: 'text',
    label: '',
    required: false,
    placeholder: '',
    options: [],
    optionsText: ''
  })

  const fieldTypes = [
    { type: 'text', label: 'Text Input', icon: Type },
    { type: 'textarea', label: 'Text Area', icon: FileText },
    { type: 'email', label: 'Email', icon: Mail },
    { type: 'tel', label: 'Phone', icon: Phone },
    { type: 'number', label: 'Number', icon: Hash },
    { type: 'date', label: 'Date', icon: Calendar },
    { type: 'select', label: 'Dropdown', icon: List },
    { type: 'radio', label: 'Radio Button', icon: Radio },
    { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
    { type: 'file', label: 'File Upload', icon: Upload }
  ]

  const addSection = () => {
    const newSection = {
      id: Date.now(),
      title: 'Custom Section',
      required: false,
      fields: []
    }
    setFormSections([...formSections, newSection])
    setSelectedSection(newSection.id)
    setShowSectionSettings(true)
  }

  const updateSection = (sectionId, updates) => {
    setFormSections(sections => 
      sections.map(section => 
        section.id === sectionId && !section.system ? { ...section, ...updates } : section
      )
    )
  }

  const deleteSection = (sectionId) => {
    const customSections = formSections.filter(section => !section.system)
    const target = formSections.find(section => section.id === sectionId)
    if (!target?.system && customSections.length > 1) {
      const remainingSections = formSections.filter(section => section.id !== sectionId)
      setFormSections(remainingSections)
      if (selectedSection === sectionId) {
        setSelectedSection(remainingSections.find(section => !section.system)?.id || remainingSections[0]?.id)
      }
    }
  }

  const resetFieldModal = () => {
    setEditingField(null)
    setNewField({
      type: 'text',
      label: '',
      required: false,
      placeholder: '',
      options: [],
      optionsText: '',
      validation: {}
    })
    setShowFieldModal(false)
  }

  const cleanField = () => {
    const type = newField.type || 'text'
    const options = ['select', 'radio'].includes(type)
      ? [...new Set(String(newField.optionsText || '').split(/[,\n]/).map(opt => opt.trim()).filter(Boolean))]
      : undefined
    const validation = type === 'number'
      ? {
          ...(newField.validation?.min !== '' && newField.validation?.min !== undefined && { min: Number(newField.validation.min) }),
          ...(newField.validation?.max !== '' && newField.validation?.max !== undefined && { max: Number(newField.validation.max) }),
        }
      : undefined

    return {
      type,
      label: newField.label.trim(),
      placeholder: newField.placeholder?.trim() || '',
      options,
      validation,
    }
  }

  const validateFieldDraft = () => {
    const field = cleanField()
    if (!field.label) return 'Field label is required'
    if (['select', 'radio'].includes(field.type) && (!field.options || field.options.length < 2)) {
      return 'Add at least two options'
    }
    if (field.type === 'number' && field.validation?.min !== undefined && field.validation?.max !== undefined && field.validation.min > field.validation.max) {
      return 'Minimum value cannot be greater than maximum value'
    }
    return ''
  }

  const saveField = () => {
    const error = validateFieldDraft()
    if (error) {
      toast.error(error)
      return
    }
    const field = cleanField()
    if (editingField) {
      updateField(editingField.id, field)
      toast.success('Field updated')
      resetFieldModal()
      return
    }

    addField(field)
  }

  const addField = (fieldDraft = cleanField()) => {
    if (currentSection?.system) {
      toast.error('Built-in sections are already handled in the candidate application.')
      return
    }
    const field = {
      id: Date.now(),
      ...fieldDraft,
    }
    
    setFormSections(sections =>
      sections.map(section =>
        section.id === selectedSection
          ? { ...section, fields: [...section.fields, field] }
          : section
      )
    )
    
    toast.success('Field added')
    resetFieldModal()
  }

  const updateField = (fieldId, updates) => {
    setFormSections(sections =>
      sections.map(section =>
        section.id === selectedSection && !section.system
          ? {
              ...section,
              fields: section.fields.map(field =>
                field.id === fieldId ? { ...field, ...updates } : field
              )
            }
          : section
      )
    )
  }

  const deleteField = (fieldId) => {
    setFormSections(sections =>
      sections.map(section =>
        section.id === selectedSection && !section.system
          ? {
              ...section,
              fields: section.fields.filter(field => field.id !== fieldId)
            }
          : section
      )
    )
  }

  const openAddFieldModal = () => {
    setEditingField(null)
    setNewField({
      type: 'text',
      label: '',
      required: false,
      placeholder: '',
      options: [],
      optionsText: '',
      validation: {}
    })
    setShowFieldModal(true)
  }

  const openEditFieldModal = (field) => {
    setEditingField(field)
    setNewField({
      type: field.type || 'text',
      label: field.label || '',
      required: Boolean(field.required),
      placeholder: field.placeholder || '',
      options: Array.isArray(field.options) ? field.options : [],
      optionsText: Array.isArray(field.options) ? field.options.join(', ') : '',
      validation: field.validation || {}
    })
    setShowFieldModal(true)
  }

  const handleNext = () => {
    const existing = JSON.parse(sessionStorage.getItem('job_draft') || '{}')
    const customSections = formSections.filter(section => !section.system)
    const invalidSection = customSections.find(section => !section.title?.trim())
    if (invalidSection) {
      toast.error('Every form section needs a title')
      setSelectedSection(invalidSection.id)
      setShowSectionSettings(true)
      return
    }
    const reservedTitles = new Set([
      'personal information',
      'personal details',
      'personal info',
      'candidate details',
      'educational info',
      'educational information',
      'education',
      'additional information',
      'additional info',
      'address details',
      'address information',
      'address',
      'document upload',
      'documents',
      'payment',
      'review',
      'post selection',
    ])
    const duplicateFixedSection = customSections.find(section =>
      reservedTitles.has(section.title.trim().toLowerCase().replace(/\s+/g, ' '))
    )
    if (duplicateFixedSection) {
      toast.error('This is already available as a built-in section. Add only job-specific custom sections here.')
      setSelectedSection(duplicateFixedSection.id)
      setShowSectionSettings(true)
      return
    }
    sessionStorage.setItem('job_draft', JSON.stringify({
      ...existing,
      formSections: customSections.filter(section => section.fields.length > 0).map(section => ({
        title: section.title.trim(),
        required: section.required,
        fields: section.fields.map(({ id: _id, ...field }) => field),
      })),
    }))
    navigate(returnToReview
      ? `/admin/jobs/create/review${projectId ? `?project=${projectId}` : ''}`
      : `/admin/jobs/create/documents${projectId ? `?project=${projectId}` : ''}`)
  }

  const handleBack = () => {
    navigate(`/admin/jobs/create/eligibility${projectId ? `?project=${projectId}` : ''}`)
  }


  const currentSection = formSections.find(section => section.id === selectedSection)

  return (
    <AdminLayout title="Create Job - Form Builder">
      <div className="p-4 sm:p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create Job Posting</h1>
            <p className="text-gray-500 text-sm mt-0.5">Step 3 of 6: Application Form Builder</p>
          </div>
        </div>

        {/* Progress Steps */}
        <JobStepProgress currentStep={3} projectId={projectId} clickable />

        <div className="grid grid-cols-1 items-stretch lg:grid-cols-4 gap-6">
          {/* Sections Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Form Sections</h3>
                  <Button onClick={addSection} variant="ghost" size="sm" title="Add section">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {formSections.map((section) => (
                    <div
                      key={section.id}
                      onClick={() => setSelectedSection(section.id)}
                      className={`p-3 cursor-pointer border-l-4 transition-colors ${
                        selectedSection === section.id
                          ? 'bg-orange-50 border-orange-500 text-orange-700'
                          : 'border-transparent hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{section.title}</div>
                          <div className="text-xs text-gray-500">
                            {section.fields.length} fields
                            {section.system ? ' - built-in' : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {section.system && (
                            <Badge className="bg-blue-100 text-blue-700 text-xs">System</Badge>
                          )}
                          {section.required && (
                            <Badge className="bg-red-100 text-red-800 text-xs">Required</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form Builder */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{currentSection?.title}</h3>
                    <p className="text-sm text-gray-600">
                      {currentSection?.system
                        ? 'Built-in candidate step already available in the application flow'
                        : 'Configure form fields for this section'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!currentSection?.system && (
                      <Button
                        onClick={openAddFieldModal}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Field
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Section settings"
                      onClick={() => setShowSectionSettings(prev => !prev)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {currentSection?.fields.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No fields added yet</p>
                    {!currentSection?.system && (
                      <Button
                        onClick={openAddFieldModal}
                        variant="outline"
                        className="mt-4"
                      >
                        Add First Field
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentSection?.fields.map((field, index) => (
                      <div key={field.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <GripVertical className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="font-medium text-gray-900">{field.label}</div>
                              <div className="text-sm text-gray-500 capitalize">{field.type}</div>
                            </div>
                            {field.required && (
                              <Badge className="bg-red-100 text-red-800 text-xs">Required</Badge>
                            )}
                          </div>
                          {!currentSection.system && (
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditFieldModal(field)}
                                title="Edit field"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                onClick={() => deleteField(field.id)}
                                variant="ghost" 
                                size="sm"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        {/* Field Preview */}
                        <div className="bg-gray-50 p-3 rounded">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              placeholder={field.placeholder}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                              rows="3"
                              disabled
                            />
                          ) : field.type === 'select' ? (
                            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white" disabled>
                              <option>Select an option</option>
                              {field.options?.map((option, i) => (
                                <option key={i} value={option}>{option}</option>
                              ))}
                            </select>
                          ) : field.type === 'radio' ? (
                            <div className="space-y-2">
                              {field.options?.map((option, i) => (
                                <label key={i} className="flex items-center space-x-2">
                                  <input type="radio" name={`field-${field.id}`} disabled />
                                  <span className="text-sm">{option}</span>
                                </label>
                              ))}
                            </div>
                          ) : field.type === 'checkbox' ? (
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" disabled />
                              <span className="text-sm">{field.placeholder || 'Checkbox option'}</span>
                            </label>
                          ) : field.type === 'file' ? (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                              <span className="text-sm text-gray-500">Click to upload or drag and drop</span>
                            </div>
                          ) : (
                            <input
                              type={field.type}
                              placeholder={field.placeholder}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                              disabled
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Eye className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">Form Preview</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  {formSections.map((section) => (
                    <div key={section.id} className="border-l-2 border-gray-200 pl-3">
                      <div className="font-medium text-gray-900">{section.title}</div>
                      <div className="text-gray-500">{section.fields.length} fields</div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Built-in Sections:</span>
                      <span className="font-medium">
                        {formSections.filter(section => section.system).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Custom Sections:</span>
                      <span className="font-medium">
                        {formSections.filter(section => !section.system).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Fields:</span>
                      <span className="font-medium">
                        {formSections.reduce((total, section) => total + section.fields.length, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section Settings */}
            {currentSection && showSectionSettings && (
              <Card className="mt-6">
                <CardHeader>
                  <h3 className="font-semibold text-gray-900">Section Settings</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentSection.system ? (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                      This is a built-in application step. Its base fields are already shown to candidates in the fixed application flow. Add a custom section when you need job-specific extra questions.
                    </div>
                  ) : (
                    <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Section Title
                    </label>
                    <input
                      type="text"
                      value={currentSection.title}
                      onChange={(e) => updateSection(selectedSection, { title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="sectionRequired"
                      checked={currentSection.required}
                      onChange={(e) => updateSection(selectedSection, { required: e.target.checked })}
                      className="w-4 h-4 text-orange-600 rounded"
                    />
                    <label htmlFor="sectionRequired" className="text-sm font-medium text-gray-700">
                      Required Section
                    </label>
                  </div>
                  {formSections.filter(section => !section.system).length > 1 && (
                    <Button
                      onClick={() => deleteSection(selectedSection)}
                      variant="outline"
                      className="w-full text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Delete Section
                    </Button>
                  )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Add Field Modal */}
        {showFieldModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="hover-scroll bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingField ? 'Edit Field' : 'Add New Field'}
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={resetFieldModal}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Field Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {fieldTypes.map((type) => {
                      const Icon = type.icon
                      return (
                        <button
                          key={type.type}
                          onClick={() => setNewField({
                            ...newField,
                            type: type.type,
                            options: ['select', 'radio'].includes(type.type) ? newField.options : [],
                            optionsText: ['select', 'radio'].includes(type.type) ? newField.optionsText : '',
                            validation: type.type === 'number' ? newField.validation || {} : {}
                          })}
                          className={`p-3 border rounded-lg text-left transition-colors ${
                            newField.type === type.type
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium">{type.label}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Field Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Full Name"
                    value={newField.label}
                    onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Placeholder Text
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Enter your full name"
                    value={newField.placeholder}
                    onChange={(e) => setNewField({ ...newField, placeholder: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {(newField.type === 'select' || newField.type === 'radio') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Options (comma separated)
                    </label>
                    <input
                      type="text"
                      placeholder="Male, Female, Other"
                      value={newField.optionsText || ''}
                      onChange={(e) => setNewField({ 
                        ...newField, 
                        optionsText: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Example: General, OBC, SC, ST
                    </p>
                  </div>
                )}

                {newField.type === 'number' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Value
                      </label>
                      <input
                        type="number"
                        value={newField.validation?.min ?? ''}
                        onChange={(e) => setNewField({
                          ...newField,
                          validation: { ...(newField.validation || {}), min: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Value
                      </label>
                      <input
                        type="number"
                        value={newField.validation?.max ?? ''}
                        onChange={(e) => setNewField({
                          ...newField,
                          validation: { ...(newField.validation || {}), max: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="fieldRequired"
                    checked={newField.required}
                    onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                  <label htmlFor="fieldRequired" className="text-sm font-medium text-gray-700">
                    Required Field
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <Button 
                  onClick={resetFieldModal}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={saveField}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={!newField.label.trim()}
                >
                  {editingField ? 'Save Field' : 'Add Field'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <Button 
            onClick={handleBack}
            variant="outline" 
            className="px-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back: Eligibility
          </Button>
          <Button 
            onClick={handleNext}
            className="bg-orange-600 hover:bg-orange-700 text-white px-8"
          >
            {returnToReview ? 'Save & Return to Review' : 'Next: Documents'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
      </div>
    </AdminLayout>
  )
}

export default JobFormBuilder





