import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Lock, Mail, AlertCircle } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn, signUp } = useAuth();

    const handleSubmit = async () => {
        setError('');

        if (!email || !password) {
            setError('Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const { error: authError } = isLogin
                ? await signIn(email, password)
                : await signUp(email, password);

            if (authError) {
                setError(authError);
            } else if (!isLogin) {
                Alert.alert('Success', 'Account created! Please sign in.');
                setIsLogin(true);
                setEmail('');
                setPassword('');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.card}>
                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <Lock color="#fff" size={28} />
                    </View>
                    <Text style={styles.title}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
                    {!isLogin && <Text style={styles.subtitle}>Sign up to get started</Text>}
                </View>

                {error ? (
                    <View style={styles.errorBox}>
                        <AlertCircle color="#f87171" size={18} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <View style={styles.inputWrapper}>
                        <Mail color="#9ca3af" size={18} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="you@example.com"
                            placeholderTextColor="#6b7280"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loading}
                        />
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.inputWrapper}>
                        <Lock color="#9ca3af" size={18} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={isLogin ? 'Enter your password' : 'At least 6 characters'}
                            placeholderTextColor="#6b7280"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            editable={!loading}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.buttonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        setIsLogin(!isLogin);
                        setError('');
                    }}
                    disabled={loading}
                    style={styles.switchButton}
                >
                    <Text style={styles.switchText}>
                        {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#1f2937',
        borderRadius: 16,
        padding: 28,
        borderWidth: 1,
        borderColor: '#374151',
    },
    header: {
        alignItems: 'center',
        marginBottom: 28,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#2563eb',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#9ca3af',
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
        borderRadius: 10,
        padding: 12,
        gap: 8,
        marginBottom: 16,
    },
    errorText: {
        color: '#f87171',
        fontSize: 13,
        flex: 1,
    },
    inputGroup: {
        marginBottom: 18,
    },
    label: {
        color: '#d1d5db',
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 6,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111827',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#4b5563',
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
        paddingVertical: 14,
    },
    button: {
        backgroundColor: '#2563eb',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    switchButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    switchText: {
        color: '#60a5fa',
        fontSize: 13,
        fontWeight: '500',
    },
});
