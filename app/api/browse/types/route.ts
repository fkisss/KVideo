/**
 * Browse List API Route
 * Fetches the video list (片源) of a single source, optionally filtered by a category (type),
 * via the CMS `ac=detail&t=<typeId>&pg=<page>` endpoint.
 * Non-invasive addition: mirrors the existing detail/category CMS conventions, scoped to one source.
 */

import { NextResponse } from 'next/server';
import type { VideoSource } from '@/lib/types';

export const runtime = 'edge';

interface BrowseVideo {
    vod_id: number | string;
    vod_name: string;
    vod_pic?: string;
    vod_remarks?: string;
    type_name?: string;
    vod_year?: string;
    source: string;
}

async function fetchSourceList(
    source: VideoSource,
    typeId: string,
    page: number
): Promise<{ videos: BrowseVideo[]; page: number; pagecount: number }> {
    const url = new URL(`${source.baseUrl}${source.searchPath || ''}`);
    url.searchParams.set('ac', 'detail');
    url.searchParams.set('pg', page.toString());
    if (typeId) {
        url.searchParams.set('t', typeId);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                ...source.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const rawList = Array.isArray(data?.list) ? data.list : [];

        const videos: BrowseVideo[] = rawList.map((item: Record<string, unknown>) => ({
            vod_id: item.vod_id as number | string,
            vod_name: (item.vod_name as string) || '',
            vod_pic: item.vod_pic as string | undefined,
            vod_remarks: item.vod_remarks as string | undefined,
            type_name: item.type_name as string | undefined,
            vod_year: item.vod_year as string | undefined,
            source: source.id,
        }));

        return {
            videos,
            page: typeof data?.page === 'number' ? data.page : page,
            pagecount: typeof data?.pagecount === 'number' ? data.pagecount : 1,
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const source: VideoSource | undefined = body?.source;
        const typeId: string = body?.typeId ? String(body.typeId) : '';
        const page = Math.max(1, parseInt(String(body?.page ?? '1'), 10) || 1);

        if (!source || !source.baseUrl) {
            return NextResponse.json(
                { videos: [], page: 1, pagecount: 1, error: 'Missing source configuration' },
                { status: 400 }
            );
        }

        const result = await fetchSourceList(source, typeId, page);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Browse list error:', error);
        return NextResponse.json(
            { videos: [], page: 1, pagecount: 1, error: 'Failed to fetch list' },
            { status: 500 }
        );
    }
}
