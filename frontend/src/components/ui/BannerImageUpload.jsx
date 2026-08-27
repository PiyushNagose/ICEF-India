import { useRef, useState } from 'react'
import { Upload, X, ImageIcon, Loader2, CheckCircle2 } from 'lucide-react'
import { adminService } from '../../services/admin.service'
import toast from 'react-hot-toast'

/**
 * BannerImageUpload
 *
 * Props:
 *   size       — current image size in bytes
 *   onChange   — (url: string, size: number) => void   called after successful upload or on clear
 *   className  — extra wrapper classes
 */
const BannerImageUpload = ({ value, size = 0, onChange, className = '' }) => {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file) => {
    if (!file) return

    // Validate
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed (JPG, PNG, WebP)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB')
      return
    }

    setUploading(true)
    try {
      const result = await adminService.uploadCmsBannerImage(file)
      onChange(result.url || result.secure_url || '', result.size || file.size || 0)
      toast.success('Banner image uploaded')
    } catch (err) {
      toast.error(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // reset so same file can be re-selected
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('', 0)
  }

  return (
    <div className={className}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />

      {value ? (
        /* ── Preview ── */
        <div className="relative rounded-xl overflow-hidden border border-gray-200 group">
          <img
            src={value}
            alt="Banner preview"
            className="w-full h-44 object-cover"
          />
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 bg-white text-gray-800 text-xs font-semibold px-3 py-2 rounded-lg shadow-lg hover:bg-orange-50 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Change
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1.5 bg-white text-red-600 text-xs font-semibold px-3 py-2 rounded-lg shadow-lg hover:bg-red-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Remove
            </button>
          </div>
          {/* Uploaded badge */}
          <div className="absolute top-2 right-2 flex items-center gap-1">
            {size > 0 && (
              <div className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full">
                {(size / 1024).toFixed(1)} KB
              </div>
            )}
            <div className="flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Uploaded
            </div>
          </div>
        </div>
      ) : (
        /* ── Drop zone ── */
        <button
          type="button"
          disabled={uploading}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`w-full h-44 rounded-xl border-2 border-dashed transition-all duration-200 ease-out flex flex-col items-center justify-center gap-3
            ${dragOver
              ? 'border-orange-400 bg-orange-50 scale-[1.01]'
              : uploading
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                : 'border-gray-200 bg-gray-50 hover:border-orange-400 hover:bg-orange-50 cursor-pointer'
            }`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              <p className="text-sm font-medium text-gray-600">Uploading...</p>
            </>
          ) : (
            <>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${dragOver ? 'bg-orange-100' : 'bg-gray-100'}`}>
                {dragOver
                  ? <Upload className="w-6 h-6 text-orange-500" />
                  : <ImageIcon className="w-6 h-6 text-gray-400" />
                }
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">
                  {dragOver ? 'Drop to upload' : 'Click to upload banner image'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  or drag & drop here
                </p>
              </div>
              <p className="text-[10px] text-gray-400">
                Recommended 1920×480px · JPG, PNG, WebP · Max 5 MB
              </p>
            </>
          )}
        </button>
      )}
    </div>
  )
}

export default BannerImageUpload
