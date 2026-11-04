/**
 * M3U8 Downloader Proxy API Route
 * Forwards download-task submissions to the LAN m3u8-dl service
 * (e.g. http://192.168.3.13:6600).
 *
 * 为什么需要服务端代理：m3u8-dl 的 HTTP API 只接受 authorization 请求头认证，
 * 而 其 CORS 配置的 Access-Control-Allow-Headers 仅有 Content-Type，
 * 浏览器跨域携带 authorization 头会被预检(OPTIONS)拦截。
 * 由服务端转发可绕开 CORS，同时 token 不暴露给浏览器端。
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const M3U8DL_URL = process.env.M3U8DL_URL || 'http://192.168.3.13:6600';
const M3U8DL_TOKEN = process.env.M3U8DL_TOKEN || '07e1cd7d';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body || !Array.isArray(body.list) || body.list.length === 0) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const resp = await fetch(`${M3U8DL_URL}/api/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                authorization: M3U8DL_TOKEN,
            },
            body: JSON.stringify(body),
            // m3u8-dl 服务在局域网内，响应较快，设置合理超时
            signal: AbortSignal.timeout(15000),
        });

        const data = await resp.json().catch(() => null);
        return NextResponse.json(data || { error: 'Invalid response from downloader' }, {
            status: resp.ok ? 200 : resp.status,
        });
    } catch (error) {
        console.error('M3U8DL proxy error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
