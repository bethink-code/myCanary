import { ReactNode } from "react";

/** Consistent error display box. Use instead of inline red alert divs. */
export default function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
      {children}
    </div>
  );
}
