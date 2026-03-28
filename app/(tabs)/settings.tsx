import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Lock, LogOut } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function SettingsScreen() {
    const { signOut, user } = useAuth();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handlePasswordChange = async () => {
        setLoading(true);
        setMessage('');
        setError('');

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });
            if (error) throw error;
            setMessage('Password updated successfully');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setError(err.message || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
        ]);
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#111827' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Account Info */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <Text style={styles.emailLabel}>Email</Text>
                    <Text style={styles.emailValue}>{user?.email || '—'}</Text>
                </View>

                {/* Change Password */}
                <View style={styles.card}>
                    <View style={styles.passwordHeader}>
                        <View style={styles.passwordIcon}>
                            <Lock color="#60a5fa" size={18} />
                        </View>
                        <Text style={styles.sectionTitle}>Change Password</Text>
                    </View>

                    <Text style={styles.label}>New Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter new password"
                        placeholderTextColor="#6b7280"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                    />

                    <Text style={styles.label}>Confirm New Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Confirm new password"
                        placeholderTextColor="#6b7280"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                    />

                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {message ? (
                        <View style={styles.successBox}>
                            <Text style={styles.successText}>{message}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handlePasswordChange}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.buttonText}>Update Password</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Sign Out */}
                <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
                    <LogOut color="#f87171" size={18} />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
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
    card: {
        backgroundColor: '#1f2937',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#374151',
        marginBottom: 16,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
    },
    emailLabel: {
        color: '#9ca3af',
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 4,
    },
    emailValue: {
        color: '#fff',
        fontSize: 15,
    },
    passwordHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
    },
    passwordIcon: {
        padding: 6,
        backgroundColor: 'rgba(37,99,235,0.15)',
        borderRadius: 8,
    },
    label: {
        color: '#9ca3af',
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 6,
        marginTop: 12,
    },
    input: {
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#374151',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#fff',
        fontSize: 14,
    },
    errorBox: {
        marginTop: 12,
        padding: 10,
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
        borderRadius: 8,
    },
    errorText: {
        color: '#f87171',
        fontSize: 13,
    },
    successBox: {
        marginTop: 12,
        padding: 10,
        backgroundColor: 'rgba(34,197,94,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.3)',
        borderRadius: 8,
    },
    successText: {
        color: '#34d399',
        fontSize: 13,
    },
    button: {
        backgroundColor: '#2563eb',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 18,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#1f2937',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#374151',
    },
    signOutText: {
        color: '#f87171',
        fontSize: 15,
        fontWeight: '600',
    },
});
