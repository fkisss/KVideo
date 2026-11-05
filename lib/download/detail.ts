'use client';

/**
 * 播放页详情元数据的按需读取。
 *
 * 播放器组件只向下传了 videoTitle / episodeName，拿不到 type_name 与集数，
 * 而「电影 / 电视剧 / 综艺」的自动分类需要这两个字段。
 * 与其再改两三个上游组件做 props 透传，不如在打开下载弹窗时按 URL 参数
 * 向同源 /api/detail 取一次（失败时静默回退到播放器已有的 episodeName）。
 */

import type { VideoMeta } from './types';

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

export async function fetchVideoMeta(input: {
    videoId: string;
    sourceId: string;
    episodeIndex: number;
    timeoutMs?: number;
}): Promise<VideoMeta | null> {
    const { videoId, sourceId, episodeIndex, timeoutMs = 4000 } = input;
    if (!videoId || !sourceId) return null;

    // 手写超时而非 AbortSignal.timeout，兼容项目仍在适配的旧版 WebView
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const query = new URLSearchParams({ id: videoId, source: sourceId });
        const response = await fetch(`/api/detail?${query.toString()}`, {
            signal: controller.signal,
            cache: 'no-store',
        });
        if (!response.ok) return null;

        const payload = asRecord(await response.json());
        const data = asRecord(payload?.data);
        if (!data) return null;

        const episodes = Array.isArray(data.episodes) ? data.episodes : [];
        const episode = asRecord(episodes[episodeIndex]);
        return {
            title: typeof data.vod_name === 'string' ? data.vod_name : undefined,
            typeName: typeof data.type_name === 'string' ? data.type_name : undefined,
            episodeCount: episodes.length || undefined,
            episodeName: typeof episode?.name === 'string' ? episode.name : undefined,
        };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** 从播放页 URL 读取命名/详情所需参数；不依赖 useSearchParams，避免 Suspense 约束 */
export function readPlayerQuery(): { videoId: string; sourceId: string; title: string; episodeIndex: number } {
    if (typeof window === 'undefined') {
        return { videoId: '', sourceId: '', title: '', episodeIndex: 0 };
    }
    const params = new URLSearchParams(window.location.search);
    const parsedEpisode = Number.parseInt(params.get('episode') ?? '0', 10);
    return {
        videoId: params.get('id') ?? '',
        sourceId: params.get('source') ?? '',
        title: params.get('title') ?? '',
        episodeIndex: Number.isFinite(parsedEpisode) && parsedEpisode > 0 ? parsedEpisode : 0,
    };
}
