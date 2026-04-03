import { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
} from 'react-native';
import { Activity, Heart, AlertCircle, WifiOff, Zap, Clock } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type MachineEvent = Database['public']['Tables']['machine_events']['Row'];
type DowntimePeriod = Database['public']['Tables']['downtime_periods']['Row'];
type DowntimeLog = Database['public']['Tables']['downtime_logs']['Row'];
type ActiveRental = Database['public']['Tables']['active_rentals']['Row'];
type BatteryRow = Database['public']['Tables']['batteries']['Row'];

const BATTERY_FAULT_NAMES: Record<number, string> = {
    0: 'Normal', 1: 'False charge', 2: 'Lightning cable fault', 3: 'USB cable fault',
    4: 'Type-C fault', 5: 'Swollen battery', 6: 'Auth failed', 7: 'Unable to charge',
    8: 'Duplicate ID', 9: 'Recall', 10: 'Health below standard', 11: 'Over-limit use',
};

const SLOT_FAULT_NAMES: Record<number, string> = {
    1: 'Battery auth failed', 2: "Can't eject", 3: 'ID not found',
    4: 'Anti-theft switch', 5: "Can't identify ID", 6: 'Insert switch failed',
    7: "Can't lock", 8: 'Manually locked',
};

interface ParsedEvent {
    summary: string;
    isAbnormal: boolean;
    reasons: string[];
    locationName: string;
}

function parseEvent(event: MachineEvent, cabinetToName: Map<string, string>): ParsedEvent {
    const data = event.event_data;
    const cabinetId = (event.cabinet_id || (data?.cabinetId as string)) || '';
    const locationName = cabinetToName.get(cabinetId) || cabinetId;
    const reasons: string[] = [];

    if (event.event_type === 'CABINET_STATUS' && data) {
        const status = data.infoStatus as string;
        const total = data.totalCount as number;
        const rentable = data.rentableCount as number;
        const signal = parseInt(data.signal as string || '0', 10);
        const batteries = data.batteryList as Array<Record<string, unknown>> | undefined;

        if (status !== 'Online') reasons.push(`Cabinet ${status?.toLowerCase() || 'offline'}`);
        if (signal > 0 && signal < 15) reasons.push(`Weak signal (${signal}%)`);

        if (batteries) {
            for (const b of batteries) {
                const bf = b.batteryFaultType as number;
                const sf = b.faultType as number;
                if (bf > 0) reasons.push(`Battery ${(b.batteryId as string || '').slice(-4)}: ${BATTERY_FAULT_NAMES[bf] || `fault #${bf}`}`);
                if (sf > 0) reasons.push(`Slot ${b.slot}: ${SLOT_FAULT_NAMES[sf] || `fault #${sf}`}`);
            }
        }

        const isAbnormal = reasons.length > 0;
        const summary = isAbnormal
            ? reasons[0] + (reasons.length > 1 ? ` (+${reasons.length - 1} more)` : '')
            : `Online — ${rentable}/${total} available, signal ${signal}%`;
        return { summary, isAbnormal, reasons, locationName };
    }

    if (event.event_type === 'POS_INFO_STATUS' && data) {
        const posStatus = data.posInfoStatus as number;
        const isOffline = posStatus !== 1;
        if (isOffline) reasons.push('POS reader offline');
        return { summary: isOffline ? 'POS reader offline' : 'POS reader online', isAbnormal: isOffline, reasons, locationName };
    }

    if (event.event_type === 'CABINET_OFFLINE')
        return { summary: 'Cabinet went offline', isAbnormal: true, reasons: ['Cabinet offline'], locationName };

    if (event.event_type === 'CABINET_ONLINE')
        return { summary: 'Cabinet came online', isAbnormal: false, reasons: [], locationName };

    if (event.event_type === 'BATTERY_ABNORMAL_WARNING' && data) {
        const faultType = data.batteryFaultType as number || 0;
        const reason = BATTERY_FAULT_NAMES[faultType] || `Fault #${faultType}`;
        return { summary: `Battery warning: ${reason}`, isAbnormal: true, reasons: [reason], locationName };
    }

    return { summary: event.event_type.replace(/_/g, ' ').toLowerCase(), isAbnormal: false, reasons: [], locationName };
}

function formatRelative(dateString: string): string {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
}

function formatDuration(minutes: number | null): string {
    if (minutes == null) return 'ongoing';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export default function OpsScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [downtimeLogs, setDowntimeLogs] = useState<DowntimeLog[]>([]);
    const [downtimePeriods, setDowntimePeriods] = useState<DowntimePeriod[]>([]);
    const [activeRentals, setActiveRentals] = useState<ActiveRental[]>([]);
    const [events, setEvents] = useState<MachineEvent[]>([]);
    const [batteries, setBatteries] = useState<BatteryRow[]>([]);
    const [accidentalMultiCount, setAccidentalMultiCount] = useState(0);
    const [cabinetToName, setCabinetToName] = useState<Map<string, string>>(new Map());
    const [offlineMachineCount, setOfflineMachineCount] = useState(0);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError(null);

        try {
            const [logsRes, periodsRes, rentalsRes, eventsRes, batteriesRes, multiRes, locationsRes] = await Promise.all([
                supabase.from('downtime_logs').select('*').order('logged_at', { ascending: false }).limit(20),
                supabase.from('downtime_periods').select('*').order('offline_at', { ascending: false }).limit(20),
                supabase.from('active_rentals').select('*').order('borrow_time', { ascending: false }),
                supabase.from('machine_events').select('*').order('event_timestamp', { ascending: false }).limit(50),
                supabase.from('batteries').select('*').order('is_healthy', { ascending: true }).order('charge_pct', { ascending: true }),
                supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('is_accidental_multi', true).is('deleted_at', null),
                supabase.from('locations').select('name, station_id, machine_status').not('station_id', 'is', null),
            ]);

            if (logsRes.data) setDowntimeLogs(logsRes.data);
            if (periodsRes.data) setDowntimePeriods(periodsRes.data);
            if (rentalsRes.data) setActiveRentals(rentalsRes.data);
            if (eventsRes.data) setEvents(eventsRes.data);
            if (batteriesRes.data) setBatteries(batteriesRes.data);
            setAccidentalMultiCount(multiRes.count ?? 0);

            if (locationsRes.data) {
                const map = new Map<string, string>();
                let offlineCount = 0;
                for (const loc of locationsRes.data) {
                    if (loc.station_id) map.set(loc.station_id, loc.name);
                    if (loc.machine_status === 'offline') offlineCount++;
                }
                setCabinetToName(map);
                setOfflineMachineCount(offlineCount);
            }
        } catch (err: any) {
            console.error('Error fetching operations data:', err);
            setError(err?.message || 'Failed to load operations');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        fetchData();

        const debouncedRefresh = () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => fetchData(true), 500);
        };

        const channel = supabase
            .channel('ops-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'machine_events' }, debouncedRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'active_rentals' }, debouncedRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'downtime_periods' }, debouncedRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'batteries' }, debouncedRefresh)
            .subscribe();

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            supabase.removeChannel(channel);
        };
    }, [fetchData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData(true);
    }, [fetchData]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#60a5fa" />
                <Text style={styles.loadingText}>Loading operations...</Text>
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

    const healthyCount = batteries.filter(b => b.is_healthy).length;
    const faultedCount = batteries.filter(b => !b.is_healthy).length;
    const totalBatteries = batteries.length;

    // Parse events and filter to abnormal only
    const abnormalEvents = events
        .map(e => ({ event: e, parsed: parseEvent(e, cabinetToName) }))
        .filter(({ parsed }) => parsed.isAbnormal);

    // Active downtime (machines currently offline)
    const activeDowntime = downtimePeriods.filter(p => !p.online_at);

    // Deduplicated downtime logs (latest per station)
    const dedupedLogs = Array.from(
        downtimeLogs.reduce((map, log) => {
            const existing = map.get(log.station_id);
            if (!existing || new Date(log.logged_at) > new Date(existing.logged_at)) {
                map.set(log.station_id, log);
            }
            return map;
        }, new Map<string, DowntimeLog>()).values()
    );

    // Hours out for active rentals
    const hoursOut = (borrowTime: string): string => {
        const hrs = ((Date.now() - new Date(borrowTime).getTime()) / (1000 * 60 * 60)).toFixed(1);
        return `${hrs}h`;
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60a5fa" />}
        >
            {/* Summary Cards */}
            <View style={styles.cardRow}>
                <View style={styles.summaryCard}>
                    <Heart color={faultedCount > 0 ? '#fbbf24' : '#34d399'} size={18} />
                    <Text style={styles.summaryValue}>{healthyCount}/{totalBatteries}</Text>
                    <Text style={styles.summaryLabel}>Fleet Health</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Zap color="#60a5fa" size={18} />
                    <Text style={styles.summaryValue}>{activeRentals.length}</Text>
                    <Text style={styles.summaryLabel}>Active Rentals</Text>
                </View>
            </View>
            <View style={styles.cardRow}>
                <View style={styles.summaryCard}>
                    <WifiOff color={offlineMachineCount > 0 ? '#f87171' : '#34d399'} size={18} />
                    <Text style={styles.summaryValue}>{offlineMachineCount}</Text>
                    <Text style={styles.summaryLabel}>Machines Down</Text>
                </View>
                <View style={styles.summaryCard}>
                    <AlertCircle color={accidentalMultiCount > 0 ? '#fbbf24' : '#6b7280'} size={18} />
                    <Text style={styles.summaryValue}>{accidentalMultiCount}</Text>
                    <Text style={styles.summaryLabel}>Double-Taps</Text>
                </View>
            </View>

            {/* Alerts Section */}
            <Text style={styles.sectionTitle}>
                Alerts {abnormalEvents.length > 0 && <Text style={{ color: '#f87171' }}>({abnormalEvents.length})</Text>}
            </Text>
            {abnormalEvents.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No alerts — all systems normal</Text>
                </View>
            ) : (
                abnormalEvents.map(({ event, parsed }) => (
                    <View key={event.id} style={styles.alertCard}>
                        <View style={styles.alertHeader}>
                            <Text style={styles.alertLocation} numberOfLines={1}>{parsed.locationName}</Text>
                            <Text style={styles.alertTime}>{formatRelative(event.event_timestamp)}</Text>
                        </View>
                        <Text style={styles.alertSummary}>{parsed.summary}</Text>
                        {parsed.reasons.length > 1 && (
                            <View style={styles.alertReasons}>
                                {parsed.reasons.slice(1).map((reason, i) => (
                                    <Text key={i} style={styles.alertReason}>• {reason}</Text>
                                ))}
                            </View>
                        )}
                    </View>
                ))
            )}

            {/* Active Downtime */}
            {activeDowntime.length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>Active Downtime</Text>
                    {activeDowntime.map((period) => (
                        <View key={period.id} style={styles.downtimeCard}>
                            <View style={styles.downtimeHeader}>
                                <WifiOff color="#f87171" size={14} />
                                <Text style={styles.downtimeName} numberOfLines={1}>
                                    {period.location_name || cabinetToName.get(period.station_id) || period.station_id}
                                </Text>
                            </View>
                            <View style={styles.downtimeInfo}>
                                <Text style={styles.downtimeLabel}>Offline since</Text>
                                <Text style={styles.downtimeValue}>{formatRelative(period.offline_at)}</Text>
                            </View>
                        </View>
                    ))}
                </>
            )}

            {/* Downtime History (if no active downtime, show logs) */}
            {activeDowntime.length === 0 && dedupedLogs.length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>Downtime History (7d)</Text>
                    {dedupedLogs.map((log) => (
                        <View key={log.id} style={styles.downtimeCard}>
                            <View style={styles.downtimeHeader}>
                                <Clock color="#6b7280" size={14} />
                                <Text style={styles.downtimeName} numberOfLines={1}>
                                    {log.location_name || cabinetToName.get(log.station_id) || log.station_id}
                                </Text>
                            </View>
                            <View style={styles.downtimeInfo}>
                                <Text style={styles.downtimeLabel}>Offline events (7d)</Text>
                                <Text style={[styles.downtimeValue, log.offline_times_7d > 0 ? { color: '#fbbf24' } : {}]}>
                                    {log.offline_times_7d}
                                </Text>
                            </View>
                        </View>
                    ))}
                </>
            )}

            {/* Active Rentals (Batteries Out) */}
            {activeRentals.length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>Batteries Out ({activeRentals.length})</Text>
                    {activeRentals.map((rental) => (
                        <View key={rental.id} style={styles.rentalCard}>
                            <View style={styles.rentalLeft}>
                                <Text style={styles.rentalBattery} numberOfLines={1}>{rental.battery_id}</Text>
                                <Text style={styles.rentalLocation}>
                                    {cabinetToName.get(rental.cabinet_id) || rental.cabinet_id}
                                    {rental.slot != null ? ` · Slot #${rental.slot}` : ''}
                                </Text>
                            </View>
                            <View style={styles.rentalRight}>
                                <Text style={[styles.rentalHours, parseFloat(hoursOut(rental.borrow_time)) > 5 ? { color: '#f87171' } : { color: '#fbbf24' }]}>
                                    {hoursOut(rental.borrow_time)}
                                </Text>
                                <Text style={styles.rentalBorrowTime}>{formatRelative(rental.borrow_time)}</Text>
                            </View>
                        </View>
                    ))}
                </>
            )}

            {/* Faulted Batteries */}
            {faultedCount > 0 && (
                <>
                    <Text style={styles.sectionTitle}>Faulted Batteries ({faultedCount})</Text>
                    {batteries.filter(b => !b.is_healthy).map((battery) => (
                        <View key={battery.battery_id} style={styles.faultCard}>
                            <View style={styles.faultLeft}>
                                <Text style={styles.faultBattery}>{battery.battery_id}</Text>
                                <Text style={styles.faultLocation}>
                                    {cabinetToName.get(battery.cabinet_id) || battery.cabinet_id}
                                </Text>
                            </View>
                            <View style={styles.faultRight}>
                                <Text style={styles.faultType}>
                                    {battery.battery_fault_type > 0
                                        ? BATTERY_FAULT_NAMES[battery.battery_fault_type] || `Fault #${battery.battery_fault_type}`
                                        : battery.slot_fault_type > 0
                                            ? SLOT_FAULT_NAMES[battery.slot_fault_type] || `Slot fault #${battery.slot_fault_type}`
                                            : 'Unknown fault'}
                                </Text>
                                {battery.charge_pct != null && (
                                    <Text style={styles.faultCharge}>{battery.charge_pct}%</Text>
                                )}
                            </View>
                        </View>
                    ))}
                </>
            )}
        </ScrollView>
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

    // Summary cards
    cardRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    summaryCard: {
        flex: 1, backgroundColor: '#1f2937', borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: '#374151', alignItems: 'center', gap: 6,
    },
    summaryValue: { color: '#fff', fontSize: 24, fontWeight: '700' },
    summaryLabel: { color: '#6b7280', fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },

    // Sections
    sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 10 },

    // Empty state
    emptyCard: { backgroundColor: '#1f2937', borderRadius: 12, padding: 24, borderWidth: 1, borderColor: '#374151', alignItems: 'center' },
    emptyText: { color: '#34d399', fontSize: 13, fontWeight: '500' },

    // Alert cards
    alertCard: {
        backgroundColor: '#1f2937', borderRadius: 10, padding: 14,
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', marginBottom: 8,
        borderLeftWidth: 3, borderLeftColor: '#f87171',
    },
    alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    alertLocation: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
    alertTime: { color: '#6b7280', fontSize: 11 },
    alertSummary: { color: '#f87171', fontSize: 12, fontWeight: '500' },
    alertReasons: { marginTop: 6 },
    alertReason: { color: '#9ca3af', fontSize: 11, marginBottom: 2 },

    // Downtime cards
    downtimeCard: {
        backgroundColor: '#1f2937', borderRadius: 10, padding: 14,
        borderWidth: 1, borderColor: '#374151', marginBottom: 8,
    },
    downtimeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    downtimeName: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
    downtimeInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    downtimeLabel: { color: '#6b7280', fontSize: 12 },
    downtimeValue: { color: '#fff', fontSize: 12, fontWeight: '500' },

    // Active rental cards
    rentalCard: {
        backgroundColor: '#1f2937', borderRadius: 10, padding: 14,
        borderWidth: 1, borderColor: '#374151', marginBottom: 8,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    rentalLeft: { flex: 1, marginRight: 10 },
    rentalBattery: { color: '#fff', fontSize: 12, fontWeight: '600', fontFamily: 'monospace' },
    rentalLocation: { color: '#6b7280', fontSize: 11, marginTop: 2 },
    rentalRight: { alignItems: 'flex-end' },
    rentalHours: { fontSize: 16, fontWeight: '700' },
    rentalBorrowTime: { color: '#6b7280', fontSize: 10, marginTop: 2 },

    // Faulted battery cards
    faultCard: {
        backgroundColor: '#1f2937', borderRadius: 10, padding: 14,
        borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', marginBottom: 8,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderLeftWidth: 3, borderLeftColor: '#fbbf24',
    },
    faultLeft: { flex: 1, marginRight: 10 },
    faultBattery: { color: '#fff', fontSize: 12, fontWeight: '600', fontFamily: 'monospace' },
    faultLocation: { color: '#6b7280', fontSize: 11, marginTop: 2 },
    faultRight: { alignItems: 'flex-end' },
    faultType: { color: '#fbbf24', fontSize: 11, fontWeight: '600', textAlign: 'right' },
    faultCharge: { color: '#6b7280', fontSize: 11, marginTop: 2 },
});
