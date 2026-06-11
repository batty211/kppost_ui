import { CheckCircle2, CircleAlert, Download, Upload } from 'lucide-react';

import type { ActionStatus } from '../types/app';

interface PreparationCompleteModalProps {
  batchName: string;
  onClose: () => void;
  onPreview: (batchName: string) => void;
}

export function PreparationCompleteModal({
  batchName,
  onClose,
  onPreview,
}: PreparationCompleteModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Preparation Complete</h3>
            <p className="text-sm text-gray-400">Successfully prepared {batchName}</p>
          </div>
        </div>
        <p className="text-gray-300 mb-8 leading-relaxed">
          The batch content is ready for review. Would you like to go to the preparation preview page now?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-800 text-gray-400 font-bold hover:bg-gray-800 transition-colors"
          >
            Maybe Later
          </button>
          <button
            onClick={() => onPreview(batchName)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all"
          >
            Yes, Preview
          </button>
        </div>
      </div>
    </div>
  );
}

interface NewPostModalProps {
  onClose: () => void;
  rawSourceName: string;
  selectedDate: string;
  selectedTime: string;
  departments: Array<{ code: string; name: string }>;
  selectedDepartmentCode: string;
  isSubmitting: boolean;
  helperMessage?: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onSubmit: () => void;
}

export function NewPostModal({
  onClose,
  rawSourceName,
  selectedDate,
  selectedTime,
  departments,
  selectedDepartmentCode,
  isSubmitting,
  helperMessage,
  onDateChange,
  onTimeChange,
  onDepartmentChange,
  onSubmit,
}: NewPostModalProps) {
  const hasDepartments = departments.length > 0;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <h3 className="text-lg font-bold mb-2">New Post</h3>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          Create a raw post folder inside <span className="font-semibold text-gray-200">{rawSourceName}</span>.
        </p>
        <div className="space-y-4">
          <label className="block">
            <div className="mb-2 text-xs font-bold uppercase text-gray-500">Date</div>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => onDateChange(event.target.value)}
              className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block">
            <div className="mb-2 text-xs font-bold uppercase text-gray-500">Time</div>
            <input
              type="time"
              value={selectedTime}
              onChange={(event) => onTimeChange(event.target.value)}
              className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block">
            <div className="mb-2 text-xs font-bold uppercase text-gray-500">Department</div>
            {hasDepartments ? (
              <select
                value={selectedDepartmentCode}
                onChange={(event) => onDepartmentChange(event.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="" disabled>
                  Select department
                </option>
                {departments.map((department) => (
                  <option key={department.code} value={department.code}>
                    {department.name ? `${department.code} - ${department.name}` : department.code}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={selectedDepartmentCode}
                onChange={(event) => onDepartmentChange(event.target.value)}
                placeholder="department-code"
                className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            )}
          </label>
          {helperMessage ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100">
              {helperMessage}
            </div>
          ) : null}
        </div>
        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-800 text-gray-400 font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting || !selectedDate || !selectedTime || !selectedDepartmentCode}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ImagePreviewModalProps {
  imageUrl: string;
  onClose: () => void;
}

export function ImagePreviewModal({ imageUrl, onClose }: ImagePreviewModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8 cursor-pointer"
      onClick={onClose}
    >
      <img src={imageUrl} className="max-w-full max-h-full object-contain shadow-2xl" alt="Preview" />
    </div>
  );
}

interface CanvaExportModalProps {
  batchName: string;
  outputPath: string;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CanvaExportModal({
  batchName,
  outputPath,
  isLoading,
  onClose,
  onConfirm,
}: CanvaExportModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
            <Download size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Export for Canva</h3>
            <p className="text-sm text-gray-400">Create the 2 Canva Sheet workbooks for {batchName}</p>
          </div>
        </div>
        <div className="space-y-4 text-sm text-gray-300">
          <p>
            This export will create a batch-specific folder under <span className="font-semibold text-gray-100">Canvas</span> so it is easy to track which files belong to this batch.
          </p>
          <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Export Folder</div>
            <div className="break-all font-mono text-xs text-blue-300">{outputPath}</div>
          </div>
        </div>
        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-gray-800 px-4 py-2.5 font-bold text-gray-400 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Exporting...' : 'Export for Canva'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CanvaImportModalProps {
  batchName: string;
  featureZip: File | null;
  newsWatermarkZip: File | null;
  isLoading: boolean;
  onClose: () => void;
  onFeatureChange: (file: File | null) => void;
  onNewsWatermarkChange: (file: File | null) => void;
  onConfirm: () => void;
}

function FilePicker({
  label,
  file,
  helper,
  onChange,
}: {
  label: string;
  file: File | null;
  helper: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block rounded-xl border border-gray-800 bg-black/20 p-4">
      <div className="mb-2 text-sm font-semibold text-gray-100">{label}</div>
      <input
        type="file"
        accept=".zip,application/zip"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-800 file:px-3 file:py-2 file:font-semibold file:text-gray-200 hover:file:bg-gray-700"
      />
      <div className="mt-2 text-xs text-gray-500">{file ? file.name : helper}</div>
    </label>
  );
}

export function CanvaImportModal({
  batchName,
  featureZip,
  newsWatermarkZip,
  isLoading,
  onClose,
  onFeatureChange,
  onNewsWatermarkChange,
  onConfirm,
}: CanvaImportModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <Upload size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Import from Canva</h3>
            <p className="text-sm text-gray-400">Upload the 2 Canva ZIP downloads back into {batchName}</p>
          </div>
        </div>
        <div className="mb-6 rounded-xl border border-gray-800 bg-black/20 p-4 text-sm leading-relaxed text-gray-300">
          After Bulk Create in Canva, download the results for both designs as ZIP files. This import will replace the prepared images in the current batch and then you can continue with <span className="font-semibold text-gray-100">Generate</span>.
        </div>
        <div className="space-y-4">
          <FilePicker
            label="Feature ZIP"
            file={featureZip}
            helper="ZIP downloaded from the Feature Image Canva design."
            onChange={onFeatureChange}
          />
          <FilePicker
            label="News Watermark ZIP"
            file={newsWatermarkZip}
            helper="ZIP downloaded from the News Watermark Canva design."
            onChange={onNewsWatermarkChange}
          />
        </div>
        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-gray-800 px-4 py-2.5 font-bold text-gray-400 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading || !featureZip || !newsWatermarkZip}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Importing...' : 'Import from Canva'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ActionStatusToastProps extends ActionStatus {
  onClose: () => void;
}

export function ActionStatusToast({ tone, title, message, onClose }: ActionStatusToastProps) {
  const toneClasses =
    tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
      : 'border-rose-500/30 bg-rose-500/10 text-rose-100';
  const Icon = tone === 'success' ? CheckCircle2 : CircleAlert;

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-[110]">
      <div className={`pointer-events-auto w-[28rem] rounded-2xl border p-4 shadow-2xl backdrop-blur-sm ${toneClasses}`}>
        <div className="flex items-start gap-3">
          <Icon size={20} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{title}</div>
            <div className="mt-1 text-sm leading-relaxed text-white/80">{message}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
