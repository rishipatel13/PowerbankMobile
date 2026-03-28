import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';
import { MapPin, ChevronDown } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { calculateRentalFinancials, getEffectiveAmount, formatCurrency, formatPercentage } from '../lib/calculations';
import type { Database } from '../lib/database.types';

type Location = Database['public']['Tables']['locations']['Row'];
type Rental = Database['public']['Tables']['rentals']['Row'];

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function VenueDetailScreen() {
    const { name } = useLocalSearchParams<{ name: string }>();
    const [location, setLocation] = useState<Location | null>(null);
    const [rentals, setRentals] = useState<Rental[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [configExpanded, setConfigExpanded] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [locRes, rentalsRes] = await Promise.all([
                supabase.from('locations').select('*').eq('name', name).single(),
                supabase.from('rentals').select('*').eq('location_name', name).is('deleted_at', null).order('created_at', { ascending: false }),
            ]);
            if (locRes.data) setLocation(locRes.data);
            if (rentalsRes.data) setRentals(rentalsRes.data);
        } catch (error) {
            console.error('Error fetching venue detail:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [name]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const toggleConfig = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setConfigExpanded((prev) => !prev);
    }, []);

    // Pre-compute all stats
    const stats = useMemo(() => {
        if (!location) return null;
        const validRentals = rentals.filter((r) => getEffectiveAmount(r) > 0);
        let totalRevenue = 0;
        let totalProfit = 0;
        let totalVenuePayout = 0;
        let totalSalesTax = 0;

        validRentals.forEach((rental) => {
            const fin = calculateRentalFinancials(getEffectiveAmount(rental), location, {
                isLost: rental.is_lost,
                dailyCapSnapshot: rental.daily_cap_snapshot,
            });
            totalRevenue += fin.gross;
            totalProfit += fin.myProfit;
            totalVenuePayout += fin.venueCut;
            totalSalesTax += fin.salesTax;
        });

        const avg = validRentals.length > 0 ? totalRevenue / validRentals.length : 0;
        const roi = location.investment_cost > 0 ? totalProfit / (location.investment_cost / 100) : 0;

        let projectedProfit = 0;
        let projectedTotal = 0;
        if (location.go_live_date) {
            const goLive = new Date(location.go_live_date + 'T00:00:00');
            const now = new Date();
            const daysLive = Math.max(1, Math.floor((now.getTime() - goLive.getTime()) / (1000 * 60 * 60 * 24)));
            projectedProfit = (totalProfit / daysLive) * 365;
            projectedTotal = ((totalProfit + totalVenuePayout) / daysLive) * 365;
        }

        return {
            rentals: validRentals.length,
            revenue: totalRevenue,
            avg,
            venue: totalVenuePayout,
            profit: totalProfit,
            roi,
            projectedProfit,
            projectedTotal,
            salesTax: totalSalesTax,
        };
    }, [location, rentals]);

    if (loading || !location || !stats) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#60a5fa" />
                <Text style={styles.loadingText}>Loading venue...</Text>
            </View>
        );
    }

    return (
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

            {/* Stats Grid - Row 1: Rentals, Revenue, Avg */}
            <View style={styles.statsRow}>
                <View style={styles.statTile}>
                    <Text style={styles.statLabel}>Rentals</Text>
                    <Text style={styles.statValue}>{stats.rentals}</Text>
                </View>
                <View style={styles.statTile}>
                    <Text style={styles.statLabel}>Revenue</Text>
                    <Text style={styles.statValue}>{formatCurrency(stats.revenue)}</Text>
                </View>
                <View style={styles.statTile}>
                    <Text style={styles.statLabel}>Avg</Text>
                    <Text style={[styles.statValue, { color: '#60a5fa' }]}>{formatCurrency(stats.avg)}</Text>
                </View>
            </View>

            {/* Stats Grid - Row 2: Venue, Profit, ROI */}
            <View style={styles.statsRow}>
                <View style={styles.statTile}>
                    <Text style={styles.statLabel}>Venue</Text>
                    <Text style={[styles.statValue, { color: '#fbbf24' }]}>{formatCurrency(stats.venue)}</Text>
                </View>
                <View style={styles.statTile}>
                    <Text style={styles.statLabel}>Profit</Text>
                    <Text style={[styles.statValue, { color: '#34d399' }]}>{formatCurrency(stats.profit)}</Text>
                </View>
                <View style={styles.statTile}>
                    <Text style={styles.statLabel}>ROI</Text>
                    <Text style={[styles.statValue, { color: '#a78bfa' }]}>{formatPercentage(stats.roi)}</Text>
                </View>
            </View>

            {/* Stats Grid - Row 3: Projected Profit, Projected Total */}
            <View style={styles.statsRow}>
                <View style={[styles.statTile, { flex: 1 }]}>
                    <Text style={styles.statLabel}>Projected Profit</Text>
                    <Text style={[styles.statValue, { color: '#34d399' }]}>{formatCurrency(stats.projectedProfit)}</Text>
                </View>
                <View style={[styles.statTile, { flex: 1 }]}>
                    <Text style={styles.statLabel}>Projected Total</Text>
                    <Text style={styles.statValue}>{formatCurrency(stats.projectedTotal)}</Text>
                </View>
            </View>

            {/* Configuration Dropdown */}
            <TouchableOpacity
                style={styles.configToggle}
                onPress={toggleConfig}
                activeOpacity={0.7}
            >
                <Text style={styles.configToggleText}>Configuration</Text>
                <View style={{ transform: [{ rotate: configExpanded ? '180deg' : '0deg' }] }}>
                    <ChevronDown color="#9ca3af" size={20} />
                </View>
            </TouchableOpacity>

            {configExpanded && (
                <View style={styles.configCard}>
                    <View style={styles.configRow}>
                        <Text style={styles.configLabel}>Station ID</Text>
                        <Text style={styles.configValue}>{location.station_id || '—'}</Text>
                    </View>
                    <View style={styles.configRow}>
                        <Text style={styles.configLabel}>Stripe Terminal</Text>
                        <Text style={styles.configValue} numberOfLines={1}>{location.stripe_terminal_id || '—'}</Text>
                    </View>
                    <View style={styles.configRow}>
                        <Text style={styles.configLabel}>Hourly Rate</Text>
                        <Text style={styles.configValue}>{location.hourly_rate ? `$${(location.hourly_rate / 100).toFixed(2)}` : '—'}</Text>
                    </View>
                    <View style={styles.configRow}>
                        <Text style={styles.configLabel}>Daily Cap</Text>
                        <Text style={styles.configValue}>{location.daily_cap ? `$${(location.daily_cap / 100).toFixed(2)}` : '—'}</Text>
                    </View>
                    <View style={styles.configRow}>
                        <Text style={styles.configLabel}>Lost Fee</Text>
                        <Text style={styles.configValue}>{location.lost_fee ? `$${(location.lost_fee / 100).toFixed(2)}` : '—'}</Text>
                    </View>
                    <View style={styles.configRow}>
                        <Text style={styles.configLabel}>Venue Split</Text>
                        <Text style={styles.configValue}>{(location.venue_split * 100).toFixed(0)}%</Text>
                    </View>
                    <View style={styles.configRow}>
                        <Text style={styles.configLabel}>Tax Rate</Text>
                        <Text style={styles.configValue}>{(location.tax_rate * 100).toFixed(1)}%</Text>
                    </View>
                    <View style={styles.configRow}>
                        <Text style={styles.configLabel}>Investment</Text>
                        <Text style={styles.configValue}>{formatCurrency(location.investment_cost / 100)}</Text>
                    </View>
                    <View style={[styles.configRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.configLabel}>Go Live</Text>
                        <Text style={styles.configValue}>{location.go_live_date || '—'}</Text>
                    </View>
                </View>
            )}

            {/* Recent Transactions */}
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            {rentals.slice(0, 20).map((rental) => {
                const amount = getEffectiveAmount(rental);
                return (
                    <View key={rental.id} style={styles.txRow}>
                        <View>
                            <Text style={styles.txDate}>
                                {new Date(rental.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
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
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
    },
    content: {
        padding: 16,
        paddingBottom: 48,
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

    // Header
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
    },
    name: {
        color: '#60a5fa',
        fontSize: 24,
        fontWeight: '700',
    },
    address: {
        color: '#9ca3af',
        fontSize: 14,
        marginBottom: 20,
        marginLeft: 32,
    },

    // Stats Grid
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10,
    },
    statTile: {
        flex: 1,
        backgroundColor: '#1f2937',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#374151',
        alignItems: 'center',
    },
    statLabel: {
        color: '#9ca3af',
        fontSize: 11,
        fontWeight: '500',
        marginBottom: 6,
    },
    statValue: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },

    // Configuration Dropdown
    configToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1f2937',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: '#374151',
        marginTop: 6,
        marginBottom: 4,
    },
    configToggleText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    configCard: {
        backgroundColor: '#1f2937',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#374151',
        marginBottom: 4,
        overflow: 'hidden',
    },
    configRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    configLabel: {
        color: '#9ca3af',
        fontSize: 13,
    },
    configValue: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
        flexShrink: 1,
        textAlign: 'right',
    },

    // Section Title
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 12,
    },

    // Transactions
    txRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1f2937',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: '#374151',
        marginBottom: 8,
    },
    txDate: {
        color: '#d1d5db',
        fontSize: 13,
    },
    txStatus: {
        color: '#6b7280',
        fontSize: 11,
        marginTop: 2,
    },
    txAmount: {
        fontSize: 15,
        fontWeight: '600',
    },
});
