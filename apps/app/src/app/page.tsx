'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

export default function HomePage() {
    const router = useRouter();

    useEffect(() => {
        const routeUser = async () => {
            const supabase = getSupabaseClient();
            if (!supabase) {
                router.replace('/login');
                return;
            }

            const { data } = await supabase.auth.getUser();
            if (data.user) {
                router.replace('/dashboard');
                return;
            }

            router.replace('/login');
        };

        void routeUser();
    }, [router]);

    return (
        <main className="flex min-h-screen items-center justify-center bg-black text-sm text-gray-400">
            Opening PropAI…
        </main>
    );
}
