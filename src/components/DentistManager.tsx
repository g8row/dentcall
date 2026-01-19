'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translations';
import EditDentistModal from './EditDentistModal';

interface Dentist {
    id: string;
    facility_name: string;
    region: string;
    cities_served: string | null;
    preferred_caller_id: string | null;
    manager: string | null;
    phones: string | string[];
}

interface User {
    id: string;
    username: string;
}

export default function DentistManager() {
    const { t } = useTranslation();
    const [dentists, setDentists] = useState<Dentist[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Modal Edit State
    const [editingDentist, setEditingDentist] = useState<Dentist | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    // Backup State
    const [backingUp, setBackingUp] = useState(false);

    // Filter Updates - Debounced
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchData(1);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [search]);

    // Initial Load
    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            const data = await res.json();
            if (data.users) setUsers(data.users);
        } catch (err) {
            console.error('Failed to fetch users', err);
        }
    };

    const fetchData = async (pageNum: number) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pageNum.toString(),
                limit: '20',
                search: search
            });

            const res = await fetch(`/api/dentists?${params}`);
            const data = await res.json();

            if (data.dentists) {
                setDentists(data.dentists);
                setTotalPages(data.pagination.totalPages);
                setPage(pageNum);
            }
        } catch (err) {
            console.error('Failed to fetch dentists', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (dentist: Dentist) => {
        setEditingDentist(dentist);
        setShowEditModal(true);
    };

    const handleEditSuccess = (msg: string) => {
        fetchData(page); // Reload data to reflect changes
        // alert(msg); // Optional feedback
    };

    const handleBackup = async (mode: 'client' | 'server') => {
        setBackingUp(true);
        try {
            const endpoint = mode === 'server' ? '/api/admin/backup?mode=server' : '/api/admin/backup';
            const res = await fetch(endpoint, { method: 'POST' });

            if (res.ok) {
                if (mode === 'server') {
                    const data = await res.json();
                    alert(`Backup saved to server: ${data.filename}`);
                } else {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `cold-caller-backup-${new Date().toISOString().slice(0, 10)}.db`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    alert('Backup downloaded successfully');
                }
            } else {
                alert('Backup failed');
            }
        } catch (err) {
            console.error('Backup error', err);
            alert('Backup error');
        } finally {
            setBackingUp(false);
        }
    };

    return (
        <div className="space-y-6">
            <EditDentistModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                dentist={editingDentist}
                onSuccess={handleEditSuccess}
            />

            <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="flex-1 max-w-md">
                    <input
                        type="text"
                        placeholder="Search by name, phone, or manager..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleBackup('server')}
                        disabled={backingUp}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2 border border-slate-600"
                        title="Save copy to server (data/backups)"
                    >
                        {backingUp ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                            </svg>
                        )}
                        Server Backup
                    </button>
                    <button
                        onClick={() => handleBackup('client')}
                        disabled={backingUp}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                        title="Download to your computer"
                    >
                        {backingUp ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        )}
                        Download
                    </button>
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/50 text-slate-400 font-medium">
                            <tr>
                                <th className="px-6 py-4">Facility Name</th>
                                <th className="px-6 py-4">Region/City</th>
                                <th className="px-6 py-4">Manager</th>
                                <th className="px-6 py-4">Phones</th>
                                <th className="px-6 py-4">Preferred Caller</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        Loading records...
                                    </td>
                                </tr>
                            ) : dentists.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        No dentists found matching your search.
                                    </td>
                                </tr>
                            ) : (
                                dentists.map((dentist) => {
                                    let phoneDisplay = '';
                                    if (Array.isArray(dentist.phones)) {
                                        phoneDisplay = dentist.phones.join(', ');
                                    } else if (typeof dentist.phones === 'string') {
                                        try {
                                            const p = JSON.parse(dentist.phones);
                                            phoneDisplay = Array.isArray(p) ? p.join(', ') : dentist.phones;
                                        } catch {
                                            phoneDisplay = dentist.phones;
                                        }
                                    }

                                    return (
                                        <tr key={dentist.id} className="hover:bg-slate-700/30 transition">
                                            <td className="px-6 py-4 font-medium text-white">
                                                {dentist.facility_name}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                <div className="flex flex-col">
                                                    <span>{dentist.region}</span>
                                                    <span className="text-xs text-slate-500">{dentist.cities_served?.replace(/["\[\]]/g, '')}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                {dentist.manager || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300 max-w-xs truncate" title={phoneDisplay}>
                                                {phoneDisplay || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${dentist.preferred_caller_id
                                                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                                        : 'text-slate-500'
                                                    }`}>
                                                    {dentist.preferred_caller_id
                                                        ? users.find(u => u.id === dentist.preferred_caller_id)?.username || 'Unknown'
                                                        : 'None'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleEditClick(dentist)}
                                                    className="text-indigo-400 hover:text-indigo-300 font-medium"
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="bg-slate-900/50 px-6 py-4 border-t border-slate-700 flex justify-between items-center">
                    <span className="text-sm text-slate-400">
                        Page {page} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => fetchData(page - 1)}
                            disabled={page <= 1}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded disabled:opacity-50 text-sm"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => fetchData(page + 1)}
                            disabled={page >= totalPages}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded disabled:opacity-50 text-sm"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
