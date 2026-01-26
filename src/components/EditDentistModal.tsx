'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translations';

interface Dentist {
    id: string;
    facility_name: string;
    region: string;
    cities_served: string | null;
    preferred_caller_id: string | null;
    manager: string | null;
    phones: string | string[];
    eik: string | null;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (message: string) => void;
    dentist: Dentist | null;
}

export default function EditDentistModal({ isOpen, onClose, onSuccess, dentist }: Props) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        facility_name: '',
        region: '',
        city: '',
        manager: '',
        phone: '', // We'll edit the first phone or join them? Let's treat as comma-separated string for editing multiple
        eik: '',
        preferred_caller_id: ''
    });

    const [loading, setLoading] = useState(false);
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [callers, setCallers] = useState<{ id: string; username: string }[]>([]);
    const [regions, setRegions] = useState<string[]>([]);

    // Load initial data
    useEffect(() => {
        if (dentist) {
            let phoneStr = '';
            if (Array.isArray(dentist.phones)) {
                phoneStr = dentist.phones.join(', ');
            } else if (typeof dentist.phones === 'string') {
                try {
                    const parsed = JSON.parse(dentist.phones);
                    phoneStr = Array.isArray(parsed) ? parsed.join(', ') : dentist.phones;
                } catch {
                    phoneStr = dentist.phones;
                }
            }

            setFormData({
                facility_name: dentist.facility_name,
                region: dentist.region,
                city: dentist.cities_served?.replace(/["\[\]]/g, '') || '', // Simple cleanup
                manager: dentist.manager || '',
                phone: phoneStr,
                eik: dentist.eik || '',
                preferred_caller_id: dentist.preferred_caller_id || ''
            });

            // Trigger region logic to load cities
            if (dentist.region) {
                fetchCities(dentist.region);
            }
        }
    }, [dentist, isOpen]);

    // Fetch Callers & Regions on mount
    useEffect(() => {
        const loadData = async () => {
            // Callers
            try {
                const uRes = await fetch('/api/users');
                const uData = await uRes.json();
                if (uData.users) setCallers(uData.users.filter((u: any) => u.role === 'CALLER' || u.role === 'ADMIN')); // Allow admins too?
            } catch (e) { console.error(e); }

            // Regions
            try {
                const rRes = await fetch('/api/dentists/locations');
                const rData = await rRes.json();
                if (rData.regions) setRegions(rData.regions.map((r: any) => r.region));
            } catch (e) { console.error(e); }
        };
        loadData();
    }, []);

    const fetchCities = async (region: string) => {
        try {
            const res = await fetch(`/api/dentists/locations?region=${encodeURIComponent(region)}`);
            const data = await res.json();
            if (data.cities) {
                setAvailableCities(data.cities.map((c: any) => c.name).sort());
            }
        } catch (err) {
            console.error('Failed to load cities', err);
        }
    };

    // Reload cities if region changes by user
    useEffect(() => {
        if (formData.region) fetchCities(formData.region);
    }, [formData.region]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dentist) return;
        setLoading(true);

        // Parse phones back to array
        const phonesArray = formData.phone.split(',').map(p => p.trim()).filter(p => p.length > 0);

        try {
            const res = await fetch(`/api/dentists/${dentist.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    facility_name: formData.facility_name,
                    region: formData.region,
                    city: formData.city,
                    manager: formData.manager,
                    phones: phonesArray,
                    eik: formData.eik || null,
                    preferred_caller_id: formData.preferred_caller_id || null
                }),
            });

            if (res.ok) {
                onSuccess('Dentist updated successfully');
                onClose();
            } else {
                alert('Failed to update');
            }
        } catch (error) {
            console.error('Update error:', error);
            alert('Error updating dentist');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl shadow-xl w-full max-w-md border border-slate-700 animate-in fade-in zoom-in duration-200">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Edit Dentist</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">{t('facility_name_label')}</label>
                            <input
                                type="text"
                                value={formData.facility_name}
                                onChange={e => setFormData({ ...formData, facility_name: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">{t('region')}</label>
                                <select
                                    value={formData.region}
                                    onChange={e => setFormData({ ...formData, region: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                                >
                                    <option value="">Select...</option>
                                    {regions.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">City</label>
                                <input
                                    type="text"
                                    list="edit_cities_list"
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <datalist id="edit_cities_list">
                                    {availableCities.map(city => (
                                        <option key={city} value={city} />
                                    ))}
                                </datalist>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Phones</label>
                            <input
                                type="text"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="Comma separated for multiple"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">{t('manager_label')}</label>
                            <input
                                type="text"
                                value={formData.manager}
                                onChange={e => setFormData({ ...formData, manager: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">{t('preferred_caller_optional')}</label>
                            <select
                                value={formData.preferred_caller_id}
                                onChange={e => setFormData({ ...formData, preferred_caller_id: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                            >
                                <option value="">{t('no_preference')}</option>
                                {callers.map(caller => (
                                    <option key={caller.id} value={caller.id}>{caller.username}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">EIK / BULSTAT</label>
                            <input
                                type="text"
                                value={formData.eik}
                                onChange={e => setFormData({ ...formData, eik: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="123456789"
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-slate-400 hover:text-white transition"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition font-medium disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
