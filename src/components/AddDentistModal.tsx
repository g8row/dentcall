'use client';

import { useState, useEffect } from 'react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (message: string) => void;
    regions: { region: string; dentist_count: number }[];
}

export default function AddDentistModal({ isOpen, onClose, onSuccess, regions }: Props) {
    const [formData, setFormData] = useState({
        facility_name: '',
        region: '',
        city: '',
        address: '',
        manager: '',
        phone: '',
        email: ''
    });

    const [loading, setLoading] = useState(false);
    const [availableCities, setAvailableCities] = useState<string[]>([]);

    // Fetch cities when region changes
    useEffect(() => {
        if (!formData.region) {
            setAvailableCities([]);
            return;
        }

        const fetchCities = async () => {
            try {
                const res = await fetch(`/api/dentists/locations?region=${encodeURIComponent(formData.region)}`);
                const data = await res.json();
                if (data.cities) {
                    setAvailableCities(data.cities.sort());
                }
            } catch (err) {
                console.error('Failed to load cities', err);
            }
        };

        fetchCities();
    }, [formData.region]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/dentists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (res.ok) {
                onSuccess(`Dentist "${formData.facility_name}" added successfully`);
                onClose();
                // Reset form
                setFormData({
                    facility_name: '',
                    region: '',
                    city: '',
                    address: '',
                    manager: '',
                    phone: '',
                    email: ''
                });
            } else {
                alert(data.error || 'Failed to add dentist');
            }
        } catch (error) {
            console.error('Add dentist error:', error);
            alert('Failed to add dentist');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl shadow-xl w-full max-w-md border border-slate-700 animate-in fade-in zoom-in duration-200">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Add New Dentist</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Facility Name *</label>
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
                                <label className="block text-sm font-medium text-slate-300 mb-1">Region *</label>
                                <select
                                    value={formData.region}
                                    onChange={e => setFormData({ ...formData, region: e.target.value, city: '' })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                                    required
                                >
                                    <option value="">Select Region</option>
                                    {regions.map(r => (
                                        <option key={r.region} value={r.region}>{r.region}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">City *</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        list="cities_list"
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        required
                                        placeholder="Select or type..."
                                        disabled={!formData.region}
                                    />
                                    <datalist id="cities_list">
                                        {availableCities.map(city => (
                                            <option key={city} value={city} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Phone *</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Address</label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Manager</label>
                                <input
                                    type="text"
                                    value={formData.manager}
                                    onChange={e => setFormData({ ...formData, manager: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-slate-400 hover:text-white transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition font-medium disabled:opacity-50"
                            >
                                {loading ? 'Adding...' : 'Add Dentist'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
