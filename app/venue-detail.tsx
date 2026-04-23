import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
    TextInput,
    LayoutAnimation,
    Platform,
    UIManager,
    Modal,
    Alert,
    KeyboardAvoidingView,
} from 'react-native';
import { MapPin, ChevronDown, Edit2, Save, X, Calendar, DollarSign, Plus } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatPercentage } from '../lib/calculations';
import {
    FilterPeriod,
    DateRange,
    getDateRangeForPeriod,
    toISORange,
    getWeekBoundaries,
    getPeriodLabel,
} from '../lib/dateFilters';
import type { Database } from '../lib/database.types';

type Location = Database['public']['Tables']['locations']['Row'];
type Rental = Database['public']['Tables']['rentals']['Row'];
type Payout = Database['public']['Tables']['payouts']['Row'];

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FILTER_OPTIONS: { key: FilterPeriod; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'thisweek', label: 'Week' },
    { key: 'lastweek', label: 'Last Wk' },
    { key: 'thismonth', label: 'Month' },
    { key: 'lastmonth', label: 'Last Mo' },
    { key: 'ytd', label: 'YTD' },
    { key: 'custom', label: 'Custom' },
];

// Payouts store amount in cents — local formatter
const formatCents = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function VenueDetailScreen() {
    const { name } = useLocalSearchParams<{ name: string }>();
    const [location, setLocation] = useState<Location | null>(null);
    const [rentals, setRentals] = useState<Rental[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [configExpanded, setConfigExpanded] = useState(false);

    // Date filter state
    const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>('all');
    const [customRange, setCustomRange] = useState<DateRange | undefined>();
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [tempStart, setTempStart] = useState('');
    const [tempEnd, setTempEnd] = useState('');

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        tax_rate: 0,
        venue_split: 0,
        investment_cost: 0,
        go_live_date: '',
        station_id: '',
    });

    // Payouts state
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [payoutsExpanded, setPayoutsExpanded] = useState(false);
    const [showAddPayout, setShowAddPayout] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutDate, setPayoutDate] = useState(new Date().toISOString().split('T')[0]);
    const [payoutNotes, setPayoutNotes] = useState('');

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError(null);

        try {
            const resolved = getDateRangeForPeriod(selectedPeriod, customRange);
            const iso = resolved ? toISORange(resolved) : null;
            const weekBounds = getWeekBoundaries();

            const [locRes, rentalsRes, statsRes, payoutsRes] = await Promise.all([
                supabase.from('locations').select('*').eq('name', name).maybeSingle(),
                supabase.from('rentals').select('*').eq('location_name', name).is('deleted_at', null).order('created_at', { ascending: false }).limit(20),
                supabase.functions.invoke('dashboard-stats', {
                    body: {
                        time_period: iso ? 'custom' : 'all',
                        location_name: name,
                        ...(iso ? { start_date: iso.startISO, end_date: iso.endISO } : {}),
                        this_week_start: weekBounds.thisWeekStartISO,
                        last_week_start: weekBounds.lastWeekStartISO,
                    },
                }),
                supabase.from('payouts').select('*').eq('location_name', name).order('payout_date', { ascending: false }),
            ]);
            if (locRes.data) setLocation(locRes.data);
            if (rentalsRes.data) setRentals(rentalsRes.data);
            if (statsRes.data) setStats(statsRes.data);
            if (payoutsRes.data) setPayouts(payoutsRes.data);
        } catch (err: any) {
            console.error('Error fetching venue detail:', err);
            setError(err?.message || 'Failed to load venue');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [name, selectedPeriod, customRange]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData(true);
    }, [fetchData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Realtime subscription for this venue's rentals and location changes
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const debouncedRefresh = () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => fetchData(true), 500);
        };

        const channel = supabase
            .channel(`venue-${name}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals', filter: `location_name=eq.${name}` }, debouncedRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'locations', filter: `name=eq.${name}` }, debouncedRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payouts', filter: `location_name=eq.${name}` }, debouncedRefresh)
            .subscribe();

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            supabase.removeChannel(channel);
        };
    }, [name, fetchData]);

    const toggleConfig = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setConfigExpanded((prev) => !prev);
    }, []);

    const togglePayouts = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setPayoutsExpanded((prev) => !prev);
    }, []);

    // Edit handlers
    const startEdit = useCallback(() => {
        if (!location) return;
        setEditForm({
            tax_rate: location.tax_rate * 100,
            venue_split: location.venue_split * 100,
            investment_cost: location.investment_cost / 100,
            go_live_date: location.go_live_date || '',
            station_id: location.station_id || '',
        });
        setIsEditing(true);
    }, [location]);

    const cancelEdit = useCallback(() => {
        setIsEditing(false);
    }, []);

    const saveEdit = useCallback(async () => {
        if (!location) return;
        if (editForm.tax_rate < 0 || editForm.tax_rate > 100) {
            Alert.alert('Invalid Input', 'Tax rate must be between 0 and 100.');
            return;
        }
        if (editForm.venue_split < 0 || editForm.venue_split > 100) {
            Alert.alert('Invalid Input', 'Venue split must be between 0 and 100.');
            return;
        }
        if (editForm.investment_cost < 0) {
            Alert.alert('Invalid Input', 'Investment cost must be 0 or greater.');
            return;
        }
        if (editForm.go_live_date) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(editForm.go_live_date) || isNaN(new Date(editForm.go_live_date).getTime())) {
                Alert.alert('Invalid Input', 'Go live date must be in YYYY-MM-DD format.');
                return;
            }
        }
        setSaving(true);
        try {
            const { error } = await supabase
                .from('locations')
                .update({
                    tax_rate: editForm.tax_rate / 100,
                    venue_split: editForm.venue_split / 100,
                    investment_cost: Math.round(editForm.investment_cost * 100),
                    go_live_date: editForm.go_live_date || null,
                    station_id: editForm.station_id || null,
                })
                .eq('name', location.name);

            if (error) throw error;
            setIsEditing(false);
            fetchData(true);
        } catch (error) {
            console.error('Error saving:', error);
            Alert.alert('Error', 'Failed to save changes.');
        } finally {
            setSaving(false);
        }
    }, [location, editForm, fetchData]);

    // Payout handlers
    const addPayout = useCallback(async () => {
        const amountNum = parseFloat(payoutAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            Alert.alert('Error', 'Please enter a valid amount.');
            return;
        }
        try {
            const { error } = await supabase.from('payouts').insert({
                location_name: name,
                amount: Math.round(amountNum * 100),
                payout_date: payoutDate,
                notes: payoutNotes.trim(),
            });
            if (error) throw error;
            setShowAddPayout(false);
            setPayoutAmount('');
            setPayoutNotes('');
            fetchData(true);
        } catch (error) {
            console.error('Error adding payout:', error);
            Alert.alert('Error', 'Failed to add payout.');
        }
    }, [name, payoutAmount, payoutDate, payoutNotes, fetchData]);

    const deletePayout = useCallback((id: string) => {
        Alert.alert('Delete Payout', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        const { error } = await supabase.from('payouts').delete().eq('id', id);
                        if (error) throw error;
                        fetchData(true);
                    } catch (error) {
                        Alert.alert('Error', 'Failed to delete payout.');
                    }
                },
            },
        ]);
    }, [fetchData]);

    // Date filter handlers
    const handlePeriodSelect = useCallback((period: FilterPeriod) => {
        if (period === 'custom') {
            setTempStart(customRange?.startDate || new Date().toISOString().split('T')[0]);
            setTempEnd(customRange?.endDate || new Date().toISOString().split('T')[0]);
            setShowCustomModal(true);
        } else {
            setSelectedPeriod(period);
            setCustomRange(undefined);
        }
    }, [customRange]);

    const handleCustomApply = useCallback(() => {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(tempStart) || !dateRegex.test(tempEnd)) {
            Alert.alert('Invalid Date', 'Please enter dates in YYYY-MM-DD format.');
            return;
        }
        if (isNaN(new Date(tempStart).getTime()) || isNaN(new Date(tempEnd).getTime())) {
            Alert.alert('Invalid Date', 'Please enter dates in YYYY-MM-DD format.');
            return;
        }
        if (new Date(tempStart) > new Date(tempEnd)) {
            Alert.alert('Invalid Date', 'Start date must be before or equal to end date.');
            return;
        }
        setCustomRange({ startDate: tempStart, endDate: tempEnd });
        setSelectedPeriod('custom');
        setShowCustomModal(false);
    }, [tempStart, tempEnd]);

    // Extract stats from edge function response
    const locStats = stats?.locations?.[0] ?? {
        totalRevenue: 0, venuePayout: 0, myProfit: 0, roi: 0,
        totalRentals: 0, averageRevenuePerRental: 0,
        projectedAnnualProfit: 0, projectedAnnualTotal: 0,
    };

    // Payout calculations (amounts in cents)
    const totalPayoutsMade = payouts.reduce((sum, p) => sum + p.amount, 0);
    const venuePayoutOwedCents = Math.round(locStats.venuePayout * 100);
    const balance = venuePayoutOwedCents - totalPayoutsMade;

    if (loading || !location) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#60a5fa" />
                <Text style={styles.loadingText}>Loading venue...</Text>
            </View>
        );
    }

    if (error && !loading) {
        return (
            <View style={styles.loadingContainer}>
                <View style={styles.errorCard}>
                    <Text style={styles.errorTitle}>Something went wrong</Text>
                    <Text style={styles.errorMessage}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()} activeOpacity={0.7}>
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60a5fa" />}
            >
                {/* Venue Header */}
                <View style={styles.headerRow}>
                    <MapPin color="#60a5fa" size={22} />
                    <Text style={styles.name}>{location.name}</Text>
                </View>
                <Text style={styles.address}>
                    {[location.address_line1, location.city, location.state].filter(Boolean).join(', ')}
                </Text>

                {/* Date Filter Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
                    {FILTER_OPTIONS.map((option) => {
                        const isActive = selectedPeriod === option.key;
                        return (
                            <TouchableOpacity
                                key={option.key}
                                style={[styles.filterPill, isActive && styles.filterPillActive]}
                                onPress={() => handlePeriodSelect(option.key)}
                                activeOpacity={0.7}
                            >
                                {option.key === 'custom' && <Calendar color={isActive ? '#fff' : '#9ca3af'} size={11} />}
                                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                                    {option.key === 'custom' && selectedPeriod === 'custom' && customRange
                                        ? `${customRange.startDate.slice(5)} — ${customRange.endDate.slice(5)}`
                                        : option.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {selectedPeriod !== 'all' && (
                    <View style={styles.activeFilterRow}>
                        <Text style={styles.activeFilterLabel}>Showing: {getPeriodLabel(selectedPeriod, customRange)}</Text>
                        <TouchableOpacity onPress={() => { setSelectedPeriod('all'); setCustomRange(undefined); }}>
                            <X color="#9ca3af" size={16} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Stats Grid */}
                <View style={styles.statsRow}>
                    <View style={styles.statTile}><Text style={styles.statLabel}>Rentals</Text><Text style={styles.statValue}>{locStats.totalRentals}</Text></View>
                    <View style={styles.statTile}><Text style={styles.statLabel}>Revenue</Text><Text style={styles.statValue}>{formatCurrency(locStats.totalRevenue)}</Text></View>
                    <View style={styles.statTile}><Text style={styles.statLabel}>Avg</Text><Text style={[styles.statValue, { color: '#60a5fa' }]}>{formatCurrency(locStats.averageRevenuePerRental)}</Text></View>
                </View>
                <View style={styles.statsRow}>
                    <View style={styles.statTile}><Text style={styles.statLabel}>Venue</Text><Text style={[styles.statValue, { color: '#fbbf24' }]}>{formatCurrency(locStats.venuePayout)}</Text></View>
                    <View style={styles.statTile}><Text style={styles.statLabel}>Profit</Text><Text style={[styles.statValue, { color: '#34d399' }]}>{formatCurrency(locStats.myProfit)}</Text></View>
                    <View style={styles.statTile}><Text style={styles.statLabel}>ROI</Text><Text style={[styles.statValue, { color: '#a78bfa' }]}>{formatPercentage(locStats.roi)}</Text></View>
                </View>
                <View style={styles.statsRow}>
                    <View style={[styles.statTile, { flex: 1 }]}><Text style={styles.statLabel}>Projected Profit</Text><Text style={[styles.statValue, { color: '#34d399' }]}>{formatCurrency(locStats.projectedAnnualProfit)}</Text></View>
                    <View style={[styles.statTile, { flex: 1 }]}><Text style={styles.statLabel}>Projected Total</Text><Text style={styles.statValue}>{formatCurrency(locStats.projectedAnnualTotal)}</Text></View>
                </View>

                {/* Configuration Section */}
                <TouchableOpacity style={styles.configToggle} onPress={isEditing ? undefined : toggleConfig} activeOpacity={isEditing ? 1 : 0.7}>
                    <Text style={styles.configToggleText}>Configuration</Text>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                        {!isEditing && (
                            <TouchableOpacity onPress={startEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Edit2 color="#60a5fa" size={16} />
                            </TouchableOpacity>
                        )}
                        {isEditing && (
                            <>
                                <TouchableOpacity onPress={cancelEdit}><X color="#f87171" size={18} /></TouchableOpacity>
                                <TouchableOpacity onPress={saveEdit} disabled={saving}>
                                    <Save color={saving ? '#6b7280' : '#34d399'} size={18} />
                                </TouchableOpacity>
                            </>
                        )}
                        {!isEditing && (
                            <View style={{ transform: [{ rotate: configExpanded ? '180deg' : '0deg' }] }}>
                                <ChevronDown color="#9ca3af" size={20} />
                            </View>
                        )}
                    </View>
                </TouchableOpacity>

                {(configExpanded || isEditing) && (
                    <View style={styles.configCard}>
                        {isEditing ? (
                            <>
                                <View style={styles.configRow}>
                                    <Text style={styles.configLabel}>Tax Rate (%)</Text>
                                    <TextInput style={styles.editInput} value={String(editForm.tax_rate)} onChangeText={(v) => setEditForm(f => ({ ...f, tax_rate: parseFloat(v) || 0 }))} keyboardType="decimal-pad" />
                                </View>
                                <View style={styles.configRow}>
                                    <Text style={styles.configLabel}>Venue Split (%)</Text>
                                    <TextInput style={styles.editInput} value={String(editForm.venue_split)} onChangeText={(v) => setEditForm(f => ({ ...f, venue_split: parseFloat(v) || 0 }))} keyboardType="decimal-pad" />
                                </View>
                                <View style={styles.configRow}>
                                    <Text style={styles.configLabel}>Investment ($)</Text>
                                    <TextInput style={styles.editInput} value={String(editForm.investment_cost)} onChangeText={(v) => setEditForm(f => ({ ...f, investment_cost: parseFloat(v) || 0 }))} keyboardType="decimal-pad" />
                                </View>
                                <View style={styles.configRow}>
                                    <Text style={styles.configLabel}>Go Live Date</Text>
                                    <TextInput style={styles.editInput} value={editForm.go_live_date} onChangeText={(v) => setEditForm(f => ({ ...f, go_live_date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor="#6b7280" />
                                </View>
                                <View style={[styles.configRow, { borderBottomWidth: 0 }]}>
                                    <Text style={styles.configLabel}>Station ID</Text>
                                    <TextInput style={styles.editInput} value={editForm.station_id} onChangeText={(v) => setEditForm(f => ({ ...f, station_id: v }))} placeholder="—" placeholderTextColor="#6b7280" />
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={styles.configRow}><Text style={styles.configLabel}>Station ID</Text><Text style={styles.configValue}>{location.station_id || '—'}</Text></View>
                                <View style={styles.configRow}><Text style={styles.configLabel}>Stripe ID</Text><Text style={styles.configValue} numberOfLines={1}>{location.stripe_id || '—'}</Text></View>
                                <View style={styles.configRow}><Text style={styles.configLabel}>Hourly Rate</Text><Text style={styles.configValue}>{location.hourly_rate ? `$${(location.hourly_rate / 100).toFixed(2)}` : '—'}</Text></View>
                                <View style={styles.configRow}><Text style={styles.configLabel}>Daily Cap</Text><Text style={styles.configValue}>{location.daily_cap ? `$${(location.daily_cap / 100).toFixed(2)}` : '—'}</Text></View>
                                <View style={styles.configRow}><Text style={styles.configLabel}>Lost Fee</Text><Text style={styles.configValue}>{location.lost_fee ? `$${(location.lost_fee / 100).toFixed(2)}` : '—'}</Text></View>
                                <View style={styles.configRow}><Text style={styles.configLabel}>Venue Split</Text><Text style={styles.configValue}>{formatPercentage(location.venue_split)}</Text></View>
                                <View style={styles.configRow}><Text style={styles.configLabel}>Tax Rate</Text><Text style={styles.configValue}>{(location.tax_rate * 100).toFixed(1)}%</Text></View>
                                <View style={styles.configRow}><Text style={styles.configLabel}>Investment</Text><Text style={styles.configValue}>{formatCurrency(location.investment_cost / 100)}</Text></View>
                                <View style={[styles.configRow, { borderBottomWidth: 0 }]}><Text style={styles.configLabel}>Go Live</Text><Text style={styles.configValue}>{location.go_live_date ? new Date(location.go_live_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Text></View>
                            </>
                        )}
                    </View>
                )}

                {/* Payouts Section */}
                <TouchableOpacity style={styles.configToggle} onPress={togglePayouts} activeOpacity={0.7}>
                    <Text style={styles.configToggleText}>Payouts</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity onPress={() => setShowAddPayout(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Plus color="#60a5fa" size={18} />
                        </TouchableOpacity>
                        <View style={{ transform: [{ rotate: payoutsExpanded ? '180deg' : '0deg' }] }}>
                            <ChevronDown color="#9ca3af" size={20} />
                        </View>
                    </View>
                </TouchableOpacity>

                {payoutsExpanded && (
                    <View style={styles.configCard}>
                        {/* Summary cards */}
                        <View style={[styles.statsRow, { padding: 12 }]}>
                            <View style={[styles.statTile, { paddingVertical: 10 }]}>
                                <Text style={[styles.statLabel, { fontSize: 10 }]}>Owed</Text>
                                <Text style={[styles.statValue, { fontSize: 14, color: '#fbbf24' }]}>{formatCents(venuePayoutOwedCents)}</Text>
                            </View>
                            <View style={[styles.statTile, { paddingVertical: 10 }]}>
                                <Text style={[styles.statLabel, { fontSize: 10 }]}>Paid</Text>
                                <Text style={[styles.statValue, { fontSize: 14, color: '#34d399' }]}>{formatCents(totalPayoutsMade)}</Text>
                            </View>
                            <View style={[styles.statTile, { paddingVertical: 10 }]}>
                                <Text style={[styles.statLabel, { fontSize: 10 }]}>{balance > 0 ? 'Balance' : balance < 0 ? 'Overpaid' : 'Settled'}</Text>
                                <Text style={[styles.statValue, { fontSize: 14, color: balance > 0 ? '#f87171' : balance < 0 ? '#fbbf24' : '#34d399' }]}>
                                    {formatCents(Math.abs(balance))}
                                </Text>
                            </View>
                        </View>

                        {/* Payout list */}
                        {payouts.length === 0 ? (
                            <View style={{ padding: 16, alignItems: 'center' }}>
                                <Text style={{ color: '#6b7280', fontSize: 13 }}>No payouts recorded</Text>
                            </View>
                        ) : (
                            payouts.map((payout) => (
                                <View key={payout.id} style={[styles.configRow, { alignItems: 'center' }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{formatCents(payout.amount)}</Text>
                                        <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
                                            {new Date(payout.payout_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            {payout.notes ? ` · ${payout.notes}` : ''}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => deletePayout(payout.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                        <X color="#f87171" size={14} />
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* Recent Transactions */}
                <Text style={styles.sectionTitle}>Recent Transactions</Text>
                {rentals.map((rental) => {
                    const amount = rental.effective_amount ?? 0;
                    return (
                        <View key={rental.id} style={styles.txRow}>
                            <View>
                                <Text style={styles.txDate}>
                                    {new Date(rental.created_at).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                                    })}
                                </Text>
                                <Text style={styles.txStatus}>
                                    {rental.is_lost ? '🔴 Lost' : rental.status || '—'}
                                </Text>
                            </View>
                            <Text style={[styles.txAmount, amount > 0 ? { color: '#34d399' } : { color: '#6b7280' }]}>
                                {amount > 0 ? formatCurrency(amount / 100) : '$0.00'}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>

            {/* Custom Date Range Modal */}
            <Modal visible={showCustomModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Custom Date Range</Text>
                            <TouchableOpacity onPress={() => setShowCustomModal(false)}><X color="#9ca3af" size={22} /></TouchableOpacity>
                        </View>
                        <Text style={styles.modalLabel}>Start Date</Text>
                        <TextInput style={styles.modalInput} value={tempStart} onChangeText={setTempStart} placeholder="YYYY-MM-DD" placeholderTextColor="#6b7280" />
                        <Text style={styles.modalLabel}>End Date</Text>
                        <TextInput style={styles.modalInput} value={tempEnd} onChangeText={setTempEnd} placeholder="YYYY-MM-DD" placeholderTextColor="#6b7280" />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCustomModal(false)}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.modalApplyBtn} onPress={handleCustomApply}><Text style={styles.modalApplyText}>Apply</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Payout Modal */}
            <Modal visible={showAddPayout} transparent animationType="fade">
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Payout</Text>
                            <TouchableOpacity onPress={() => setShowAddPayout(false)}><X color="#9ca3af" size={22} /></TouchableOpacity>
                        </View>
                        <Text style={styles.modalLabel}>Amount ($)</Text>
                        <TextInput style={styles.modalInput} value={payoutAmount} onChangeText={setPayoutAmount} placeholder="0.00" placeholderTextColor="#6b7280" keyboardType="decimal-pad" />
                        <Text style={styles.modalLabel}>Date</Text>
                        <TextInput style={styles.modalInput} value={payoutDate} onChangeText={setPayoutDate} placeholder="YYYY-MM-DD" placeholderTextColor="#6b7280" />
                        <Text style={styles.modalLabel}>Notes (optional)</Text>
                        <TextInput style={styles.modalInput} value={payoutNotes} onChangeText={setPayoutNotes} placeholder="e.g. Venmo, check #123" placeholderTextColor="#6b7280" />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddPayout(false)}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.modalApplyBtn} onPress={addPayout}><Text style={styles.modalApplyText}>Add Payout</Text></TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111827' },
    content: { padding: 16, paddingBottom: 48 },
    loadingContainer: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#9ca3af', marginTop: 12, fontSize: 14 },
    errorCard: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 16, padding: 28, alignItems: 'center' as const, gap: 10 },
    errorTitle: { color: '#f87171', fontSize: 18, fontWeight: '700' as const },
    errorMessage: { color: '#9ca3af', fontSize: 13, textAlign: 'center' as const },
    retryBtn: { marginTop: 10, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: 10 },
    retryBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' as const },

    // Header
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    name: { color: '#60a5fa', fontSize: 24, fontWeight: '700' },
    address: { color: '#9ca3af', fontSize: 14, marginBottom: 12, marginLeft: 32 },

    // Filter Pills
    filterScroll: { marginBottom: 8, marginHorizontal: -16 },
    filterContainer: { paddingHorizontal: 16, gap: 6, flexDirection: 'row' },
    filterPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151' },
    filterPillActive: { backgroundColor: '#2563eb', borderColor: '#3b82f6' },
    filterPillText: { color: '#9ca3af', fontSize: 12, fontWeight: '500' },
    filterPillTextActive: { color: '#fff' },
    activeFilterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(37,99,235,0.12)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
    activeFilterLabel: { color: '#93c5fd', fontSize: 12, fontWeight: '500' },

    // Stats Grid
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    statTile: { flex: 1, backgroundColor: '#1f2937', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#374151', alignItems: 'center' },
    statLabel: { color: '#9ca3af', fontSize: 11, fontWeight: '500', marginBottom: 6 },
    statValue: { color: '#fff', fontSize: 18, fontWeight: '700' },

    // Configuration
    configToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1f2937', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#374151', marginTop: 6, marginBottom: 4 },
    configToggleText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    configCard: { backgroundColor: '#1f2937', borderRadius: 12, borderWidth: 1, borderColor: '#374151', marginBottom: 4, overflow: 'hidden' },
    configRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#374151' },
    configLabel: { color: '#9ca3af', fontSize: 13 },
    configValue: { color: '#fff', fontSize: 13, fontWeight: '500', flexShrink: 1, textAlign: 'right' },

    // Edit inputs
    editInput: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#4b5563', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: '#fff', fontSize: 13, textAlign: 'right', width: 120 },

    // Section Title
    sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 12 },

    // Transactions
    txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1f2937', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#374151', marginBottom: 8 },
    txDate: { color: '#d1d5db', fontSize: 13 },
    txStatus: { color: '#6b7280', fontSize: 11, marginTop: 2 },
    txAmount: { fontSize: 15, fontWeight: '600' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalCard: { width: '100%', maxWidth: 360, backgroundColor: '#1f2937', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#374151' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    modalLabel: { color: '#d1d5db', fontSize: 13, fontWeight: '500', marginBottom: 6, marginTop: 8 },
    modalInput: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#4b5563', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15 },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
    modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#374151', alignItems: 'center' },
    modalCancelText: { color: '#9ca3af', fontWeight: '600', fontSize: 14 },
    modalApplyBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center' },
    modalApplyText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
