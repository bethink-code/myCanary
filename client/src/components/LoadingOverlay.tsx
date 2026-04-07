interface LoadingOverlayProps {
  message?: string;
  submessage?: string;
}

export default function LoadingOverlay({
  message = "Processing...",
  submessage,
}: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-sm mx-4 text-center space-y-4 shadow-xl">
        <div className="flex justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="font-medium text-slate-900">{message}</p>
        {submessage && (
          <p className="text-sm text-slate-500">{submessage}</p>
        )}
      </div>
    </div>
  );
}
