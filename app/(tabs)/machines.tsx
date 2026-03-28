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

export default function MachinesScreen() {
    const router = useRouter();
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchLocations = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('locations').select('*').order('name');
            if (error) throw error;
            setLocations(data || []);
        } catch (error) {
            console.error('Error fetching locations:', error);
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
                            { backgroundColor: item.station_id ? '#22c55e' : '#ef4444' },
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
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#9ca3af',
        fontSize: 14,
    },
});
