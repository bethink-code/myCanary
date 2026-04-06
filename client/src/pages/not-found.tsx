import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <h1 className="text-4xl font-bold text-slate-900">404</h1>
      <p className="text-slate-500 mt-2">Page not found</p>
      <Link to="/" className="mt-4 text-primary hover:underline text-sm">
        Back to dashboard
      </Link>
    </div>
  );
}
