import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Share2, X, Copy, Check, MessageCircle, Mail, Twitter, Linkedin } from 'lucide-react'

/**
 * ShareJobButton — icon-only trigger, popup centered on screen
 *
 * Props:
 *   job      — { _id, title, department, postCode }
 *   className — extra classes on trigger
 */
const ShareJobButton = ({ job, className = '' }) => {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const jobUrl = `${window.location.origin}/jobs/${job._id}`
  const shareText = `🏛️ ${job.title}${job.department ? ` — ${job.department}` : ''}\nApply now: ${jobUrl}`

  const handleOpen = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setOpen(true)
    setCopied(false)
  }

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onKey  = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jobUrl)
    } catch {
      const el = document.createElement('textarea')
      el.value = jobUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const channels = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      Icon: MessageCircle,
      bg: 'bg-[#25D366]/10 hover:bg-[#25D366]/20',
      color: 'text-[#25D366]',
      href: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
    },
    {
      id: 'twitter',
      label: 'Twitter/X',
      Icon: Twitter,
      bg: 'bg-gray-100 hover:bg-gray-200',
      color: 'text-gray-800',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      Icon: Linkedin,
      bg: 'bg-[#0077B5]/10 hover:bg-[#0077B5]/20',
      color: 'text-[#0077B5]',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`,
    },
    {
      id: 'email',
      label: 'Email',
      Icon: Mail,
      bg: 'bg-orange-50 hover:bg-orange-100',
      color: 'text-orange-500',
      href: `mailto:?subject=${encodeURIComponent(`Job: ${job.title}`)}&body=${encodeURIComponent(shareText)}`,
    },
  ]

  const modal = open
    ? createPortal(
        // Backdrop — covers full screen, centered popup
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
          onMouseDown={() => setOpen(false)}
        >
          {/* Popup card — stop propagation so clicking inside doesn't close */}
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Orange header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                  Share this Job
                </p>
                <p className="text-white font-black text-base leading-snug line-clamp-2">
                  {job.title}
                </p>
                {job.department && (
                  <p className="text-white/70 text-xs mt-0.5 truncate">{job.department}</p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Share channels */}
              <div className="grid grid-cols-4 gap-3">
                {channels.map(({ id, label, Icon, bg, color, href }) => (
                  <a
                    key={id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className={`flex flex-col items-center gap-2 py-3 px-1 rounded-xl border border-transparent transition-all ${bg}`}
                  >
                    <Icon className={`w-6 h-6 ${color}`} />
                    <span className="text-[10px] font-semibold text-gray-500 text-center leading-tight">
                      {label}
                    </span>
                  </a>
                ))}
              </div>

              {/* Copy link */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Or copy link
                </p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                  <p className="flex-1 text-xs text-gray-500 truncate font-mono min-w-0">
                    {jobUrl}
                  </p>
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${
                      copied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                  >
                    {copied
                      ? <><Check className="w-3 h-3" /> Copied!</>
                      : <><Copy className="w-3 h-3" /> Copy</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      {/* Icon-only trigger — sits top-right of the card */}
      <button
        onClick={handleOpen}
        title="Share this job"
        className={`w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 border border-transparent hover:border-orange-200 transition-all ${className}`}
      >
        <Share2 className="w-4 h-4" />
      </button>
      {modal}
    </>
  )
}

export default ShareJobButton
