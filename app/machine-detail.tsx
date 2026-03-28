import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { Server } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Location = Database['public']['Tables']['locations']['Row'];

export default function MachineDetailScreen() {
    const { name } = useLocalSearchParams<{ name: string }>();
    const [location, setLocation] = useState<Location | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const { data, error } = await supabase
                .from('locations')
                .select('*')
                .eq('name', name)
                .single();
            if (error) throw error;
            setLocation(data);
        } catch (error) {
            console.error('Error fetching machine detail:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, []);

    useEffect(() => {
        fetchData();
    }, [name]);

    if (loading || !location) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#60a5fa" />
                <Text style={styles.loadingText}>Loading machine...</Text>
            </View>
        );
    }

    const occupied = (location.total_slots ?? 0) - (location.empty_slots ?? 0);
    const fillPercent = location.total_slots
        ? ((occupied / location.total_slots) * 100).toFixed(0)
        : '—';

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60a5fa" />}
        >
            <View style={styles.headerRow}>
                <Server color="#60a5fa" size={24} />
                <Text style={styles.name}>{location.name}</Text>
                <View
                    style={[
                        styles.statusDot,
                        { backgroundColor: location.station_id ? '#22c55e' : '#ef4444' },
                    ]}
                />
            </View>
            <Text style={styles.address}>
                {[location.address_line1, location.city, location.state].filter(Boolean).join(', ')}
            </Text>

            {/* Slot occupancy */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Slot Occupancy</Text>
                <View style={styles.slotBar}>
                    <View
                        style={[
                            styles.slotFill,
                            {
                                width: location.total_slots
                                    ? `${(occupied / location.total_slots) * 100}%`
                                    : '0%',
                            },
                        ]}
                    />
                </View>
                <View style={styles.slotInfo}>
                    <Text style={styles.slotText}>
                        {occupied} / {location.total_slots ?? '?'} occupied
                    </Text>
                    <Text style={styles.slotText}>{fillPercent}%</Text>
                </View>
            </View>

            {/* Machine info */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Machine Info</Text>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Station ID</Text>
                    <Text style={styles.infoValue}>{location.station_id || '—'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Stripe ID</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>
                        {location.stripe_id || '—'}
                    </Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Total Slots</Text>
                    <Text style={styles.infoValue}>{location.total_slots ?? '—'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Empty Slots</Text>
                    <Text style={styles.infoValue}>{location.empty_slots ?? '—'}</Text>
                </View>
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoLabel}>Go Live Date</Text>
                    <Text style={styles.infoValue}>{location.go_live_date || '—'}</Text>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111827' },
    content: { padding: 16, paddingBottom: 48 },
    loadingContainer: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#9ca3af', marginTop: 12, fontSize: 14 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    name: { color: '#fff', fontSize: 22, fontWeight: '700', flex: 1 },
    statusDot: { width: 12, height: 12, borderRadius: 6 },
    address: { color: '#9ca3af', fontSize: 14, marginBottom: 20, marginLeft: 34 },
    card: {
        backgroundColor: '#1f2937',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#374151',
        marginBottom: 16,
    },
    cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 14 },
    slotBar: {
        height: 8,
        backgroundColor: '#374151',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    slotFill: {
        height: '100%',
        backgroundColor: '#60a5fa',
        borderRadius: 4,
    },
    slotInfo: { flexDirection: 'row', justifyContent: 'space-between' },
    slotText: { color: '#9ca3af', fontSize: 12 },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    infoLabel: { color: '#9ca3af', fontSize: 13 },
    infoValue: { color: '#fff', fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
});
