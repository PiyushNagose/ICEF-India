import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  ArrowLeft,
  ClipboardList,
  Edit2,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Palette,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { adminService } from '../../services/admin.service'
import Button from '../../components/ui/Button'
import AdmitCardPreview from './components/AdmitCardPreview'
import AdminLayout from '../../components/layouts/AdminLayout'
import ConfirmActionModal from '../../components/ui/ConfirmActionModal'

const TEMPLATE_TYPES = [
  {
    id: 'admit_card',
    label: 'Admit Cards',
    title: 'Admit Card Templates',
    description: 'Design admit-card layouts used by job exam schedules.',
    icon: LayoutTemplate,
  },
  {
    id: 'attendance_sheet',
    label: 'Attendance Sheets',
    title: 'Attendance Sheet Templates',
    description: 'Design attendance sheets used for center-wise printing and bulk ZIP exports.',
    icon: ClipboardList,
  },
]

const TEMPLATE_TEXT_DEFAULTS = {
  admit_card: {
    organizationName: 'Jharkhand Staff Selection Commission',
    organizationNameLocal: 'Jharkhand Staff Selection Commission',
    documentTitle: 'Admit Card',
    sealText: 'JSSC',
    provisionalNote:
      'If the information mentioned on this admit card is different from the application, the candidate must contact the commission immediately.',
    instructionHeading: 'Please read the instructions carefully before appearing for the examination.',
    photoBoxText: 'Paste Photo Here\nSignature of Candidate\nbelow pasted Photo same as\nUploaded Signature',
    controllerTitle: 'Examination Controller',
  },
  attendance_sheet: {
    organizationName: 'Jharkhand Staff Selection Commission',
    organizationNameLocal: 'Jharkhand Staff Selection Commission',
    documentTitle: 'ATTENDANCE SHEET',
    sealText: 'JSSC',
    provisionalNote: '',
    instructionHeading: '',
    photoBoxText: '',
    controllerTitle: '',
  },
}

const blankForm = (templateType) => ({
  name: templateType === 'attendance_sheet' ? 'New Attendance Sheet Template' : 'New Admit Card Template',
  templateType,
  baseLayout: 'standard',
  orientation: 'portrait',
  logoUrl: '',
  watermarkUrl: '',
  primaryColor: '#f97316',
  instructions: '',
  ...TEMPLATE_TEXT_DEFAULTS[templateType],
})

const BASE_LAYOUTS = [
  { id: 'standard', label: 'Standard' },
  { id: 'modern', label: 'Modern' },
  { id: 'compact', label: 'Compact' },
]

const AttendanceSheetPreview = ({ template, scale = 1 }) => {
  const color = template.primaryColor || '#f97316'
  const compact = template.baseLayout === 'compact'
  const modern = template.baseLayout === 'modern'
  const isLandscape = template?.orientation === 'landscape'
  const previewWidth = isLandscape ? 842 : (compact ? 390 : 520)
  const minHeight = isLandscape ? 595 : (compact ? 500 : 560)
  const rows = [1, 2, 3, 4]
  const organizationName = template.organizationName || TEMPLATE_TEXT_DEFAULTS.attendance_sheet.organizationName
  const organizationNameLocal = template.organizationNameLocal || TEMPLATE_TEXT_DEFAULTS.attendance_sheet.organizationNameLocal
  const documentTitle = template.documentTitle || TEMPLATE_TEXT_DEFAULTS.attendance_sheet.documentTitle
  const sealText = template.sealText || TEMPLATE_TEXT_DEFAULTS.attendance_sheet.sealText

  return (
    <div
      className="bg-white text-gray-950 shadow-sm relative pb-6"
      style={{
        width: previewWidth,
        minHeight: minHeight,
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
        border: `2px solid ${modern ? color : '#111827'}`,
        padding: compact ? 18 : 24,
        fontFamily: '"Times New Roman", Times, serif',
      }}
    >
      <div className={`grid grid-cols-[70px_1fr_70px] items-center text-center ${modern ? 'border-b-4 pb-3' : ''}`} style={{ borderColor: color }}>
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-[9px] font-bold overflow-hidden"
          style={{
            border: `2px solid ${color}`,
            color,
            boxShadow: 'inset 0 0 0 3px #fff7ed, inset 0 0 0 5px #fed7aa',
          }}
        >
          {template.logoUrl ? <img src={template.logoUrl} alt="" className="w-9 h-9 object-contain" /> : sealText}
        </div>
        <div>
          <p className="text-[15px] leading-tight">{organizationName}</p>
          <p className="text-[13px] leading-tight">{organizationNameLocal}</p>
          <p className="text-[10px] leading-tight mt-0.5">{documentTitle}</p>
        </div>
        <div />
      </div>

      <div className="mt-3 border border-gray-950 text-[10px]">
        <div className="grid grid-cols-2 border-b border-gray-900">
          <span className="p-1.5 border-r border-gray-900">Venue of Examination: <strong>Ranchi Central Examination Center</strong></span>
          <span className="p-1.5">Center: <strong>RNC-001</strong></span>
        </div>
        <div className="border-b border-gray-900 p-1.5">
          Venue Address: <strong>Main Road, Ranchi, Jharkhand, PIN: 834001</strong>
        </div>
        <div className="grid grid-cols-2">
          <span className="p-1.5 border-r border-gray-900">Roll Nos.: <strong>260001 to 260006</strong> &nbsp; Total Candidates: <strong>06</strong></span>
          <span className="p-1.5">Examination Date: <strong>21/08/2026</strong> &nbsp; Time: <strong>10:00 AM to 12:00 PM</strong></span>
        </div>
      </div>

      <table className="mt-0 w-full border-collapse table-fixed text-[10px]">
        <tbody>
          {rows.map((row) => (
            <React.Fragment key={row}>
              <tr>
                <td className="w-[36px] border border-gray-950 p-1 text-center align-middle">Sl. No.</td>
                <td className="border border-gray-950 p-1 align-middle">
                  Name: <strong>Candidate Name</strong>
                </td>
                <td className="w-[104px] border border-gray-950 p-1 align-middle">
                  Roll No.: <strong>26000{row}</strong>
                </td>
                <td rowSpan={3} className="w-[62px] border border-gray-950 bg-gray-50 p-1 text-center align-middle">
                  Photo
                </td>
                <td rowSpan={4} className="w-[82px] border border-gray-950 p-1 text-center align-top">
                  <strong>Thumb<br />Impression</strong>
                  <br />
                  <br />
                  <small>(Left Hand)</small>
                </td>
              </tr>
              <tr>
                <td rowSpan={3} className="border border-gray-950 p-1 text-center align-middle text-[12px]">{row}</td>
                <td className="border border-gray-950 p-1 align-middle">
                  Gender: <strong>Male</strong>
                </td>
                <td className="border border-gray-950 p-1 text-center align-middle">
                  Present <span className="ml-5 inline-block h-5 border-l border-gray-950 align-middle" />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-950 p-1 align-middle">
                  Registration No.: <strong>JSSC00000{row}</strong>
                </td>
                <td className="border border-gray-950 p-1 text-center align-middle">
                  Absent <span className="ml-5 inline-block h-5 border-l border-gray-950 align-middle" />
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="border border-gray-950 p-1 align-middle">Signature of Candidate</td>
                <td className="border border-gray-950 bg-gray-50 p-1 text-center align-middle">Sign</td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {template.instructions && (
        <div className="border-x border-b border-gray-950 p-1.5 text-[9px]">
          <strong>Instructions:</strong>{' '}
          {String(template.instructions)
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .join(' | ')}
        </div>
      )}

      <div className="border-x border-b border-gray-950 text-[9px]">
        <div className="grid grid-cols-2">
          <span className="p-1.5 border-r border-gray-950">Total Candidates Present: __________________</span>
          <span className="p-1.5">Total Candidates Absent: __________________</span>
        </div>
        <div className="grid grid-cols-2 border-t border-gray-950">
          <span className="p-1.5 border-r border-gray-950">Total Number of Candidates: _______________</span>
          <span className="p-1.5">Signature of Invigilator: _________________</span>
        </div>
      </div>
      <div className="absolute bottom-1 right-2 text-[10px] font-semibold text-gray-500">Page 1 of 1</div>
    </div>
  )
}

const AdmitCardTemplates = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const requestedType = searchParams.get('type')
  const returnTo = searchParams.get('returnTo')
  const canReturnToAdmitFormat = returnTo?.startsWith('/admin/admit-cards')
  const initialType = TEMPLATE_TYPES.some((type) => type.id === requestedType) ? requestedType : 'admit_card'
  const [activeType, setActiveType] = useState(initialType)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [form, setForm] = useState(blankForm(initialType))
  const [deleteTemplateId, setDeleteTemplateId] = useState('')

  const activeMeta = TEMPLATE_TYPES.find((type) => type.id === activeType) || TEMPLATE_TYPES[0]
  const ActiveIcon = activeMeta.icon

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const res = await adminService.getAdmitCardTemplates()
      setTemplates(res || [])
    } catch (err) {
      toast.error(err?.message || 'Could not load templates. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTemplates()
  }, [])

  const visibleTemplates = useMemo(
    () => templates.filter((template) => (template.templateType || 'admit_card') === activeType),
    [templates, activeType],
  )
  const systemTemplates = visibleTemplates.filter((template) => template.isSystemDefault)
  const customTemplates = visibleTemplates.filter((template) => !template.isSystemDefault)

  const openEditor = (template = null) => {
    if (template) {
      const templateType = template.templateType || activeType
      const textDefaults = TEMPLATE_TEXT_DEFAULTS[templateType]
      setEditingTemplate(template)
      setForm({
        name: template.isSystemDefault ? `${template.name} (Copy)` : template.name,
        templateType,
        baseLayout: template.baseLayout || 'standard',
        orientation: template.orientation || 'portrait',
        logoUrl: template.logoUrl || '',
        watermarkUrl: template.watermarkUrl || '',
        primaryColor: template.primaryColor || '#f97316',
        instructions: template.instructions || '',
        organizationName: template.organizationName || textDefaults.organizationName,
        organizationNameLocal: template.organizationNameLocal || textDefaults.organizationNameLocal,
        documentTitle: template.documentTitle || textDefaults.documentTitle,
        sealText: template.sealText || textDefaults.sealText,
        provisionalNote: template.provisionalNote || textDefaults.provisionalNote,
        instructionHeading: template.instructionHeading || textDefaults.instructionHeading,
        photoBoxText: template.photoBoxText || textDefaults.photoBoxText,
        controllerTitle: template.controllerTitle || textDefaults.controllerTitle,
      })
    } else {
      setEditingTemplate(null)
      setForm(blankForm(activeType))
    }
    setIsEditorOpen(true)
  }

  const closeEditor = () => {
    setIsEditorOpen(false)
    setEditingTemplate(null)
  }

  const updateTemplateType = (templateType) => {
    const defaults = TEMPLATE_TEXT_DEFAULTS[templateType]
    setForm((prev) => ({
      ...prev,
      templateType,
      documentTitle: defaults.documentTitle,
      sealText: prev.sealText || defaults.sealText,
      organizationName: prev.organizationName || defaults.organizationName,
      organizationNameLocal: prev.organizationNameLocal || defaults.organizationNameLocal,
      provisionalNote: defaults.provisionalNote,
      instructionHeading: defaults.instructionHeading,
      photoBoxText: defaults.photoBoxText,
      controllerTitle: defaults.controllerTitle,
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      if (editingTemplate && !editingTemplate.isSystemDefault) {
        await adminService.updateAdmitCardTemplate(editingTemplate._id, form)
        toast.success('Template updated successfully')
      } else {
        await adminService.createAdmitCardTemplate(form)
        toast.success('Template saved successfully')
      }
      closeEditor()
      fetchTemplates()
    } catch (err) {
      toast.error(err?.message || 'Could not save this template. Please check the required fields.')
    }
  }

  const confirmDeleteTemplate = async () => {
    if (!deleteTemplateId) return
    try {
      await adminService.deleteAdmitCardTemplate(deleteTemplateId)
      toast.success('Template deleted')
      setDeleteTemplateId('')
      fetchTemplates()
    } catch (err) {
      toast.error(err?.message || 'Could not delete this template.')
    }
  }

  const renderPreview = (template, scale = 0.24) =>
    (template.templateType || activeType) === 'attendance_sheet' ? (
      <AttendanceSheetPreview template={template} scale={scale} />
    ) : (
      <AdmitCardPreview template={template} scale={scale} />
    )

  const renderTemplateCard = ({ template, isBlank = false }) => {
    if (isBlank) {
      return (
        <button
          type="button"
          onClick={() => openEditor()}
          className="border-2 border-dashed border-gray-300 rounded-xl h-64 flex flex-col items-center justify-center text-gray-500 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all"
        >
          <Plus size={32} className="mb-2" />
          <span className="font-semibold">Create Blank</span>
        </button>
      )
    }

    const { baseLayout, name, isSystemDefault } = template
    const isLandscape = (template.orientation || 'portrait') === 'landscape'
    const previewFrameClass = isLandscape ? 'w-[205px] h-[145px]' : 'w-[140px] h-[190px]'
    const previewScale = isLandscape ? 0.22 : 0.24

    return (
      <div className="group relative border border-gray-200 rounded-xl bg-white hover:shadow-lg transition-all overflow-hidden flex flex-col h-64">
        <div className="flex-1 bg-gray-50 flex items-start justify-center p-4 relative overflow-hidden">
          <div className={`flex items-start justify-center ${previewFrameClass} overflow-hidden pointer-events-none`}>
            {renderPreview(template, previewScale)}
          </div>

          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => openEditor(template)}
              className="bg-white text-gray-900 p-2 rounded-full hover:bg-orange-50 transition-colors"
              title={isSystemDefault ? 'Duplicate and edit' : 'Edit template'}
            >
              <Edit2 size={18} />
            </button>
            {!isSystemDefault && (
              <button
                type="button"
                onClick={() => setDeleteTemplateId(template._id)}
                className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                title="Delete template"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="p-3 border-t border-gray-100 flex items-center justify-between bg-white">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm truncate">{name}</h3>
            <p className="text-xs text-gray-500 capitalize">
              {baseLayout} Layout - {template.orientation || 'portrait'}
            </p>
          </div>
          {isSystemDefault && (
            <span className="text-[10px] uppercase font-bold tracking-wider text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
              Default
            </span>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <AdminLayout title="Document Templates">
        <div className="flex min-h-[calc(100vh-72px)] items-center justify-center p-20">
          <Loader2 className="animate-spin text-orange-500" size={32} />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Document Templates">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            {canReturnToAdmitFormat && (
              <button
                type="button"
                onClick={() => navigate(returnTo)}
                className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 transition-colors hover:bg-orange-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Admit Format
              </button>
            )}
            <p className="text-xs uppercase tracking-[0.24em] font-bold text-orange-600">Templates</p>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mt-1">
              <ActiveIcon className="text-orange-500" /> {activeMeta.title}
            </h1>
            <p className="text-gray-500 text-sm mt-1">{activeMeta.description}</p>
          </div>
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {TEMPLATE_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  setActiveType(type.id)
                  setSearchParams(returnTo ? { type: type.id, returnTo } : { type: type.id })
                }}
                className={`h-10 px-4 rounded-lg text-sm font-semibold transition-all ${
                  activeType === type.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Start a design</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {renderTemplateCard({ isBlank: true })}
              {systemTemplates.map((template) => (
                <React.Fragment key={template._id}>{renderTemplateCard({ template })}</React.Fragment>
              ))}
            </div>
          </div>

          {customTemplates.length > 0 && (
            <div className="pt-6 border-t border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Custom Templates</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {customTemplates.map((template) => (
                  <React.Fragment key={template._id}>{renderTemplateCard({ template })}</React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {isEditorOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={closeEditor} />
            <div className="flex min-h-full items-center justify-center p-4 relative z-10">
              <div className="w-full max-w-7xl transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">
                    {editingTemplate && !editingTemplate.isSystemDefault ? 'Edit Template' : 'Create Custom Template'}
                  </h3>
                  <button onClick={closeEditor} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-gray-50/50">
                  <div className="flex-1 p-6 overflow-y-auto hover-scroll">
                    <form id="templateForm" onSubmit={handleSave} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="block">
                          <span className="text-sm font-semibold text-gray-700">Template Name</span>
                          <input
                            type="text"
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                            placeholder="e.g. Health Dept Template"
                          />
                        </label>

                        <div>
                          <span className="text-sm font-semibold text-gray-700">Template For</span>
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            {TEMPLATE_TYPES.map((type) => (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => updateTemplateType(type.id)}
                                className={`h-11 rounded-lg border px-3 text-sm font-semibold transition-all ${
                                  form.templateType === type.id
                                    ? 'border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300 hover:text-orange-600'
                                }`}
                              >
                                {type.id === 'admit_card' ? 'Admit Card' : 'Attendance Sheet'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-sm font-semibold text-gray-700">Base Structure</span>
                          <div className="mt-1 grid grid-cols-3 gap-2">
                            {BASE_LAYOUTS.map((layout) => (
                              <button
                                key={layout.id}
                                type="button"
                                onClick={() => setForm({ ...form, baseLayout: layout.id })}
                                className={`h-11 rounded-lg border px-3 text-sm font-semibold transition-all ${
                                  form.baseLayout === layout.id
                                    ? 'border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300 hover:text-orange-600'
                                }`}
                              >
                                {layout.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-sm font-semibold text-gray-700">Orientation</span>
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            {['portrait', 'landscape'].map((ori) => (
                              <button
                                key={ori}
                                type="button"
                                onClick={() => setForm({ ...form, orientation: ori })}
                                className={`h-11 rounded-lg border px-3 text-sm font-semibold capitalize transition-all ${
                                  (form.orientation || 'portrait') === ori
                                    ? 'border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300 hover:text-orange-600'
                                }`}
                              >
                                {ori}
                              </button>
                            ))}
                          </div>
                        </div>

                        <label className="block">
                          <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Palette size={16} /> Brand Color
                          </span>
                          <div className="flex items-center gap-3 mt-1">
                            <input
                              type="color"
                              value={form.primaryColor}
                              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                              className="h-10 w-14 p-1 rounded border border-gray-200 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={form.primaryColor}
                              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none uppercase"
                            />
                          </div>
                        </label>
                      </div>

                      <div className="space-y-4">
                        <label className="block">
                          <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <ImageIcon size={16} /> Logo URL
                          </span>
                          <input
                            type="url"
                            value={form.logoUrl}
                            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                            placeholder="https://.../logo.png"
                          />
                          <p className="text-[11px] text-gray-500 mt-1">Leave blank to use the default mark.</p>
                        </label>

                        <label className="block">
                          <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <ImageIcon size={16} /> Watermark URL
                          </span>
                          <input
                            type="url"
                            value={form.watermarkUrl}
                            onChange={(e) => setForm({ ...form, watermarkUrl: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                            placeholder="https://.../watermark.png"
                          />
                          <p className="text-[11px] text-gray-500 mt-1">Displays faintly behind the document.</p>
                        </label>
                      </div>

                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-orange-100 bg-orange-50/40 p-4">
                        <label className="block">
                          <span className="text-sm font-semibold text-gray-700">Organization / Commission Name</span>
                          <input
                            type="text"
                            value={form.organizationName}
                            onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                            placeholder="e.g. Jharkhand Staff Selection Commission"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm font-semibold text-gray-700">Local / Secondary Name</span>
                          <input
                            type="text"
                            value={form.organizationNameLocal}
                            onChange={(e) => setForm({ ...form, organizationNameLocal: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                            placeholder="Optional secondary name"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm font-semibold text-gray-700">Document Title</span>
                          <input
                            type="text"
                            value={form.documentTitle}
                            onChange={(e) => setForm({ ...form, documentTitle: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                            placeholder={form.templateType === 'attendance_sheet' ? 'ATTENDANCE SHEET' : 'Admit Card'}
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm font-semibold text-gray-700">Seal / Logo Fallback Text</span>
                          <input
                            type="text"
                            value={form.sealText}
                            onChange={(e) => setForm({ ...form, sealText: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                            placeholder="e.g. JSSC"
                          />
                        </label>

                        {form.templateType === 'admit_card' && (
                          <>
                            <label className="block md:col-span-2">
                              <span className="text-sm font-semibold text-gray-700">Provisional Note</span>
                              <textarea
                                value={form.provisionalNote}
                                onChange={(e) => setForm({ ...form, provisionalNote: e.target.value })}
                                rows={3}
                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                                placeholder="Printed below candidate details on the admit card"
                              />
                            </label>

                            <label className="block md:col-span-2">
                              <span className="text-sm font-semibold text-gray-700">Instruction Page Heading</span>
                              <input
                                type="text"
                                value={form.instructionHeading}
                                onChange={(e) => setForm({ ...form, instructionHeading: e.target.value })}
                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                                placeholder="Printed at the top of the instructions page"
                              />
                            </label>

                            <label className="block">
                              <span className="text-sm font-semibold text-gray-700">Photo Box Text</span>
                              <textarea
                                value={form.photoBoxText}
                                onChange={(e) => setForm({ ...form, photoBoxText: e.target.value })}
                                rows={4}
                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                                placeholder="One line per row in the photo box"
                              />
                            </label>

                            <label className="block">
                              <span className="text-sm font-semibold text-gray-700">Controller / Authority Title</span>
                              <input
                                type="text"
                                value={form.controllerTitle}
                                onChange={(e) => setForm({ ...form, controllerTitle: e.target.value })}
                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                                placeholder="e.g. Examination Controller"
                              />
                            </label>
                          </>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label className="block">
                          <span className="text-sm font-semibold text-gray-700">
                            {form.templateType === 'attendance_sheet' ? 'Attendance Sheet Bottom Instructions' : 'Admit Card Candidate Instructions'}
                          </span>
                          <textarea
                            value={form.instructions}
                            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                            rows={4}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                            placeholder={
                              form.templateType === 'attendance_sheet'
                                ? 'Printed at the bottom of the attendance sheet...'
                                : 'Printed on the admit card instructions page...'
                            }
                          />
                        </label>
                      </div>

                    </div>
                  </form>
                </div>
                <div className="w-full lg:w-[450px] xl:w-[500px] bg-gray-200/50 border-t lg:border-t-0 lg:border-l border-gray-200 p-6 flex flex-col items-center overflow-y-auto hover-scroll">
                  <div className="sticky top-0">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex items-start justify-center p-4">
                      {renderPreview(
                        form,
                        form.templateType === 'attendance_sheet'
                          ? (form.orientation === 'landscape' ? 0.45 : 0.75)
                          : (form.orientation === 'landscape' ? 0.45 : 0.65)
                      )}
                    </div>
                  </div>
                </div>
              </div>

                <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={closeEditor}>
                    Cancel
                  </Button>
                  <Button type="submit" form="templateForm" className="bg-orange-500 hover:bg-orange-600 text-white">
                    Save Template
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <ConfirmActionModal
        isOpen={Boolean(deleteTemplateId)}
        onClose={() => setDeleteTemplateId('')}
        onConfirm={confirmDeleteTemplate}
        title="Delete Template"
        message="Delete this custom template? Existing schedules will keep their saved copy."
        confirmLabel="Delete Template"
        tone="red"
      />
    </AdminLayout>
  )
}

export default AdmitCardTemplates

