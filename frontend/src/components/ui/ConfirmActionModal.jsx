import { AlertTriangle, X } from "lucide-react";
import Button from "./Button";

const ConfirmActionModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Please confirm this action.",
  confirmLabel = "Confirm",
  tone = "orange",
  icon: Icon = AlertTriangle,
}) => {
  if (!isOpen) return null;

  const toneClass =
    tone === "red"
      ? {
          icon: "bg-red-50 text-red-600 border-red-100",
          button: "bg-red-600 hover:bg-red-700 text-white",
        }
      : {
          icon: "bg-orange-50 text-orange-600 border-orange-100",
          button: "bg-orange-600 hover:bg-orange-700 text-white",
        };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-md">
      <div
        className="w-full max-w-md overflow-hidden rounded-[24px] border border-orange-50 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border ${toneClass.icon}`}
              >
                <Icon className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                  {message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/80 px-7 py-5">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl border-gray-200 px-6 py-2.5 font-semibold text-gray-700 shadow-sm hover:bg-white hover:text-gray-900"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className={`rounded-xl border border-transparent px-6 py-2.5 font-semibold ${toneClass.button}`}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmActionModal;
