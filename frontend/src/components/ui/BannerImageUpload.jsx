import { useRef, useState } from 'react'
import { Upload, X, ImageIcon, Loader2, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminService } from '../../services/admin.service'

const BannerImageUpload = ({
  value,
  size = 0,
  onChange,
  className = '',
  variant = 'banner',
}) => {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const isLogo = variant === 'logo'

  const handleFile = async (file) => {
    if (!file) return

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
      toast.success(isLogo ? 'Project logo uploaded' : 'Banner image uploaded')
    } catch (err) {
      toast.error(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
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
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />

      {value ? (
        <div
          className={`group relative overflow-hidden rounded-xl border border-gray-200 ${
            isLogo
              ? 'flex min-h-36 items-center justify-center bg-gradient-to-br from-white to-orange-50/50 p-5'
              : ''
          }`}
        >
          <div
            className={
              isLogo
                ? 'flex h-24 w-24 items-center justify-center rounded-3xl border border-orange-200 bg-white p-3 shadow-sm ring-1 ring-black/5'
                : ''
            }
          >
            <img
              src={value}
              alt={isLogo ? 'Project logo preview' : 'Banner preview'}
              className={
                isLogo
                  ? 'h-full w-full object-contain'
                  : 'h-44 w-full object-cover'
              }
            />
          </div>

          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-lg transition-colors hover:bg-orange-50"
            >
              <Upload className="h-3.5 w-3.5" />
              Change
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-lg transition-colors hover:bg-red-50"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>

          <div className="absolute right-2 top-2 flex items-center gap-1">
            {size > 0 && (
              <div className="rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                {(size / 1024).toFixed(1)} KB
              </div>
            )}
            <div className="flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-bold text-white">
              <CheckCircle2 className="h-3 w-3" />
              Uploaded
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all duration-200 ease-out ${
            isLogo ? 'h-36' : 'h-44'
          } ${
            dragOver
              ? 'scale-[1.01] border-orange-400 bg-orange-50'
              : uploading
                ? 'cursor-not-allowed border-gray-200 bg-gray-50'
                : 'cursor-pointer border-gray-200 bg-gray-50 hover:border-orange-400 hover:bg-orange-50'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <p className="text-sm font-medium text-gray-600">Uploading...</p>
            </>
          ) : (
            <>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                  dragOver ? 'bg-orange-100' : 'bg-gray-100'
                }`}
              >
                {dragOver ? (
                  <Upload className="h-6 w-6 text-orange-500" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">
                  {dragOver
                    ? 'Drop to upload'
                    : `Click to upload ${isLogo ? 'project logo' : 'banner image'}`}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">or drag and drop here</p>
              </div>
              <p className="px-3 text-center text-[10px] text-gray-400">
                {isLogo
                  ? 'Recommended square PNG/WebP with transparent or white background'
                  : 'Recommended 1920x480px JPG, PNG, WebP - Max 5 MB'}
              </p>
            </>
          )}
        </button>
      )}
    </div>
  )
}

export default BannerImageUpload
