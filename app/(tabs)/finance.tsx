import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Alert,
} from 'react-native';
import { Search, Filter, ChevronDown, ChevronUp, Receipt } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/calculations';
import type { Database } from '../../lib/database.types';

type Rental = Database['public']['Tables']['rentals']['Row'];

interface RentalWithBajie extends Rental {
    bajie_orders?: { battery_id: string | null; borrow_slot: number | null; borrow_time: string | null; return_time: string | null }[] | null;
}

const PAGE_SIZE = 50;

const TYPE_FILTERS = [
    { key: 'paid', label: 'Paid Only' },
    { key: 'all', label: 'All Types' },
    { key: 'completed', label: 'Completed' },
    { key: 'free_return', label: 'Free Returns' },
    { key: 'failed', label: 'Failed' },
    { key: 'lost', label: 'Lost' },
    { key: 'refunded', label: 'Refunded' },
    { key: 'disputed', label: 'Disputed' },
    { key: 'double_tap', label: 'Double-Taps' },
];

function getTypeBadgeStyle(type: string): { bg: string; text: string; border: string } {
    switch (type) {
        case 'completed':
            return { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', border: '#166534' };
        case 'free_return':
            return { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: '#1e40af' };
        case 'failed':
            return { bg: 'rgba(239,68,68,0.12)', text: '#f87171', border: '#991b1b' };
        case 'lost':
            return { bg: 'rgba(251,146,60,0.12)', text: '#fb923c', border: '#9a3412' };
        case 'refunded':
        case 'partially_refunded':
            return { bg: 'rgba(168,85,247,0.12)', text: '#c084fc', border: '#6b21a8' };
        case 'disputed':
            return { bg: 'rgba(251,113,133,0.12)', text: '#fb7185', border: '#9f1239' };
        default:
            return { bg: 'rgba(107,114,128,0.2)', text: '#9ca3af', border: '#4b5563' };
    }
}

function formatType(type: string): string {
    return type.replace(/_/g, ' ');
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export default function FinanceScreen() {
    const [rentals, setRentals] = useState<RentalWithBajie[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('paid');
    const [showTypeFilter, setShowTypeFilter] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState('all');
    const [allLocations, setAllLocations] = useState<string[]>([]);
    const [showLocationFilter, setShowLocationFilter] = useState(false);

    // Fetch location names for filter
    useEffect(() => {
        supabase.from('locations').select('name').order('name').then(({ data }) => {
            if (data) setAllLocations(data.map((l) => l.name));
        });
    }, []);

    const fetchPage = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError(null);

        try {
            let query = supabase
                .from('rentals')
                .select('*, bajie_orders(battery_id, borrow_slot, borrow_time, return_time)')
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            let countQuery = supabase
                .from('rentals')
                .select('*', { count: 'exact', head: true })
                .is('deleted_at', null);

            // Location filter
            if (selectedLocation !== 'all') {
                query = query.eq('location_name', selectedLocation);
                countQuery = countQuery.eq('location_name', selectedLocation);
            }

            // Transaction type filter
            if (typeFilter === 'double_tap') {
                query = query.eq('is_accidental_multi', true);
                countQuery = countQuery.eq('is_accidental_multi', true);
            } else if (typeFilter === 'paid') {
                query = query.in('transaction_type', ['completed', 'lost', 'refunded', 'partially_refunded', 'disputed']);
                countQuery = countQuery.in('transaction_type', ['completed', 'lost', 'refunded', 'partially_refunded', 'disputed']);
            } else if (typeFilter !== 'all') {
                query = query.eq('transaction_type', typeFilter);
                countQuery = countQuery.eq('transaction_type', typeFilter);
            }

            // Search
            if (searchQuery.trim()) {
                const q = searchQuery.trim();
                const searchFilter = `card_last4.ilike.%${q}%,location_name.ilike.%${q}%,status.ilike.%${q}%`;
                query = query.or(searchFilter);
                countQuery = countQuery.or(searchFilter);
            }

            // Paginate
            query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            const [dataRes, countRes] = await Promise.all([query, countQuery]);

            if (dataRes.error) throw dataRes.error;
            setRentals(dataRes.data ?? []);
            setTotalCount(countRes.count ?? 0);
        } catch (err: any) {
            console.error('Error fetching transactions:', err);
            setError(err?.message || 'Failed to load transactions');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [page, searchQuery, selectedLocation, typeFilter]);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        fetchPage();

        const debouncedRefresh = () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => fetchPage(true), 500);
        };

        const channel = supabase
            .channel('finance-rentals-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals' }, debouncedRefresh)
            .subscribe();

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            supabase.removeChannel(channel);
        };
    }, [fetchPage]);

    // Reset to page 0 when filters change
    useEffect(() => {
        setPage(0);
    }, [searchQuery, selectedLocation, typeFilter]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPage(true);
    }, [fetchPage]);

    const handleDelete = useCallback((rentalId: string) => {
        Alert.alert(
            'Delete Transaction',
            'This will hide the transaction from view but keep it in the database.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('rentals')
                                .update({ deleted_at: new Date().toISOString() })
                                .eq('id', rentalId);
                            if (error) throw error;
                            fetchPage(true);
                        } catch (error) {
                            console.error('Error deleting transaction:', error);
                            Alert.alert('Error', 'Failed to delete transaction.');
                        }
                    },
                },
            ]
        );
    }, [fetchPage]);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    // Bajie timestamps are UTC+8 stored without timezone — subtract 8h for real UTC
    const bajieToUtc = (ts: string): Date => new Date(new Date(ts).getTime() - 8 * 60 * 60 * 1000);

    const formatDuration = (borrowTime: string, returnTime: string): string => {
        const ms = bajieToUtc(returnTime).getTime() - bajieToUtc(borrowTime).getTime();
        const totalMins = Math.round(ms / 60000);
        if (totalMins < 60) return `${totalMins}m`;
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    };

    const renderItem = useCallback(({ item: rental }: { item: RentalWithBajie }) => {
        const effectiveAmount = rental.effective_amount ?? 0;
        const isExpanded = expandedId === rental.id;
        const badge = getTypeBadgeStyle(rental.transaction_type);
        const bajieOrder = rental.bajie_orders?.[0] ?? null;

        return (
            <TouchableOpacity
                style={styles.txCard}
                activeOpacity={0.7}
                onPress={() => setExpandedId(isExpanded ? null : rental.id)}
            >
                {/* Main row */}
                <View style={styles.txMain}>
                    <View style={styles.txLeft}>
                        <Text style={styles.txDate}>{formatDate(rental.created_at)}</Text>
                        <Text style={styles.txLocation} numberOfLines={1}>{rental.location_name}</Text>
                    </View>
                    <View style={styles.txRight}>
                        <Text style={[styles.txAmount, effectiveAmount > 0 ? { color: '#34d399' } : { color: '#6b7280' }]}>
                            {formatCurrency(effectiveAmount / 100)}
                        </Text>
                        <View style={styles.txBadgeRow}>
                            <View style={[styles.txBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                                <Text style={[styles.txBadgeText, { color: badge.text }]}>
                                    {formatType(rental.transaction_type)}
                                </Text>
                            </View>
                            {rental.is_damaged && (
                                <View style={[styles.txBadge, { backgroundColor: 'rgba(251,191,36,0.12)', borderColor: '#92400e' }]}>
                                    <Text style={[styles.txBadgeText, { color: '#fbbf24' }]}>DMG</Text>
                                </View>
                            )}
                            {rental.is_accidental_multi && (
                                <View style={[styles.txBadge, { backgroundColor: 'rgba(56,189,248,0.12)', borderColor: '#0c4a6e' }]}>
                                    <Text style={[styles.txBadgeText, { color: '#38bdf8' }]}>2x</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    {isExpanded ? (
                        <ChevronUp color="#6b7280" size={16} />
                    ) : (
                        <ChevronDown color="#6b7280" size={16} />
                    )}
                </View>

                {/* Expanded detail */}
                {isExpanded && (
                    <View style={styles.txDetail}>
                        {/* Financials */}
                        <Text style={styles.detailSectionTitle}>Financials</Text>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Revenue</Text>
                            <Text style={styles.detailValue}>{formatCurrency(effectiveAmount / 100)}</Text>
                        </View>
                        {rental.venue_payout != null && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Venue cut</Text>
                                <Text style={[styles.detailValue, { color: '#9ca3af' }]}>-{formatCurrency(rental.venue_payout / 100)}</Text>
                            </View>
                        )}
                        {rental.sales_tax != null && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Sales tax</Text>
                                <Text style={[styles.detailValue, { color: '#9ca3af' }]}>-{formatCurrency(rental.sales_tax / 100)}</Text>
                            </View>
                        )}
                        {rental.my_profit != null && (
                            <>
                                <View style={styles.detailDivider} />
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, { color: '#d1d5db' }]}>Profit</Text>
                                    <Text style={[styles.detailValue, { color: '#34d399', fontWeight: '700' }]}>{formatCurrency(rental.my_profit / 100)}</Text>
                                </View>
                            </>
                        )}

                        {/* Payment info */}
                        <Text style={[styles.detailSectionTitle, { marginTop: 12 }]}>Payment</Text>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Card</Text>
                            <Text style={styles.detailValue}>
                                {rental.card_brand || ''}{rental.card_last4 ? ` •••• ${rental.card_last4}` : ' —'}
                            </Text>
                        </View>
                        {rental.wallet_type && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Wallet</Text>
                                <Text style={styles.detailValue}>{rental.wallet_type}</Text>
                            </View>
                        )}
                        {bajieOrder?.borrow_time && bajieOrder?.return_time ? (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Duration</Text>
                                <Text style={[styles.detailValue, { fontWeight: '600' }]}>{formatDuration(bajieOrder.borrow_time, bajieOrder.return_time)}</Text>
                            </View>
                        ) : rental.rental_hours != null ? (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Duration</Text>
                                <Text style={styles.detailValue}>{rental.rental_hours} Hour</Text>
                            </View>
                        ) : null}
                        {(rental.transaction_type === 'refunded' || rental.transaction_type === 'partially_refunded') && rental.amount_refunded != null && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Refunded</Text>
                                <Text style={[styles.detailValue, { color: '#c084fc' }]}>{formatCurrency(rental.amount_refunded / 100)}</Text>
                            </View>
                        )}
                        {rental.transaction_type === 'failed' && (rental.failure_code || rental.failure_message) && (
                            <View style={styles.failureBox}>
                                <Text style={styles.failureCode}>{rental.failure_code || 'Payment failed'}</Text>
                                {rental.failure_message && (
                                    <Text style={styles.failureMessage}>{rental.failure_message}</Text>
                                )}
                            </View>
                        )}

                        {/* Hardware */}
                        {(rental.station_id || bajieOrder?.battery_id) && (
                            <>
                                <Text style={[styles.detailSectionTitle, { marginTop: 12 }]}>Hardware</Text>
                                {bajieOrder?.battery_id && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Battery</Text>
                                        <Text style={[styles.detailValue, { fontFamily: 'monospace', fontSize: 11 }]}>{bajieOrder.battery_id}</Text>
                                    </View>
                                )}
                                {bajieOrder?.borrow_slot != null && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Slot</Text>
                                        <Text style={styles.detailValue}>#{bajieOrder.borrow_slot}</Text>
                                    </View>
                                )}
                                {rental.station_id && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Cabinet</Text>
                                        <Text style={[styles.detailValue, { fontFamily: 'monospace', fontSize: 11 }]}>{rental.station_id}</Text>
                                    </View>
                                )}
                            </>
                        )}

                        {/* Delete */}
                        <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDelete(rental.id)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.deleteBtnText}>Delete Transaction</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </TouchableOpacity>
        );
    }, [expandedId, handleDelete]);

    if (loading && rentals.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#60a5fa" />
                <Text style={styles.loadingText}>Loading transactions...</Text>
            </View>
        );
    }

    if (error && !loading && rentals.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <View style={styles.errorCard}>
                    <Text style={styles.errorTitle}>Something went wrong</Text>
                    <Text style={styles.errorMessage}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPage()} activeOpacity={0.7}>
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Search bar */}
            <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                    <Search color="#6b7280" size={16} />
                    <TextInput
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search card last 4, location..."
                        placeholderTextColor="#6b7280"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>
            </View>

            {/* Filter pills */}
            <View style={styles.filterRow}>
                <TouchableOpacity
                    style={[styles.filterBtn, showTypeFilter && styles.filterBtnActive]}
                    onPress={() => { setShowTypeFilter(!showTypeFilter); setShowLocationFilter(false); }}
                    activeOpacity={0.7}
                >
                    <Filter color={showTypeFilter ? '#fff' : '#9ca3af'} size={14} />
                    <Text style={[styles.filterBtnText, showTypeFilter && styles.filterBtnTextActive]}>
                        {TYPE_FILTERS.find(f => f.key === typeFilter)?.label ?? 'Paid Only'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.filterBtn, showLocationFilter && styles.filterBtnActive]}
                    onPress={() => { setShowLocationFilter(!showLocationFilter); setShowTypeFilter(false); }}
                    activeOpacity={0.7}
                >
                    <Filter color={showLocationFilter ? '#fff' : '#9ca3af'} size={14} />
                    <Text style={[styles.filterBtnText, showLocationFilter && styles.filterBtnTextActive]}>
                        {selectedLocation === 'all' ? 'All Locations' : selectedLocation}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Type filter dropdown */}
            {showTypeFilter && (
                <View style={styles.dropdown}>
                    {TYPE_FILTERS.map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.dropdownItem, typeFilter === f.key && styles.dropdownItemActive]}
                            onPress={() => { setTypeFilter(f.key); setShowTypeFilter(false); }}
                        >
                            <Text style={[styles.dropdownText, typeFilter === f.key && styles.dropdownTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Location filter dropdown */}
            {showLocationFilter && (
                <View style={styles.dropdown}>
                    <TouchableOpacity
                        style={[styles.dropdownItem, selectedLocation === 'all' && styles.dropdownItemActive]}
                        onPress={() => { setSelectedLocation('all'); setShowLocationFilter(false); }}
                    >
                        <Text style={[styles.dropdownText, selectedLocation === 'all' && styles.dropdownTextActive]}>
                            All Locations
                        </Text>
                    </TouchableOpacity>
                    {allLocations.map(loc => (
                        <TouchableOpacity
                            key={loc}
                            style={[styles.dropdownItem, selectedLocation === loc && styles.dropdownItemActive]}
                            onPress={() => { setSelectedLocation(loc); setShowLocationFilter(false); }}
                        >
                            <Text style={[styles.dropdownText, selectedLocation === loc && styles.dropdownTextActive]} numberOfLines={1}>
                                {loc}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Transaction list */}
            <FlatList
                data={rentals}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60a5fa" />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Receipt color="#6b7280" size={32} />
                        <Text style={styles.emptyText}>
                            {searchQuery || selectedLocation !== 'all' || typeFilter !== 'paid'
                                ? 'No transactions found'
                                : 'No transactions yet'}
                        </Text>
                    </View>
                }
                ListFooterComponent={
                    totalCount > 0 ? (
                        <View style={styles.pagination}>
                            <Text style={styles.pageInfo}>
                                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
                            </Text>
                            <View style={styles.pageButtons}>
                                <TouchableOpacity
                                    style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
                                    onPress={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                >
                                    <Text style={[styles.pageBtnText, page === 0 && styles.pageBtnTextDisabled]}>Previous</Text>
                                </TouchableOpacity>
                                <Text style={styles.pageNumber}>{page + 1}/{totalPages}</Text>
                                <TouchableOpacity
                                    style={[styles.pageBtn, (page + 1) * PAGE_SIZE >= totalCount && styles.pageBtnDisabled]}
                                    onPress={() => setPage(p => p + 1)}
                                    disabled={(page + 1) * PAGE_SIZE >= totalCount}
                                >
                                    <Text style={[styles.pageBtnText, (page + 1) * PAGE_SIZE >= totalCount && styles.pageBtnTextDisabled]}>Next</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111827' },
    loadingContainer: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#9ca3af', marginTop: 12, fontSize: 14 },
    errorCard: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 16, padding: 28, alignItems: 'center' as const, gap: 10 },
    errorTitle: { color: '#f87171', fontSize: 18, fontWeight: '700' as const },
    errorMessage: { color: '#9ca3af', fontSize: 13, textAlign: 'center' as const },
    retryBtn: { marginTop: 10, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: 10 },
    retryBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' as const },
    list: { paddingHorizontal: 12, paddingBottom: 24 },

    // Search
    searchRow: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#1f2937',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        paddingHorizontal: 12,
    },
    searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 10 },

    // Filters
    filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 18,
        backgroundColor: '#1f2937',
        borderWidth: 1,
        borderColor: '#374151',
    },
    filterBtnActive: { backgroundColor: '#2563eb', borderColor: '#3b82f6' },
    filterBtnText: { color: '#9ca3af', fontSize: 12, fontWeight: '500' },
    filterBtnTextActive: { color: '#fff' },

    // Dropdown
    dropdown: {
        marginHorizontal: 12,
        marginBottom: 8,
        backgroundColor: '#1f2937',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        overflow: 'hidden',
    },
    dropdownItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#374151' },
    dropdownItemActive: { backgroundColor: 'rgba(37,99,235,0.15)' },
    dropdownText: { color: '#d1d5db', fontSize: 13 },
    dropdownTextActive: { color: '#60a5fa', fontWeight: '600' },

    // Transaction card
    txCard: {
        backgroundColor: '#1f2937',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#374151',
        marginBottom: 8,
        overflow: 'hidden',
    },
    txMain: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 10,
    },
    txLeft: { flex: 1 },
    txDate: { color: '#d1d5db', fontSize: 13 },
    txLocation: { color: '#6b7280', fontSize: 11, marginTop: 2 },
    txRight: { alignItems: 'flex-end', marginRight: 4 },
    txAmount: { fontSize: 16, fontWeight: '700' },
    txBadgeRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
    txBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 1,
    },
    txBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },

    // Expanded detail
    txDetail: {
        backgroundColor: 'rgba(17,24,39,0.6)',
        borderTopWidth: 1,
        borderTopColor: '#374151',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    detailSectionTitle: {
        color: '#6b7280',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    detailLabel: { color: '#6b7280', fontSize: 12 },
    detailValue: { color: '#fff', fontSize: 12, fontWeight: '500' },
    detailDivider: { height: 1, backgroundColor: '#374151', marginVertical: 6 },

    // Failure box
    failureBox: {
        marginTop: 8,
        padding: 10,
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.2)',
        borderRadius: 8,
    },
    failureCode: { color: '#f87171', fontSize: 11, fontWeight: '600' },
    failureMessage: { color: 'rgba(248,113,113,0.6)', fontSize: 11, marginTop: 2 },

    // Delete button
    deleteBtn: {
        marginTop: 14,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
        alignItems: 'center',
    },
    deleteBtnText: { color: '#f87171', fontSize: 12, fontWeight: '600' },

    // Empty state
    emptyContainer: { paddingVertical: 48, alignItems: 'center', gap: 12 },
    emptyText: { color: '#6b7280', fontSize: 14 },

    // Pagination
    pagination: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 4,
    },
    pageInfo: { color: '#6b7280', fontSize: 11 },
    pageButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pageBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#1f2937',
        borderWidth: 1,
        borderColor: '#374151',
    },
    pageBtnDisabled: { opacity: 0.4 },
    pageBtnText: { color: '#d1d5db', fontSize: 12, fontWeight: '500' },
    pageBtnTextDisabled: { color: '#6b7280' },
    pageNumber: { color: '#6b7280', fontSize: 11 },
});
