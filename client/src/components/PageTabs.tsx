import { ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
}

interface PageTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

/** Consistent text tabs with underline. Use on every action/import page. */
export default function PageTabs({ tabs, activeTab, onChange }: PageTabsProps) {
  return (
    <div className="flex gap-6 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === tab.id
              ? "border-primary text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
