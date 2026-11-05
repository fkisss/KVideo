/**
 * m3u8-dl（@lzwme/m3u8-dl WebUI）服务端代理。
 *
 * 为什么必须代理：下载器只接受 authorization 请求头认证，而它的 CORS
 * 允许头中没有 authorization，浏览器跨域提交会被 OPTIONS 预检拦截。
 *
 * 与 11/4 版本的区别：地址与 token 不再硬编码在路由里，而是由设置面板
 * 下发（并可用 M3U8DL_URL / M3U8DL_TOKEN 环境变量覆盖），同时补充了
 * 任务字段校验、连接测试、超时与可读的错误信息。
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_BASE_URL = process.env.M3U8DL_URL || 'http://192.168.3.13:6600';
const DEFAULT_TOKEN = process.env.M3U8DL_TOKEN || '';
const SUBMIT_TIMEOUT_MS = 15000;
const TEST_TIMEOUT_MS = 8000;
const MAX_TASKS = 20;

interface ProxyBody {
    action?: unknown;
    settings?: unknown;
    list?: unknown;
}

interface DownloaderSettings {
    baseUrl: string;
    token: string;
}

interface NormalizedTask {
    url: string;
    filename: string;
    saveDir: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

/** 只接受 http(s) 且不含内嵌凭据的地址，避免被当作任意请求的跳板 */
function resolveSettings(value: unknown): DownloaderSettings | null {
    const raw = asRecord(value);
    const candidate = typeof raw?.baseUrl === 'string' && raw.baseUrl.trim()
        ? raw.baseUrl.trim()
        : DEFAULT_BASE_URL;

    let baseUrl: string;
    try {
        const url = new URL(candidate);
        if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
            return null;
        }
        baseUrl = url.toString().replace(/\/+$/, '');
    } catch {
        return null;
    }

    const suppliedToken = typeof raw?.token === 'string' ? raw.token.trim() : '';
    return { baseUrl, token: suppliedToken || DEFAULT_TOKEN };
}

function normalizeTasks(value: unknown): NormalizedTask[] | null {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TASKS) return null;

    const tasks: NormalizedTask[] = [];
    for (const item of value) {
        const raw = asRecord(item);
        if (!raw) return null;
        const url = typeof raw.url === 'string' ? raw.url.trim() : '';
        const filename = typeof raw.filename === 'string' ? raw.filename.trim() : '';
        const saveDir = typeof raw.saveDir === 'string' ? raw.saveDir.trim() : '';

        if (!/^https?:\/\//i.test(url)) return null;
        if (!filename || /[\\/:*?"<>|]/.test(filename)) return null;
        if (!saveDir || saveDir.includes('\0')) return null;
        tasks.push({ url, filename, saveDir: saveDir.replace(/\/+$/, '') || '/' });
    }
    return tasks;
}

function errorResponse(message: string, status: number) {
    return NextResponse.json({ error: message }, { status });
}

async function readDownloaderJson(response: Response): Promise<Record<string, unknown> | null> {
    const payload = await response.json().catch(() => null);
    return asRecord(payload);
}

export async function POST(request: NextRequest) {
    let body: ProxyBody;
    try {
        body = (await request.json()) as ProxyBody;
    } catch {
        return errorResponse('请求体不是合法的 JSON', 400);
    }

    const settings = resolveSettings(body.settings);
    if (!settings) return errorResponse('下载器地址不合法（仅支持 http/https）', 400);

    const action = body.action === 'test' ? 'test' : 'submit';

    if (action === 'test') {
        try {
            const response = await fetch(`${settings.baseUrl}/api/config`, {
                method: 'GET',
                headers: settings.token ? { authorization: settings.token } : {},
                cache: 'no-store',
                signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
            });
            const payload = await readDownloaderJson(response);
            if (!response.ok) {
                const reason = typeof payload?.message === 'string' ? payload.message : '';
                return errorResponse(
                    reason || `下载器返回 HTTP ${response.status}，请检查地址与 token`,
                    502,
                );
            }
            if (payload && typeof payload.code === 'number' && payload.code !== 0) {
                return errorResponse(String(payload.message || '下载器认证失败，请检查 token'), 502);
            }
            return NextResponse.json({ code: 0, message: '连接成功', data: payload?.data ?? null });
        } catch (error) {
            console.error('[m3u8dl] test failed:', error);
            return errorResponse('无法连接下载器，请检查地址与服务状态', 502);
        }
    }

    const tasks = normalizeTasks(body.list);
    if (!tasks) return errorResponse('下载任务参数不合法（url / filename / saveDir 必填且需合法）', 400);

    try {
        const response = await fetch(`${settings.baseUrl}/api/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(settings.token ? { authorization: settings.token } : {}),
            },
            body: JSON.stringify({ list: tasks }),
            signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
        });
        const payload = await readDownloaderJson(response);

        if (!response.ok || (payload && typeof payload.code === 'number' && payload.code !== 0)) {
            return errorResponse(
                String(payload?.message || `下载器返回 HTTP ${response.status}`),
                response.status >= 400 && response.status < 500 ? response.status : 502,
            );
        }

        return NextResponse.json(payload || { code: 0, message: '已提交到下载器' });
    } catch (error) {
        console.error('[m3u8dl] submit failed:', error);
        return errorResponse(
            error instanceof Error && error.name === 'TimeoutError'
                ? '下载器响应超时，请检查服务是否在线'
                : '无法连接下载器，请检查地址与服务状态',
            502,
        );
    }
}
