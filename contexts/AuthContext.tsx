import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signUp: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth
            .getSession()
            .then(({ data: { session }, error }) => {
                if (error) {
                    console.warn('Session check failed:', error.message);
                }
                setUser(session?.user ?? null);
            })
            .catch((err) => {
                console.warn('Unexpected error during session check:', err);
                setUser(null);
            })
            .finally(() => {
                setLoading(false);
            });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) {
                return { error: error.message };
            }
            return { error: null };
        } catch (err) {
            return { error: 'An unexpected error occurred' };
        }
    };

    const signUp = async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) {
                return { error: error.message };
            }
            return { error: null };
        } catch (err) {
            return { error: 'An unexpected error occurred' };
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
