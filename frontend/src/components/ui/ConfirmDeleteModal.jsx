import { useState } from "react";
import { AlertTriangle, X, Trash2 } from "lucide-react";
import Button from "./Button";

/**
 * A mandatory theme-compliant confirmation modal for hard deletion.
 */
const ConfirmDeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  message = "This action is permanent and cannot be undone.",
  requireType = true,
}) => {
  const [inputText, setInputText] = useState("");
  const isMatch = inputText === "DELETE";

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireType && !isMatch) return;
    onConfirm();
    setInputText("");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md transition-all duration-300">
      <div
        className="w-full max-w-md bg-white rounded-[24px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-red-50"
        role="dialog"
      >
        <div className="p-7">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-red-50 text-red-600 rounded-[18px] flex items-center justify-center shrink-0 border border-red-100">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{message}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0 -mt-1 -mr-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {requireType && (
            <div className="mt-7">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To confirm, please type <span className="font-bold text-red-600 select-all">DELETE</span> below:
              </label>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-red-500/15 focus:border-red-500 transition-all font-mono tracking-widest text-center uppercase text-gray-900 font-bold bg-gray-50/50"
              />
            </div>
          )}
        </div>

        <div className="px-7 py-5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl font-semibold px-6 py-2.5 border-gray-200 hover:bg-white text-gray-700 hover:text-gray-900 shadow-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={requireType && !isMatch}
            className={`rounded-xl font-semibold px-6 py-2.5 transition-all duration-200 ${
              requireType && !isMatch
                ? "bg-gray-100 hover:bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                : "bg-red-600 hover:bg-red-700 text-white shadow-[0_4px_14px_0_rgba(220,38,38,0.39)] border border-transparent hover:-translate-y-0.5"
            }`}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Permanently
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
