import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
    Modal,
} from 'react-native';
import { Server, Wifi, WifiOff, AlertTriangle, Battery, Zap, DollarSign, X, Heart, AlertCircle } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Location = Database['public']['Tables']['locations']['Row'];
type BatteryHealth = Database['public']['Tables']['batteries']['Row'];

interface MachineData {
    status: { online: boolean; emptySlots: number; busySlots: number; totalSlots: number };
    specs: { signal: string; ip: string; cabinetType: string; cabinetId: string };
    priceStrategy: {
        price: number; currencySymbol: string; depositAmount: number;
        timeoutAmount: number; freeMinutes: number; priceMinute: number; dailyMaxPrice: number;
    };
    batteries: Array<{ slotNum: number; batteryId: string | null; vol: number }>;
}

// Raw battery data from Bajie /cabinet/batteryListByCabinetId API — not in DB types
interface RawBatteryDetail {
    pBatteryid?: string; pKakou?: number; pDianliang?: number; pTemperature?: number;
    pCapacity?: number; pIosStatus?: number; pTypecStatus?: number; pMicroStatus?: number;
    pZujienum?: number; pZjztime?: number; pTotalrevenue?: number; pRegtime?: string;
    pCheckResult?: string; pFaultType?: number; pState?: number; pLogtime?: string;
    pBorrowtime?: string; pAuthfailTime?: number;
}

const BATTERY_FAULT_NAMES: Record<number, string> = {
    1: 'False charge', 2: 'Lightning cable fault', 3: 'USB cable fault',
    4: 'Type-C fault', 5: 'Swollen battery', 6: 'Auth failed',
    7: 'Unable to charge', 8: 'Duplicate ID', 9: 'Battery recall',
    10: 'Health below standard', 11: 'Over-limit use',
};

const SLOT_FAULT_NAMES: Record<number, string> = {
    1: 'Battery auth failed', 2: "Slot can't eject", 3: 'ID not found',
    4: 'Anti-theft switch', 5: "Can't identify ID", 6: 'Insert switch failed',
    7: "Slot can't lock", 8: 'Manually locked',
};

function getFaultLabel(health: BatteryHealth): string {
    if (health.battery_fault_type > 0)
        return BATTERY_FAULT_NAMES[health.battery_fault_type] || `Battery fault ${health.battery_fault_type}`;
    if (health.slot_fault_type > 0)
        return SLOT_FAULT_NAMES[health.slot_fault_type] || `Slot fault ${health.slot_fault_type}`;
    return 'Unknown fault';
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

const formatTimestamp = (ts: string): string =>
    new Date(ts).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });

export default function MachineDetailScreen() {
    const { name } = useLocalSearchParams<{ name: string }>();
    const [location, setLocation] = useState<Location | null>(null);
    const [machineData, setMachineData] = useState<MachineData | null>(null);
    const [batteryHealth, setBatteryHealth] = useState<BatteryHealth[]>([]);
    const [rawBatteryDetails, setRawBatteryDetails] = useState<Map<string, RawBatteryDetail>>(new Map());
    const [selectedBatteryId, setSelectedBatteryId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Step 1: Get location with station_id
            const { data: locData, error: locError } = await supabase
                .from('locations')
                .select('*')
                .eq('name', name)
                .maybeSingle();
            if (locError) throw new Error(locError.message);
            if (!locData) throw new Error('Location not found');
            setLocation(locData);

            if (!locData.station_id) {
                setError('No Station ID assigned to this location.');
                return;
            }

            // Step 2: Fetch Bajie data via edge functions (with timeout)
            const [detailsResult, batteriesResult] = await Promise.all([
                Promise.race([
                    supabase.functions.invoke('get-machine-details', { body: { cabinetId: locData.station_id } }),
                    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 10000)),
                ]),
                supabase.functions.invoke('get-machine-batteries', { body: { cabinetId: locData.station_id } }).catch(() => null),
            ]);

            const { data, error: funcError } = detailsResult as any;
            if (funcError) throw new Error(`API error: ${funcError.message || funcError}`);
            if (!data?.data?.cabinet) throw new Error('No cabinet data in API response');

            const apiData = data.data;
            const totalSlots: number = apiData.cabinet.slots ?? 0;
            const rawBatteries = apiData.batteries || [];
            const dockedBatteries = rawBatteries.map((b: any) => ({
                slotNum: b.slotNum, batteryId: b.batteryId, vol: b.vol ?? 0,
            }));

            // Parse battery diagnostics
            if ((batteriesResult as any)?.data?.data && Array.isArray((batteriesResult as any).data.data)) {
                const detailMap = new Map<string, RawBatteryDetail>();
                for (const b of (batteriesResult as any).data.data) {
                    const id = b.pBatteryid || b.pbatteryid;
                    if (id) detailMap.set(id, b);
                }
                setRawBatteryDetails(detailMap);
            }

            // Build slot array (filled + empty)
            const allSlots: MachineData['batteries'] = [];
            for (let i = 1; i <= totalSlots; i++) {
                const docked = dockedBatteries.find((x: any) => x.slotNum === i);
                allSlots.push(docked ? { slotNum: docked.slotNum, batteryId: docked.batteryId, vol: docked.vol } : { slotNum: i, batteryId: null, vol: 0 });
            }

            setMachineData({
                status: {
                    online: locData.machine_status === 'online',
                    emptySlots: allSlots.filter(s => !s.batteryId).length,
                    busySlots: allSlots.filter(s => !!s.batteryId).length,
                    totalSlots,
                },
                specs: {
                    signal: apiData.cabinet.signal ?? '',
                    ip: apiData.cabinet.ip || 'Unknown',
                    cabinetType: apiData.cabinet.type || 'Unknown',
                    cabinetId: apiData.cabinet.id || locData.station_id || '',
                },
                priceStrategy: {
                    price: apiData.priceStrategy?.price ?? 0,
                    currencySymbol: apiData.priceStrategy?.currencySymbol ?? '$',
                    depositAmount: apiData.priceStrategy?.depositAmount ?? 0,
                    timeoutAmount: apiData.priceStrategy?.timeoutAmount ?? 0,
                    freeMinutes: apiData.priceStrategy?.freeMinutes ?? 0,
                    priceMinute: apiData.priceStrategy?.priceMinute ?? 60,
                    dailyMaxPrice: apiData.priceStrategy?.dailyMaxPrice ?? 0,
                },
                batteries: allSlots,
            });

            // Step 3: Fetch battery health from DB
            const { data: healthData } = await supabase
                .from('batteries')
                .select('*')
                .eq('cabinet_id', locData.station_id)
                .order('slot');
            if (healthData) setBatteryHealth(healthData);

            // Step 4: Sync pricing back to locations table
            const ps = apiData.priceStrategy;
            const syncPayload: any = { empty_slots: allSlots.filter(s => !s.batteryId).length };
            if (ps?.timeoutAmount != null) syncPayload.lost_fee = Math.round(Number(ps.timeoutAmount) * 100);
            if (ps?.dailyMaxPrice != null) syncPayload.daily_cap = Math.round(Number(ps.dailyMaxPrice) * 100);
            if (ps?.price != null && ps?.priceMinute != null && Number(ps.priceMinute) > 0) {
                syncPayload.hourly_rate = Math.round((Number(ps.price) / (Number(ps.priceMinute) / 60)) * 100);
            }
            await supabase.from('locations').update(syncPayload).eq('name', name);

        } catch (err: any) {
            console.error('MachineDetail fetch error:', err);
            setError(err.message || 'Failed to load machine data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [name]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [fetchData]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Loading state
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#60a5fa" />
                <Text style={styles.loadingText}>Loading machine...</Text>
            </View>
        );
    }

    // Error state
    if (error || !machineData) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={[styles.content, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}>
                <View style={styles.errorCard}>
                    <AlertTriangle color="#f87171" size={36} />
                    <Text style={styles.errorTitle}>Failed to Load</Text>
                    <Text style={styles.errorMessage}>{error || 'No data received from API.'}</Text>
                    {location?.station_id && (
                        <Text style={styles.errorStation}>Station: {location.station_id}</Text>
                    )}
                    <TouchableOpacity style={styles.retryBtn} onPress={fetchData} activeOpacity={0.7}>
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    }

    const ps = machineData.priceStrategy;
    const signalVal = parseInt(machineData.specs.signal, 10);
    const signalColor = !isNaN(signalVal) ? (signalVal > 20 ? '#34d399' : signalVal > 10 ? '#fbbf24' : '#f87171') : '#9ca3af';
    const SignalIcon = !isNaN(signalVal) && signalVal <= 10 ? WifiOff : Wifi;
    const healthyCount = batteryHealth.filter(b => b.is_healthy).length;
    const faultedCount = batteryHealth.filter(b => !b.is_healthy).length;

    // Selected battery for modal
    const selectedSlot = selectedBatteryId ? machineData.batteries.find(s => s.batteryId === selectedBatteryId) : null;
    const selectedHealth = selectedBatteryId ? batteryHealth.find(b => b.battery_id === selectedBatteryId) : null;
    const selectedRaw = selectedBatteryId ? rawBatteryDetails.get(selectedBatteryId) : null;

    return (
        <>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60a5fa" />}
            >
                {/* Header */}
                <View style={styles.headerRow}>
                    <Server color="#60a5fa" size={24} />
                    <Text style={styles.name} numberOfLines={1}>{location?.name ?? name}</Text>
                    <View style={[styles.statusDot, { backgroundColor: machineData.status.online ? '#22c55e' : '#ef4444' }]} />
                </View>
                <Text style={styles.address}>
                    {[location?.address_line1, location?.city, location?.state].filter(Boolean).join(', ')}
                </Text>
                {location?.last_status_update_at && (
                    <Text style={styles.heartbeatText}>Last heartbeat: {formatRelative(location.last_status_update_at)}</Text>
                )}

                {/* Slot counts */}
                <View style={styles.countRow}>
                    <View style={styles.countCard}>
                        <Text style={styles.countLabel}>Empty Slots</Text>
                        <Text style={[styles.countValue, { color: '#f87171' }]}>{machineData.status.emptySlots}</Text>
                    </View>
                    <View style={styles.countCard}>
                        <Text style={styles.countLabel}>Batteries</Text>
                        <Text style={[styles.countValue, { color: '#34d399' }]}>{machineData.status.busySlots}</Text>
                    </View>
                </View>

                {/* Pricing Strategy */}
                <View style={styles.card}>
                    <View style={styles.cardTitleRow}>
                        <DollarSign color="#34d399" size={18} />
                        <Text style={styles.cardTitle}>Pricing Strategy</Text>
                    </View>
                    <View style={styles.priceMain}>
                        <Text style={styles.priceValue}>{ps.currencySymbol}{ps.price}</Text>
                        <Text style={styles.priceSub}>per {ps.priceMinute} mins</Text>
                    </View>
                    <View style={styles.priceGrid}>
                        <View style={styles.priceCell}>
                            <Text style={styles.priceCellLabel}>Daily Cap</Text>
                            <Text style={styles.priceCellValue}>{ps.currencySymbol}{ps.dailyMaxPrice}</Text>
                        </View>
                        <View style={styles.priceCell}>
                            <Text style={styles.priceCellLabel}>Deposit</Text>
                            <Text style={styles.priceCellValue}>{ps.currencySymbol}{ps.depositAmount}</Text>
                        </View>
                        <View style={styles.priceCell}>
                            <Text style={styles.priceCellLabel}>Free Time</Text>
                            <Text style={[styles.priceCellValue, { color: '#34d399' }]}>{ps.freeMinutes}m</Text>
                        </View>
                        <View style={styles.priceCell}>
                            <Text style={styles.priceCellLabel}>Lost Fee</Text>
                            <Text style={[styles.priceCellValue, { color: '#fb923c' }]}>{ps.currencySymbol}{ps.timeoutAmount}</Text>
                        </View>
                    </View>
                </View>

                {/* Hardware Status */}
                <View style={styles.card}>
                    <View style={styles.cardTitleRow}>
                        <Zap color="#60a5fa" size={18} />
                        <Text style={styles.cardTitle}>Hardware</Text>
                    </View>
                    <View style={styles.hwRow}>
                        <View style={styles.hwItem}>
                            <SignalIcon color={signalColor} size={18} />
                            <Text style={styles.hwLabel}>Signal</Text>
                        </View>
                        <Text style={[styles.hwValue, { color: signalColor }]}>{machineData.specs.signal || 'N/A'}</Text>
                    </View>
                    <View style={styles.hwRow}>
                        <Text style={styles.hwLabel}>Type</Text>
                        <Text style={styles.hwValue}>{machineData.specs.cabinetType}</Text>
                    </View>
                    <View style={[styles.hwRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.hwLabel}>IP</Text>
                        <Text style={[styles.hwValue, { fontFamily: 'monospace', fontSize: 11 }]}>{machineData.specs.ip}</Text>
                    </View>
                </View>

                {/* Battery Slots */}
                <View style={styles.card}>
                    <View style={styles.cardTitleRow}>
                        <Battery color="#34d399" size={18} />
                        <Text style={styles.cardTitle}>Battery Slots</Text>
                    </View>
                    {batteryHealth.length > 0 && (
                        <View style={styles.healthSummary}>
                            <View style={styles.healthItem}>
                                <Heart color="#34d399" size={14} />
                                <Text style={styles.healthText}>{healthyCount}/{batteryHealth.length} healthy</Text>
                            </View>
                            {faultedCount > 0 && (
                                <View style={styles.healthItem}>
                                    <AlertCircle color="#fbbf24" size={14} />
                                    <Text style={[styles.healthText, { color: '#fbbf24' }]}>{faultedCount} fault{faultedCount !== 1 ? 's' : ''}</Text>
                                </View>
                            )}
                        </View>
                    )}
                    <View style={styles.slotGrid}>
                        {machineData.batteries.map((slot) => {
                            const hasBattery = !!slot.batteryId;
                            const charge = slot.vol;
                            const health = batteryHealth.find(b => b.battery_id === slot.batteryId);
                            const isUnhealthy = health && !health.is_healthy;

                            let bgColor = '#1a2332';
                            let borderColor = '#374151';
                            let chargeColor = '#6b7280';

                            if (hasBattery) {
                                if (isUnhealthy) {
                                    bgColor = 'rgba(245,158,11,0.08)';
                                    borderColor = 'rgba(245,158,11,0.3)';
                                    chargeColor = '#fbbf24';
                                } else if (charge > 20) {
                                    bgColor = 'rgba(16,185,129,0.08)';
                                    borderColor = 'rgba(16,185,129,0.3)';
                                    chargeColor = '#34d399';
                                } else {
                                    bgColor = 'rgba(239,68,68,0.08)';
                                    borderColor = 'rgba(239,68,68,0.3)';
                                    chargeColor = '#f87171';
                                }
                            }

                            return (
                                <TouchableOpacity
                                    key={slot.slotNum}
                                    style={[styles.slotCard, { backgroundColor: bgColor, borderColor }]}
                                    activeOpacity={hasBattery ? 0.7 : 1}
                                    onPress={() => hasBattery && slot.batteryId && setSelectedBatteryId(slot.batteryId)}
                                    disabled={!hasBattery}
                                >
                                    <View style={styles.slotHeader}>
                                        <Text style={styles.slotNum}>#{slot.slotNum}</Text>
                                        {hasBattery && (
                                            <View style={[styles.slotDot, { backgroundColor: isUnhealthy ? '#fbbf24' : charge > 20 ? '#34d399' : '#f87171' }]} />
                                        )}
                                    </View>
                                    {hasBattery ? (
                                        <View style={styles.slotBody}>
                                            <Text style={[styles.slotCharge, { color: chargeColor }]}>{charge}%</Text>
                                            {isUnhealthy && health && (
                                                <Text style={styles.slotFault} numberOfLines={1}>{getFaultLabel(health)}</Text>
                                            )}
                                        </View>
                                    ) : (
                                        <Text style={styles.slotEmpty}>Empty</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>

            {/* Battery Detail Modal */}
            <Modal visible={!!selectedBatteryId} transparent animationType="fade" onRequestClose={() => setSelectedBatteryId(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <ScrollView>
                            {/* Modal Header */}
                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={styles.modalTitle}>Battery Details</Text>
                                    <Text style={styles.modalSub}>{selectedBatteryId} · Slot #{selectedSlot?.slotNum}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedBatteryId(null)} style={styles.modalClose}>
                                    <X color="#9ca3af" size={20} />
                                </TouchableOpacity>
                            </View>

                            {/* Cable Status */}
                            {selectedRaw && (
                                <View style={styles.cableRow}>
                                    {[
                                        { label: 'Lightning', val: selectedRaw.pIosStatus },
                                        { label: 'USB-C', val: selectedRaw.pTypecStatus },
                                        { label: 'Micro USB', val: selectedRaw.pMicroStatus },
                                    ].map(({ label, val }) => (
                                        <View key={label} style={[styles.cableBadge, {
                                            backgroundColor: val === 1 ? 'rgba(16,185,129,0.1)' : val === 0 ? 'rgba(239,68,68,0.1)' : 'rgba(107,114,128,0.1)',
                                            borderColor: val === 1 ? 'rgba(16,185,129,0.3)' : val === 0 ? 'rgba(239,68,68,0.3)' : '#374151',
                                        }]}>
                                            <Text style={[styles.cableBadgeText, {
                                                color: val === 1 ? '#34d399' : val === 0 ? '#f87171' : '#6b7280',
                                            }]}>{val === 1 ? '✓' : val === 0 ? '✗' : '?'} {label}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Fault */}
                            {selectedHealth && !selectedHealth.is_healthy && (
                                <View style={styles.faultCard}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                        <AlertTriangle color="#fbbf24" size={14} />
                                        <Text style={{ color: '#fbbf24', fontWeight: '700', fontSize: 13 }}>Fault Detected</Text>
                                    </View>
                                    <View style={styles.modalDetailRow}>
                                        <Text style={styles.modalDetailLabel}>Type</Text>
                                        <Text style={{ color: '#fbbf24', fontSize: 12 }}>{getFaultLabel(selectedHealth)}</Text>
                                    </View>
                                    {selectedHealth.battery_fault_cause && (
                                        <View style={styles.modalDetailRow}>
                                            <Text style={styles.modalDetailLabel}>Cause</Text>
                                            <Text style={styles.modalDetailValue}>{selectedHealth.battery_fault_cause}</Text>
                                        </View>
                                    )}
                                    {selectedHealth.slot_fault_type > 0 && (
                                        <View style={styles.modalDetailRow}>
                                            <Text style={styles.modalDetailLabel}>Slot fault</Text>
                                            <Text style={{ color: '#fbbf24', fontSize: 12 }}>{SLOT_FAULT_NAMES[selectedHealth.slot_fault_type] || `Type ${selectedHealth.slot_fault_type}`}</Text>
                                        </View>
                                    )}
                                    {selectedHealth.slot_fault_cause && (
                                        <View style={styles.modalDetailRow}>
                                            <Text style={styles.modalDetailLabel}>Slot cause</Text>
                                            <Text style={styles.modalDetailValue}>{selectedHealth.slot_fault_cause}</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Power & Temperature */}
                            <Text style={styles.modalSectionTitle}>Power & Temperature</Text>
                            <View style={styles.modalGrid}>
                                <View style={styles.modalGridCell}>
                                    <Text style={styles.modalGridLabel}>Charge</Text>
                                    <Text style={styles.modalGridValue}>{selectedSlot?.vol ?? '—'}%</Text>
                                </View>
                                <View style={styles.modalGridCell}>
                                    <Text style={styles.modalGridLabel}>Temperature</Text>
                                    <Text style={styles.modalGridValue}>{selectedRaw?.pTemperature != null ? `${selectedRaw.pTemperature}°C` : '—'}</Text>
                                </View>
                                <View style={styles.modalGridCell}>
                                    <Text style={styles.modalGridLabel}>Capacity</Text>
                                    <Text style={styles.modalGridValue}>{selectedRaw?.pCapacity != null ? `${selectedRaw.pCapacity}%` : '—'}</Text>
                                </View>
                                <View style={styles.modalGridCell}>
                                    <Text style={styles.modalGridLabel}>Self-Check</Text>
                                    <Text style={styles.modalGridValue}>{selectedRaw?.pCheckResult ?? '—'}</Text>
                                </View>
                            </View>

                            {/* Usage Stats */}
                            <Text style={styles.modalSectionTitle}>Usage Stats</Text>
                            {selectedRaw?.pZujienum != null && (
                                <View style={styles.modalDetailRow}>
                                    <Text style={styles.modalDetailLabel}>Total rentals</Text>
                                    <Text style={styles.modalDetailValue}>{selectedRaw.pZujienum}</Text>
                                </View>
                            )}
                            {selectedRaw?.pZjztime != null && (
                                <View style={styles.modalDetailRow}>
                                    <Text style={styles.modalDetailLabel}>Total rental time</Text>
                                    <Text style={styles.modalDetailValue}>{Math.floor(selectedRaw.pZjztime / 60)}h {selectedRaw.pZjztime % 60}m</Text>
                                </View>
                            )}
                            {selectedRaw?.pTotalrevenue != null && (
                                <View style={styles.modalDetailRow}>
                                    <Text style={styles.modalDetailLabel}>Total revenue</Text>
                                    <Text style={[styles.modalDetailValue, { color: '#34d399' }]}>${selectedRaw.pTotalrevenue}</Text>
                                </View>
                            )}
                            {selectedRaw?.pAuthfailTime != null && selectedRaw.pAuthfailTime > 0 && (
                                <View style={styles.modalDetailRow}>
                                    <Text style={styles.modalDetailLabel}>Auth failures</Text>
                                    <Text style={[styles.modalDetailValue, { color: '#f87171' }]}>{selectedRaw.pAuthfailTime}</Text>
                                </View>
                            )}

                            {/* History */}
                            <Text style={styles.modalSectionTitle}>History</Text>
                            {selectedRaw?.pRegtime && (
                                <View style={styles.modalDetailRow}>
                                    <Text style={styles.modalDetailLabel}>Registered</Text>
                                    <Text style={styles.modalDetailValue}>{formatTimestamp(selectedRaw.pRegtime)}</Text>
                                </View>
                            )}
                            {selectedRaw?.pBorrowtime && (
                                <View style={styles.modalDetailRow}>
                                    <Text style={styles.modalDetailLabel}>Last borrowed</Text>
                                    <Text style={styles.modalDetailValue}>{formatTimestamp(selectedRaw.pBorrowtime)}</Text>
                                </View>
                            )}
                            {selectedRaw?.pLogtime && (
                                <View style={styles.modalDetailRow}>
                                    <Text style={styles.modalDetailLabel}>Last activity</Text>
                                    <Text style={styles.modalDetailValue}>{formatTimestamp(selectedRaw.pLogtime)}</Text>
                                </View>
                            )}
                            {selectedHealth?.last_seen_at && (
                                <View style={styles.modalDetailRow}>
                                    <Text style={styles.modalDetailLabel}>Last heartbeat</Text>
                                    <Text style={styles.modalDetailValue}>
                                        {new Date(selectedHealth.last_seen_at).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                                        })}
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111827' },
    content: { padding: 16, paddingBottom: 48 },
    loadingContainer: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#9ca3af', marginTop: 12, fontSize: 14 },

    // Header
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    name: { color: '#fff', fontSize: 22, fontWeight: '700', flex: 1 },
    statusDot: { width: 12, height: 12, borderRadius: 6 },
    address: { color: '#9ca3af', fontSize: 14, marginBottom: 4, marginLeft: 34 },
    heartbeatText: { color: '#6b7280', fontSize: 12, marginBottom: 16, marginLeft: 34 },

    // Error
    errorCard: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 16, padding: 28, alignItems: 'center', gap: 10 },
    errorTitle: { color: '#f87171', fontSize: 18, fontWeight: '700' },
    errorMessage: { color: '#9ca3af', fontSize: 13, textAlign: 'center' },
    errorStation: { color: '#6b7280', fontSize: 11, fontFamily: 'monospace', marginTop: 4 },
    retryBtn: { marginTop: 10, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: 10 },
    retryBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

    // Slot counts
    countRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    countCard: { flex: 1, backgroundColor: '#1f2937', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#374151', alignItems: 'center' },
    countLabel: { color: '#9ca3af', fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
    countValue: { fontSize: 28, fontWeight: '700', marginTop: 4 },

    // Cards
    card: { backgroundColor: '#1f2937', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#374151', marginBottom: 16 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },

    // Pricing
    priceMain: { alignItems: 'center', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#374151', marginBottom: 12 },
    priceValue: { color: '#fff', fontSize: 28, fontWeight: '700' },
    priceSub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
    priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    priceCell: { width: '48%', backgroundColor: '#111827', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#374151' },
    priceCellLabel: { color: '#6b7280', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    priceCellValue: { color: '#fff', fontSize: 15, fontWeight: '600' },

    // Hardware
    hwRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#374151' },
    hwItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    hwLabel: { color: '#9ca3af', fontSize: 13 },
    hwValue: { color: '#fff', fontSize: 13, fontWeight: '500' },

    // Battery health summary
    healthSummary: { flexDirection: 'row', gap: 16, marginBottom: 12 },
    healthItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    healthText: { color: '#9ca3af', fontSize: 12 },

    // Battery slot grid
    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    slotCard: { width: '23%', aspectRatio: 0.85, borderRadius: 10, borderWidth: 1, padding: 8, alignItems: 'center', justifyContent: 'space-between' },
    slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
    slotNum: { color: '#6b7280', fontSize: 9, fontFamily: 'monospace', fontWeight: '600' },
    slotDot: { width: 5, height: 5, borderRadius: 3 },
    slotBody: { alignItems: 'center', gap: 2 },
    slotCharge: { fontSize: 15, fontWeight: '700' },
    slotFault: { color: '#fbbf24', fontSize: 8, fontWeight: '500', textAlign: 'center' },
    slotEmpty: { color: '#4b5563', fontSize: 10, fontWeight: '500', textTransform: 'uppercase' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
    modalCard: { backgroundColor: '#1f2937', borderRadius: 16, borderWidth: 1, borderColor: '#374151', maxHeight: '85%', overflow: 'hidden', padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    modalSub: { color: '#6b7280', fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
    modalClose: { padding: 4 },

    // Cable badges
    cableRow: { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
    cableBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
    cableBadgeText: { fontSize: 11, fontWeight: '600' },

    // Fault card
    faultCard: { backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', borderRadius: 10, padding: 12, marginBottom: 16 },

    // Modal sections
    modalSectionTitle: { color: '#6b7280', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 10 },
    modalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    modalGridCell: { width: '47%', backgroundColor: '#111827', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#374151' },
    modalGridLabel: { color: '#6b7280', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    modalGridValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
    modalDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    modalDetailLabel: { color: '#6b7280', fontSize: 12 },
    modalDetailValue: { color: '#fff', fontSize: 12, fontWeight: '500' },
});
