import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-warmwhite rounded-2xl border border-beige-300 shadow-2xl max-w-md w-full overflow-hidden my-auto animate-fade-in">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-full flex-shrink-0 ${
                isDestructive ? 'bg-red-100 text-red-700' : 'bg-olive-100 text-olive-800'
              }`}
            >
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-base text-burgundy-950 mb-1 font-arabic">{title}</h3>
              <p className="text-xs text-charcoal-600 leading-relaxed">{description}</p>
            </div>
            <button
              onClick={onCancel}
              className="text-charcoal-400 hover:text-charcoal-700 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-charcoal-700 hover:bg-beige-100 rounded-lg transition-colors"
            >
              {cancelLabel || t.cancel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all text-white disabled:opacity-50 ${
                isDestructive
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-burgundy-600 hover:bg-burgundy-700'
              }`}
            >
              {isLoading ? 'جاري التنفيذ...' : confirmLabel || t.yesProceed}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
