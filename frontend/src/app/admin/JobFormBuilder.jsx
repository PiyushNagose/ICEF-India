import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import CustomSelect from '../../components/ui/CustomSelect'
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
  systemSource: section.systemSource,
  system: Boolean(section.system || section.systemSource),
  fields: (section.fields || []).map((field, fieldIndex) => ({
    id: field.id || Date.now() + sectionIndex * 100 + fieldIndex,
    ...field,
    systemField: Boolean(field.systemField),
  })),
})

const stripBuilderFieldMeta = (field = {}) => {
  const cleanField = { ...field }
  delete cleanField.id
  delete cleanField.systemField
  return cleanField
}

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
      fields: section.fields.map(field => ({ ...field, systemField: true })),
    }))
    if (saved.formSections?.length) {
      return saved.formSections.map(makeCustomSection)
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

  const [selectedSection, setSelectedSection] = useState(() =>
    formSections.find(section => !section.system)?.id || formSections[0]?.id
  )
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
        section.id === sectionId
          ? { ...section, ...updates }
          : section
      )
    )
  }

  const deleteSection = (sectionId) => {
    const target = formSections.find(section => section.id === sectionId)
    if (target && formSections.length > 1) {
      const remainingSections = formSections.filter(section => section.id !== sectionId)
      setFormSections(remainingSections)
      if (selectedSection === sectionId) {
        setSelectedSection(remainingSections[0]?.id)
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
      validation: { allowedFileTypes: [] }
    })
    setShowFieldModal(false)
  }

  const cleanField = () => {
    const type = newField.type || 'text'
    const options = ['select', 'radio'].includes(type)
      ? [...new Set(String(newField.optionsText || '').split(/[,\n]/).map(opt => opt.trim()).filter(Boolean))]
      : undefined
    const validation =
      type === 'number'
        ? {
            ...(newField.validation?.min !== '' && newField.validation?.min !== undefined && { min: Number(newField.validation.min) }),
            ...(newField.validation?.max !== '' && newField.validation?.max !== undefined && { max: Number(newField.validation.max) }),
          }
        : type === 'file'
          ? {
              ...(newField.validation?.maxSizeKB !== '' &&
                newField.validation?.maxSizeKB !== undefined && {
                  maxSizeKB: Math.max(1, Math.round(Number(newField.validation.maxSizeKB))),
                }),
              ...(newField.validation?.allowedFileTypes?.length > 0 && {
                allowedFileTypes: newField.validation.allowedFileTypes,
              }),
            }
          : undefined

    return {
      type,
      label: newField.label.trim(),
      required: Boolean(newField.required),
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
    if (field.type === 'file' && (!field.validation?.maxSizeKB || field.validation.maxSizeKB < 1)) {
      return 'File upload max size in KB is required'
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
    const field = {
      id: Date.now(),
      systemField: false,
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
        section.id === selectedSection
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
        section.id === selectedSection
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
    const savedSections = formSections.filter(section => section.title?.trim())
    const invalidSection = formSections.find(section => !section.title?.trim())
    if (invalidSection) {
      toast.error('Every form section needs a title')
      setSelectedSection(invalidSection.id)
      setShowSectionSettings(true)
      return
    }
    sessionStorage.setItem('job_draft', JSON.stringify({
      ...existing,
      formSections: savedSections.map(section => ({
        title: section.title.trim(),
        required: section.required,
        ...(section.system ? { systemSource: section.systemSource || section.id } : {}),
        fields: section.fields.map(stripBuilderFieldMeta),
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
                            {section.system ? ' - suggested' : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {section.system && (
                            <Badge className="bg-orange-100 text-orange-700 text-xs">Suggested</Badge>
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
                      Add, edit, remove, or reorder fields for this job form.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={openAddFieldModal}
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Field
                    </Button>
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
                    <Button
                      onClick={openAddFieldModal}
                      variant="outline"
                      className="mt-4"
                    >
                      Add First Field
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentSection?.fields.map((field) => (
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
                          <div className="flex items-center gap-2">
                            {field.systemField && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs">Base</Badge>
                            )}
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
                              title="Delete field"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
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
                            <CustomSelect
                              value=""
                              onChange={() => {}}
                              options={[
                                { value: '', label: 'Select an option' },
                                ...(field.options || []).map(opt => ({ value: opt, label: opt }))
                              ]}
                              disabled
                              className="w-full bg-white border-gray-300"
                            />
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
                              {field.validation?.maxSizeKB ? (
                                <p className="mt-1 text-xs font-medium text-gray-500">
                                  Max: {field.validation.maxSizeKB} KB
                                </p>
                              ) : null}
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
                      <span>Suggested Sections:</span>
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
                  {formSections.length > 1 && (
                    <Button
                      onClick={() => deleteSection(selectedSection)}
                      variant="outline"
                      className="w-full text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Delete Section
                    </Button>
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
                            validation:
                              type.type === 'number'
                                ? newField.validation || {}
                                : type.type === 'file'
                                  ? { 
                                      maxSizeKB: newField.validation?.maxSizeKB || 512,
                                      allowedFileTypes: newField.validation?.allowedFileTypes || [] 
                                    }
                                  : {}
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

                {newField.type === 'file' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max File Size (KB)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={newField.validation?.maxSizeKB ?? ''}
                        onChange={(e) => setNewField({
                          ...newField,
                          validation: {
                            ...(newField.validation || {}),
                            maxSizeKB: e.target.value,
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="e.g. 512"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Enter size in KB only.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Allowed File Types (comma separated)
                      </label>
                      <input
                        type="text"
                        value={newField.validation?.allowedFileTypes?.join(', ') ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const allowedTypes = val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                          setNewField({
                            ...newField,
                            validation: {
                              ...(newField.validation || {}),
                              allowedFileTypes: allowedTypes.length > 0 ? allowedTypes : undefined
                            }
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="e.g. .pdf, .jpg, .png"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Leave blank to allow any file type. Include dot (e.g., .pdf).
                      </p>
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





