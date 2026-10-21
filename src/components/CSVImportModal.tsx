import React, { useState } from 'react';
import type { CSVImportRow, Guest } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { bulkImportGuests } from '../services/firestore';
import { normalizeKuwaitPhone } from '../utils/helpers';
import { EVENT_DETAILS } from '../utils/constants';
import { Upload, FileText, CheckCircle2, AlertTriangle, X, Download, Users } from 'lucide-react';

interface CSVImportModalProps {
  existingGuests: Guest[];
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  existingGuests,
  onClose,
  onSuccess,
}) => {
  const { t, language } = useLanguage();
  const { adminUser } = useAuth();
  const [parsedRows, setParsedRows] = useState<CSVImportRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const remainingCapacity = Math.max(0, EVENT_DETAILS.capacity - existingGuests.length);

  // Parse CSV text preserving Arabic UTF-8
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        // Split into lines
        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
        if (lines.length < 2) {
          setErrorMsg('الملف فارغ أو لا يحتوي على صفوف بيانات كافية (CSV file is empty or missing headers)');
          return;
        }

        // Header detection
        const headerLine = lines[0].toLowerCase();
        const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));

        const nameIndex = headers.findIndex((h) => h.includes('name') || h.includes('اسم') || h.includes('guest_name'));
        const phoneIndex = headers.findIndex((h) => h.includes('phone') || h.includes('هاتف') || h.includes('جوال') || h.includes('رقم'));
        const numberIndex = headers.findIndex((h) => h.includes('number') || h.includes('رقم_الضيف') || h.includes('guest_number'));

        if (nameIndex === -1) {
          setErrorMsg('لم يتم العثور على عمود اسم الضيف (guest_name) في ملف CSV');
          return;
        }

        const rows: CSVImportRow[] = [];
        const seenNamesInFile = new Map<string, number>();

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Parse CSV line handling potential quotes
          const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
          const matches: string[] = [];
          let match;
          while ((match = regex.exec(line)) !== null && matches.length < headers.length + 5) {
            let val = match[1] || '';
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1).replace(/""/g, '"');
            }
            matches.push(val.trim());
          }

          const guestName = (matches[nameIndex] || '').trim();
          const phone = phoneIndex !== -1 ? (matches[phoneIndex] || '').trim() : '';
          const guestNumber = numberIndex !== -1 ? matches[numberIndex] : i;

          const errors: string[] = [];
          if (!guestName) {
            errors.push('الاسم مطلوب (Name is required)');
          }

          // Phone validation if present
          if (phone) {
            const norm = normalizeKuwaitPhone(phone);
            if (!norm.isValid) {
              errors.push(norm.error || 'رقم هاتف غير صالح');
            }
          }

          // Duplicate detection warning (without discarding)
          if (guestName) {
            const count = (seenNamesInFile.get(guestName.toLowerCase()) || 0) + 1;
            seenNamesInFile.set(guestName.toLowerCase(), count);
            if (count > 1) {
              errors.push(`تنبيه: هذا الاسم مكرر في الملف (${count} مرات) — سيتم حفظه كضيف منفصل`);
            }

            // Check against existing database guests
            const existsInDb = existingGuests.some((g) => g.guestName.toLowerCase() === guestName.toLowerCase());
            if (existsInDb) {
              errors.push('تنبيه: هذا الاسم موجود مسبقاً في قائمة الضيوف — سيتم حفظه كضيف منفصل');
            }
          }

          rows.push({
            guest_number: guestNumber,
            guest_name: guestName,
            phone,
            isValid: guestName.length > 0,
            errors,
          });
        }

        setParsedRows(rows);
      } catch (err) {
        console.error('Error reading CSV:', err);
        setErrorMsg('حدث خطأ أثناء معالجة ملف CSV. تأكد من سلامة ترميز UTF-8.');
      }
    };

    // Explicit UTF-8 reading to maintain Arabic text properly
    reader.readAsText(file, 'UTF-8');
  };

  // Download Sample Template CSV
  const handleDownloadSample = () => {
    const csvContent = '\uFEFFguest_number,guest_name,phone\n' +
      '1,عبدالرحمن فهد العتيبي,+96599123456\n' +
      '2,مشعل خالد الصباح,+96566234567\n' +
      '3,د. ناصر عبدالله المطيري,\n' +
      '4,فيصل سعود العجمي,+96555345678\n' +
      '5,أحمد يوسف الهاجري,\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_guests_template_kuwait.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Execute Import
  const handleCommitImport = async () => {
    if (!adminUser) return;
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    if (validRows.length > remainingCapacity) {
      setErrorMsg(`لا يمكن استيراد ${validRows.length} ضيف. المقاعد المتبقية في الحفل هي ${remainingCapacity} فقط.`);
      return;
    }

    setIsImporting(true);
    setErrorMsg(null);

    try {
      const result = await bulkImportGuests(validRows, adminUser);
      onSuccess(result.added);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`فشل الاستيراد: ${msg}`);
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-warmwhite rounded-2xl border border-beige-300 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-fade-in">
        {/* Modal Header */}
        <div className="bg-burgundy-950 text-beige-50 p-4 flex items-center justify-between border-b border-burgundy-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-olive-400" />
            <div>
              <h3 className="font-bold text-sm sm:text-base text-beige-100 font-arabic">
                {language === 'ar' ? 'استيراد كشف الضيوف من ملف (CSV)' : 'Bulk Guest Import from CSV'}
              </h3>
              <p className="text-[11px] text-beige-300/80">
                {language === 'ar' ? 'السعة المتبقية:' : 'Remaining capacity:'} {remainingCapacity} {language === 'ar' ? 'من أصل 125' : 'of 125'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-beige-300 hover:text-white p-1 rounded-lg hover:bg-burgundy-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* File Upload Box */}
          <div className="border-2 border-dashed border-beige-400 hover:border-burgundy-500 rounded-xl p-6 text-center bg-white/70 transition-all">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-file-input"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center">
              <Upload className="w-10 h-10 text-olive-700 mb-2" />
              <span className="font-bold text-sm text-charcoal-900">
                {fileName || (language === 'ar' ? 'اضغط لاختيار ملف CSV أو اسحبه هنا' : 'Choose CSV file or drag here')}
              </span>
              <span className="text-xs text-charcoal-500 mt-1">
                {language === 'ar' ? 'الأعمدة المطلوبة: guest_number, guest_name, phone' : 'Columns: guest_number, guest_name, phone'}
              </span>
            </label>
          </div>

          {/* Download Sample & Requirements info */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-beige-100/70 border border-beige-300 rounded-lg text-xs">
            <span className="text-charcoal-700">
              {language === 'ar'
                ? '• يدعم اللغة العربية بالكامل • رقم الهاتف اختياري • يحافظ على ترتيب الصفوف'
                : '• Full Arabic UTF-8 support • Phone optional • Preserves row order'}
            </span>
            <button
              onClick={handleDownloadSample}
              className="flex items-center gap-1 text-burgundy-800 hover:text-burgundy-900 font-semibold underline"
            >
              <Download className="w-3.5 h-3.5 text-olive-700" />
              <span>{language === 'ar' ? 'تحميل نموذج CSV تجريبي' : 'Download CSV Template'}</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Table if rows parsed */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-charcoal-800">
                <span>
                  {language === 'ar' ? `معاينة السجلات (${parsedRows.length} سجل)` : `Preview Records (${parsedRows.length} rows)`}
                </span>
                <span className="text-emerald-700">
                  {language === 'ar' ? `الصالح للاستيراد: ${validCount}` : `Valid: ${validCount}`}
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto border border-beige-300 rounded-lg bg-white">
                <table className="w-full text-xs text-right">
                  <thead className="bg-beige-100 text-charcoal-700 border-b border-beige-300 sticky top-0 font-semibold">
                    <tr>
                      <th className="p-2 w-12 text-center">#</th>
                      <th className="p-2">اسم الضيف</th>
                      <th className="p-2">الهاتف</th>
                      <th className="p-2">الحالة والتحقق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-beige-200">
                    {parsedRows.map((row, idx) => {
                      const hasWarning = row.errors.some((e) => e.startsWith('تنبيه'));
                      const hasError = !row.isValid;
                      return (
                        <tr key={idx} className={hasError ? 'bg-red-50/50' : hasWarning ? 'bg-amber-50/30' : ''}>
                          <td className="p-2 text-center text-charcoal-500 font-mono">
                            {row.guest_number || idx + 1}
                          </td>
                          <td className="p-2 font-medium text-burgundy-950">{row.guest_name || '—'}</td>
                          <td className="p-2 font-mono text-charcoal-600" dir="ltr">
                            {row.phone || '—'}
                          </td>
                          <td className="p-2">
                            {hasError ? (
                              <span className="text-red-700 text-[11px] flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-red-600" />
                                {row.errors.join(', ')}
                              </span>
                            ) : hasWarning ? (
                              <span className="text-amber-700 text-[11px] flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                {row.errors.join(', ')}
                              </span>
                            ) : (
                              <span className="text-emerald-700 text-[11px] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                جاهز للحفظ
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-beige-50 p-4 border-t border-beige-300 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-charcoal-700 hover:bg-beige-100 rounded-lg transition-colors"
          >
            {t.cancel}
          </button>

          <button
            onClick={handleCommitImport}
            disabled={isImporting || validCount === 0 || validCount > remainingCapacity}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-burgundy-600 hover:bg-burgundy-700 text-white rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {isImporting ? (
              <span>جاري حفظ {validCount} سجل في قاعدة البيانات...</span>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>
                  {language === 'ar' ? `استيراد ${validCount} ضيف الآن` : `Import ${validCount} Guests Now`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
