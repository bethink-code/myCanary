import { ReactNode } from "react";

/**
 * Pinned action bar at the bottom of the viewport.
 * Use this for primary actions on any page with scrollable content.
 */
export default function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
        {children}
      </div>
    </div>
  );
}
