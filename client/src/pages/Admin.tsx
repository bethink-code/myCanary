import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("users");
  const qc = useQueryClient();

  const tabs = [
    { id: "users", label: "Users" },
    { id: "invites", label: "Invites" },
    { id: "requests", label: "Access Requests" },
    { id: "audit", label: "Audit Log" },
    { id: "security", label: "Security" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin Console</h1>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "users" && <UsersTab />}
      {activeTab === "invites" && <InvitesTab />}
      {activeTab === "requests" && <RequestsTab />}
      {activeTab === "audit" && <AuditTab />}
      {activeTab === "security" && <SecurityTab />}
    </div>
  );
}

function UsersTab() {
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiRequest("/api/admin/users"),
  });

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Admin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((u: any) => (
            <tr key={u.id}>
              <td className="px-4 py-3">{u.email}</td>
              <td className="px-4 py-3">{u.firstName} {u.lastName}</td>
              <td className="px-4 py-3">{u.isAdmin ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvitesTab() {
  const [email, setEmail] = useState("");
  const qc = useQueryClient();
  const { data: invites = [] } = useQuery<any[]>({
    queryKey: ["admin-invites"],
    queryFn: () => apiRequest("/api/admin/invites"),
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/invites", { method: "POST", body: JSON.stringify({ email }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-invites"] }); setEmail(""); },
  });

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(); }} className="flex gap-2">
        <input
          type="email"
          placeholder="Email to invite"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
          Add Invite
        </button>
      </form>
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Invited</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invites.map((inv: any) => (
              <tr key={inv.id}>
                <td className="px-4 py-3">{inv.email}</td>
                <td className="px-4 py-3">{new Date(inv.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RequestsTab() {
  const { data: requests = [] } = useQuery<any[]>({
    queryKey: ["admin-requests"],
    queryFn: () => apiRequest("/api/admin/access-requests"),
  });

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Cell</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {requests.map((r: any) => (
            <tr key={r.id}>
              <td className="px-4 py-3">{r.name}</td>
              <td className="px-4 py-3">{r.email}</td>
              <td className="px-4 py-3">{r.cell ?? "-"}</td>
              <td className="px-4 py-3 capitalize">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTab() {
  const { data: logs = [] } = useQuery<any[]>({
    queryKey: ["admin-audit"],
    queryFn: () => apiRequest("/api/admin/audit-logs"),
  });

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Time</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Action</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Resource</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Detail</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {logs.map((l: any) => (
            <tr key={l.id}>
              <td className="px-4 py-3">{new Date(l.createdAt).toLocaleString()}</td>
              <td className="px-4 py-3">{l.action}</td>
              <td className="px-4 py-3">{l.resourceType} {l.resourceId}</td>
              <td className="px-4 py-3 max-w-xs truncate">{l.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SecurityTab() {
  const { data } = useQuery<any>({
    queryKey: ["admin-security"],
    queryFn: () => apiRequest("/api/admin/security-overview"),
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white rounded-xl border border-border p-6">
        <p className="text-sm text-slate-500">Total Users</p>
        <p className="text-3xl font-bold text-slate-900 mt-1">{data?.totalUsers ?? 0}</p>
      </div>
      <div className="bg-white rounded-xl border border-border p-6">
        <p className="text-sm text-slate-500">Admin Users</p>
        <p className="text-3xl font-bold text-slate-900 mt-1">{data?.adminCount ?? 0}</p>
      </div>
      <div className="bg-white rounded-xl border border-border p-6">
        <p className="text-sm text-slate-500">Security Status</p>
        <p className="text-lg font-semibold text-green-600 mt-1">Healthy</p>
      </div>
    </div>
  );
}
