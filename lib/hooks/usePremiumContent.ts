import { useState, useEffect, useCallback } from 'react';
import { useInfiniteScroll } from '@/lib/hooks/useInfiniteScroll';
import { settingsStore } from '@/lib/store/settings-store';

interface PremiumVideo {
    vod_id: string | number;
    vod_name: string;
    vod_pic?: string;
    vod_remarks?: string;
    type_name?: string;
    source: string;
}

const PAGE_LIMIT = 20;

export function usePremiumContent(categoryValue: string) {
    const [videos, setVideos] = useState<PremiumVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);

    const loadVideos = useCallback(async (pageNum: number, append = false) => {
        if (loading) return;

        setLoading(true);
        try {
            // Get sources from settings
            const settings = settingsStore.getSettings();
            // Resolve all relevant sources (premium sources + subscriptions that might be premium)
            // For simplicity, we send all enabled premium sources.
            const premiumSources = [
                ...settings.premiumSources,
                // Check if any subscription sources are marked as premium
                ...settings.subscriptions.filter(s => (s as any).group === 'premium')
            ].filter(s => (s as any).enabled !== false);

            // Should we include normal subscriptions too if categoryValue requests them?
            // The API handles filtering by categoryValue map.
            // If categoryValue is empty (Recommend), we use all enabled premium sources.

            const response = await fetch('/api/premium/category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sources: premiumSources,
                    category: categoryValue,
                    page: pageNum.toString(),
                    limit: PAGE_LIMIT.toString()
                })
            });

            if (!response.ok) throw new Error('Failed to fetch');

            const data = await response.json();
            const newVideos = data.videos || [];

            setVideos(prev => append ? [...prev, ...newVideos] : newVideos);
            setHasMore(newVideos.length === PAGE_LIMIT);
        } catch (error) {
            console.error('Failed to load videos:', error);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [loading, categoryValue]);

    useEffect(() => {
        setPage(1);
        setVideos([]);
        setHasMore(true);
        loadVideos(1, false);
    }, [categoryValue]); // eslint-disable-line react-hooks/exhaustive-deps

    const { prefetchRef, loadMoreRef } = useInfiniteScroll({
        hasMore,
        loading,
        page,
        onLoadMore: (nextPage) => {
            setPage(nextPage);
            loadVideos(nextPage, true);
        },
    });

    return {
        videos,
        loading,
        hasMore,
        prefetchRef,
        loadMoreRef,
    };
}
