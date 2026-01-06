import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSearchCache } from '@/lib/hooks/useSearchCache';
import { useParallelSearch } from '@/lib/hooks/useParallelSearch';
import { settingsStore } from '@/lib/store/settings-store';

export function usePremiumHomePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { loadFromCache, saveToCache } = useSearchCache();
    const hasLoadedCache = useRef(false);

    const [query, setQuery] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [currentSortBy, setCurrentSortBy] = useState('default');

    // Get premium sources from settings store (supports user customization)
    const enabledPremiumSources = useMemo(() => {
        const settings = settingsStore.getSettings();
        return settings.premiumSources.filter(s => s.enabled);
    }, []);

    const onUrlUpdate = useCallback((q: string) => {
        router.replace(`/premium?q=${encodeURIComponent(q)}`, { scroll: false });
    }, [router]);

    // Search stream hook
    const {
        loading,
        results,
        availableSources,
        completedSources,
        totalSources,
        performSearch,
        resetSearch,
        loadCachedResults,
        applySorting,
    } = useParallelSearch(
        saveToCache,
        onUrlUpdate
    );

    // Re-sort results when sort preference changes
    useEffect(() => {
        if (hasSearched && results.length > 0) {
            applySorting(currentSortBy as any);
        }
    }, [currentSortBy, applySorting, hasSearched, results.length]);

    // Load cached results on mount
    useEffect(() => {
        if (hasLoadedCache.current) return;
        hasLoadedCache.current = true;

        const urlQuery = searchParams.get('q');
        // Note: We might want to separate cache for premium mode, but for now sharing or not using cache might be safer.
        // However, useSearchCache uses localStorage which is shared. 
        // If we want to avoid leaking premium searches to normal history, we might want to disable cache or use a different key.
        // For simplicity and "hidden" nature, maybe we don't load cache from normal mode?
        // But the user asked for "same as original page".

        if (urlQuery) {
            setQuery(urlQuery);
            handleSearch(urlQuery);
        }
    }, [searchParams]);

    const handleSearch = (searchQuery: string) => {
        setQuery(searchQuery);
        setHasSearched(true);
        // Use enabled premium sources from settings
        performSearch(searchQuery, enabledPremiumSources, currentSortBy as any);
    };

    const handleReset = () => {
        setHasSearched(false);
        setQuery('');
        resetSearch();
        router.replace('/premium', { scroll: false });
    };

    return {
        query,
        hasSearched,
        loading,
        results,
        availableSources,
        completedSources,
        totalSources,
        handleSearch,
        handleReset,
    };
}
