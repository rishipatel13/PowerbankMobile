import { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Server } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Location = Database['public']['Tables']['locations']['Row'];

function formatRelative(dateString: string): string {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
}

export default function MachinesScreen() {
    const router = useRouter();
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLocations = useCallback(async () => {
        setError(null);
        try {
            const { data, error } = await supabase.from('locations').select('*').order('name');
            if (error) throw error;
            setLocations(data || []);
        } catch (err: any) {
            console.error('Error fetching locations:', err);
            setError(err?.message || 'Failed to load machines');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchLocations();
    }, [fetchLocations]);

    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    const renderItem = useCallback(({ item }: { item: Location }) => {
        const occupied = (item.total_slots ?? 0) - (item.empty_slots ?? 0);
        const hasSlotData = item.empty_slots !== null && item.total_slots !== null && item.total_slots > 0;
        const fillPercent = hasSlotData ? (occupied / item.total_slots!) * 100 : 0;

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() =>
                    router.push({ pathname: '/machine-detail', params: { name: item.name } })
                }
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <View
                        style={[
                            styles.statusDot,
                            { backgroundColor: item.machine_status === 'online' ? '#22c55e' : item.machine_status === 'offline' ? '#ef4444' : item.station_id ? '#6b7280' : '#ef4444' },
                        ]}
                    />
                </View>
                <View style={styles.cardInfo}>
                    <Server color="#9ca3af" size={16} />
                    <Text style={styles.cardInfoText}>
                        {item.total_slots ? `${item.total_slots} Slots` : 'Unknown'}
                    </Text>
                </View>
                {hasSlotData && (
                    <>
                        <View style={styles.slotBar}>
                            <View style={[styles.slotFill, { width: `${fillPercent}%` }]} />
                        </View>
                        <Text style={styles.slotText}>
                            {occupied} / {item.total_slots} occupied
                        </Text>
                    </>
                )}
                {item.last_status_update_at && (
                    <Text style={styles.updatedText}>Updated {formatRelative(item.last_status_update_at)}</Text>
                )}
            </TouchableOpacity>
        );
    }, [router]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#60a5fa" />
                <Text style={styles.loadingText}>Loading machines...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.loadingContainer}>
                <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 16, padding: 28, alignItems: 'center' as const, gap: 10 }}>
                    <Text style={{ color: '#f87171', fontSize: 18, fontWeight: '700' as const }}>Something went wrong</Text>
                    <Text style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' as const }}>{error}</Text>
                    <TouchableOpacity
                        onPress={() => fetchLocations()}
                        activeOpacity={0.7}
                        style={{ marginTop: 10, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: 10 }}
                    >
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' as const }}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={locations}
                keyExtractor={(item) => item.name}
                renderItem={renderItem}
                numColumns={2}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.list}
                removeClippedSubviews
                maxToRenderPerBatch={10}
                windowSize={5}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60a5fa" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No machines found.</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
    },
    list: {
        padding: 12,
        paddingBottom: 32,
    },
    row: {
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 10,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#9ca3af',
        marginTop: 12,
        fontSize: 14,
    },
    card: {
        flex: 1,
        backgroundColor: '#1f2937',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#374151',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        marginRight: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    cardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardInfoText: {
        color: '#9ca3af',
        fontSize: 12,
    },
    slotBar: {
        height: 4,
        backgroundColor: '#374151',
        borderRadius: 2,
        marginTop: 10,
        overflow: 'hidden',
    },
    slotFill: {
        height: '100%',
        backgroundColor: '#60a5fa',
        borderRadius: 2,
    },
    slotText: {
        color: '#6b7280',
        fontSize: 10,
        marginTop: 4,
        textAlign: 'right',
    },
    updatedText: {
        color: '#6b7280',
        fontSize: 10,
        marginTop: 6,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#9ca3af',
        fontSize: 14,
    },
});
