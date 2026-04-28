import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { apiRequest } from "../lib/queryClient";
import LoadingOverlay from "../components/LoadingOverlay";
import ErrorBox from "../components/ErrorBox";

/* ---------- types ---------- */

interface StepData {
  complete: boolean;
  count?: number;
  total?: number;
  missing?: string;
  description: string;
}

interface SetupStatus {
  setupComplete: boolean;
  steps: {
    products: StepData;
    suppliers: StepData;
    openingStock: StepData;
    reorderPoints: StepData;
    salesData: StepData;
  };
}

/* ---------- step config ---------- */

interface StepConfig {
  key: keyof SetupStatus["steps"];
  title: string;
  explanation: string;
  link: string;
  linkLabel: string;
  optional?: boolean;
}

const STEPS: StepConfig[] = [
  {
    key: "products",
    title: "Your Products",
    explanation:
      "Your product catalogue is the foundation. Every SKU, category, and pack size needs to be here.",
    link: "/settings?tab=products",
    linkLabel: "Review Products",
  },
  {
    key: "suppliers",
    title: "Your Suppliers",
    explanation:
      "Your manufacturers and their lead times. The canary uses these to calculate when to order.",
    link: "/settings?tab=manufacturers",
    linkLabel: "Update Manufacturers",
    optional: true,
  },
  {
    key: "openingStock",
    title: "Your Opening Stock",
    explanation:
      "Your starting stock levels. This is the baseline the canary measures everything against.",
    link: "/settings/opening-balance",
    linkLabel: "View Opening Balance",
  },
  {
    key: "reorderPoints",
    title: "Your Reorder Points",
    explanation:
      "The minimum stock level for each product. Without these, the canary can't warn you.",
    link: "/settings?tab=products",
    linkLabel: "Set Reorder Points",
  },
  {
    key: "salesData",
    title: "Your Sales Data",
    explanation:
      "Your sales history from Xero. This tells the canary how fast stock is moving.",
    link: "/sales/xero/import",
    linkLabel: "View Xero Import",
  },
  {
    key: "supplies",
    title: "Your Supplies",
    explanation:
      "Raw materials and packaging you supply to manufacturers. The canary tracks these alongside finished goods.",
    link: "/settings/supply-import",
    linkLabel: "Import Supplies",
  },
];

/* ---------- helpers ---------- */

function getStepStatus(step: StepData): "complete" | "in-progress" | "not-started" {
  if (step.complete) return "complete";
  // If there's any count > 0 or a missing field, work has started
  if ((step.count && step.count > 0) || step.missing) return "in-progress";
  return "not-started";
}

function StatusBadge({ status }: { status: "complete" | "in-progress" | "not-started" }) {
  switch (status) {
    case "complete":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-stock-in">
          <span>&#10003;</span> Complete
        </span>
      );
    case "in-progress":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-warning">
          <span>&#9888;</span> In Progress
        </span>
      );
    case "not-started":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
          <span>&#9675;</span> Not Started
        </span>
      );
  }
}

/* ---------- component ---------- */

export default function SetupJourney() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<SetupStatus>({
    queryKey: ["/api/setup/status"],
    queryFn: () => apiRequest("/api/setup/status"),
  });

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("/api/setup/complete", { method: "POST" }),
    onSuccess: () => navigate("/"),
  });

  if (isLoading) return <LoadingOverlay message="Loading setup status..." />;
  if (error) return <div className="p-6"><ErrorBox>Failed to load setup status: {(error as Error).message}</ErrorBox></div>;
  if (!data) return null;

  const allComplete = STEPS.every((cfg) => cfg.optional || data.steps[cfg.key].complete);

  function skipForNow() {
    localStorage.setItem("setup-skipped", "true");
    navigate("/dashboard");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Setup Journey</h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete these steps to get your canary watching over your stock.
          </p>
        </div>
        <button
          onClick={skipForNow}
          className="text-sm text-slate-500 hover:text-slate-700 underline"
        >
          Skip for now
        </button>
      </div>

      <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
        {STEPS.map((cfg, idx) => {
          const step = data.steps[cfg.key];
          const status = getStepStatus(step);

          return (
            <div key={cfg.key} className="px-5 py-4 space-y-1">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-sm font-semibold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      {cfg.title}
                      {cfg.optional && (
                        <span className="ml-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
                          Optional
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {step.complete || status === "in-progress"
                        ? step.description
                        : cfg.explanation}
                    </p>
                  </div>
                </div>
                <StatusBadge status={status} />
              </div>
              <div className="pl-10">
                <Link
                  to={cfg.link}
                  className="text-sm font-medium text-brand-primary hover:underline"
                >
                  {cfg.linkLabel} &rarr;
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {allComplete && (
        <div className="text-center pt-2">
          <button
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {completeMutation.isPending ? "Saving..." : "Your canary is ready \u2192"}
          </button>
          {completeMutation.error && (
            <div className="mt-3">
              <ErrorBox>{(completeMutation.error as Error).message}</ErrorBox>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
