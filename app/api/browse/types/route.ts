/**
 * Browse Types API Route
 * Fetches the category (片单) list of a single video source via the CMS `ac=list` endpoint.
 * Non-invasive addition: reuses the same CMS API convention as the existing search/detail routes,
 * but scoped to ONE source at a time so users can browse each interface separately.
 */

import { NextResponse } from 'next/server';
import type { VideoSource } from '@/lib/types';

export const runtime = 'edge';

interface Category {
    type_id: number | string;
    type_name: string;
}

async function fetchSourceCategories(source: VideoSource): Promise<Category[]> {
    const url = new URL(`${source.baseUrl}${source.searchPath || ''}`);
    url.searchParams.set('ac', 'list');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

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
        const rawList: Category[] = Array.isArray(data?.class) ? data.class : [];

        return rawList
            .filter((cat) => cat && typeof cat.type_name === 'string' && cat.type_name.trim().length > 0)
            .map((cat) => ({ type_id: cat.type_id, type_name: cat.type_name.trim() }));
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const source: VideoSource | undefined = body?.source;

        if (!source || !source.baseUrl) {
            return NextResponse.json(
                { categories: [], error: 'Missing source configuration' },
                { status: 400 }
            );
        }

        const categories = await fetchSourceCategories(source);

        return NextResponse.json({
            sourceId: source.id,
            sourceName: source.name,
            categories,
        });
    } catch (error) {
        console.error('Browse types error:', error);
        return NextResponse.json(
            { categories: [], error: 'Failed to fetch categories' },
            { status: 500 }
        );
    }
}
