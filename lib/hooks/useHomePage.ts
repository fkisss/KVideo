import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSearchCache } from '@/lib/hooks/useSearchCache';
import { useParallelSearch } from '@/lib/hooks/useParallelSearch';
import { useSubscriptionSync } from '@/lib/hooks/useSubscriptionSync';
import { settingsStore } from '@/lib/store/settings-store';

export function useHomePage() {
    useSubscriptionSync();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { loadFromCache, saveToCache } = useSearchCache();
    const hasLoadedCache = useRef(false);

    const [query, setQuery] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [currentSortBy, setCurrentSortBy] = useState('default');

    const onUrlUpdate = useCallback((q: string) => {
        router.replace(`/?q=${encodeURIComponent(q)}`, { scroll: false });
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

    // Load sort preference on mount and subscribe to changes
    useEffect(() => {
        const updateSettings = () => {
            const settings = settingsStore.getSettings();

            // Update sort preference
            if (settings.sortBy !== currentSortBy) {
                setCurrentSortBy(settings.sortBy);
            }

            // Check if we need to re-trigger search due to new sources being loaded
            // This fixes the issue where initial visit has 0 sources, then sources are loaded async
            // but the search (or lack thereof) is already stuck with empty sources.
            const enabledSources = settings.sources.filter(s => s.enabled);
            const hasSources = enabledSources.length > 0;

            // If we have a query, and we haven't searched effectively (or result count is 0),
            // and we suddenly have sources, retry the search.
            if (query && hasSources && (!hasSearched || results.length === 0) && !loading) {
                // We simply call handleSearch again which pulls fresh sources from settingsStore
                performSearch(query, enabledSources, settings.sortBy);
                setHasSearched(true);
            }
        };

        // Initial load
        updateSettings();

        // Subscribe to changes
        const unsubscribe = settingsStore.subscribe(updateSettings);
        return () => unsubscribe();
    }, [query, hasSearched, results.length, loading, performSearch, currentSortBy]);

    // Load cached results on mount
    useEffect(() => {
        if (hasLoadedCache.current) return;
        hasLoadedCache.current = true;

        const urlQuery = searchParams.get('q');
        const cached = loadFromCache();

        if (urlQuery) {
            setQuery(urlQuery);
            if (cached && cached.query === urlQuery && cached.results.length > 0) {
                setHasSearched(true);
                loadCachedResults(cached.results, cached.availableSources);
            } else {
                handleSearch(urlQuery);
            }
        }
    }, [searchParams, loadFromCache, loadCachedResults]);

    const handleSearch = (searchQuery: string) => {
        if (!searchQuery.trim()) return;

        setQuery(searchQuery);
        setHasSearched(true);
        const settings = settingsStore.getSettings();
        // Filter enabled sources
        const enabledSources = settings.sources.filter(s => s.enabled);

        if (enabledSources.length === 0) {
            // If no sources yet, we can't do much, but the subscription above will catch it 
            // once sources are loaded by useSubscriptionSync
            return;
        }

        performSearch(searchQuery, enabledSources, currentSortBy as any);
    };

    const handleReset = () => {
        setHasSearched(false);
        setQuery('');
        resetSearch();
        router.replace('/', { scroll: false });
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
