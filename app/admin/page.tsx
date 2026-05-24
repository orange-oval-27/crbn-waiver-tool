'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Waiver {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth: string;
  signed_at: string;
  status: string;
  guardian_name?: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedWaiver, setSelectedWaiver] = useState<Waiver | null>(null);

  const fetchWaivers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/waivers?${params}`);
    if (res.status === 401) { router.push('/admin/login'); return; }
    const data = await res.json();
    setWaivers(data.waivers || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, search, statusFilter, router]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/admin/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') fetchWaivers();
  }, [status, fetchWaivers]);

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this waiver?')) return;
    await fetch('/api/waivers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'revoked' }) });
    fetchWaivers();
  };

  const handleReactivate = async (id: string) => {
    await fetch('/api/waivers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'active' }) });
    fetchWaivers();
  };

  if (status === 'loading') return <div className="min-h-screen bg-black flex items-center justify-center"><p className="text-white">Loading...</p></div>;
  if (status === 'unauthenticated') return null;

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-black text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">CRBN Pickleball</h1>
          <p className="text-gray-400 text-xs">Waiver Admin Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300">{session?.user?.email}</span>
          <button onClick={() => signOut({ callbackUrl: '/admin/login' })} className="text-sm bg-white text-black px-3 py-1.5 rounded-lg hover:bg-gray-200 transition">Sign Out</button>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm"><p className="text-gray-500 text-sm">Total Waivers</p><p className="text-3xl font-bold mt-1">{total}</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm"><p className="text-gray-500 text-sm">Active</p><p className="text-3xl font-bold mt-1 text-green-600">{waivers.filter(w => w.status === 'active').length}</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm"><p className="text-gray-500 text-sm">Revoked</p><p className="text-3xl font-bold mt-1 text-red-500">{waivers.filter(w => w.status === 'revoked').length}</p></div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4 flex gap-4 flex-wrap">
          <input type="text" placeholder="Search by name or email..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-black" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </select>
          <a href="/sign" target="_blank" className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 transition flex items-center gap-2">
            Signing Link
          </a>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">DOB</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Signed</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : waivers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No waivers found</td></tr>
              ) : waivers.map((w) => (
                <tr key={w.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {w.first_name} {w.last_name}
                    {w.guardian_name && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Minor</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{w.email}</td>
                  <td className="px-4 py-3 text-gray-600">{w.phone || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{w.date_of_birth}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{new Date(w.signed_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${w.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedWaiver(w)} className="text-sm text-blue-600 hover:underline mr-3">View</button>
                    {w.status === 'active'
                      ? <button onClick={() => handleRevoke(w.id)} className="text-sm text-red-500 hover:underline">Revoke</button>
                      : <button onClick={() => handleReactivate(w.id)} className="text-sm text-green-600 hover:underline">Reactivate</button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">Page {page} of {totalPages} ({total} total)</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {selectedWaiver && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedWaiver(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Waiver Details</h3>
              <button onClick={() => setSelectedWaiver(null)} className="text-gray-400 hover:text-black text-xl">x</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Full Name</span><span className="font-medium">{selectedWaiver.first_name} {selectedWaiver.last_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Email</span><span>{selectedWaiver.email}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Phone</span><span>{selectedWaiver.phone || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Date of Birth</span><span>{selectedWaiver.date_of_birth}</span></div>
              {selectedWaiver.guardian_name && <div className="flex justify-between"><span className="text-gray-500">Guardian</span><span>{selectedWaiver.guardian_name}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Signed At</span><span>{new Date(selectedWaiver.signed_at).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selectedWaiver.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{selectedWaiver.status}</span>
              </div>
              <div className="flex justify-between"><span className="text-gray-500">ID</span><span className="font-mono text-xs">{selectedWaiver.id}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
