'use client';

/**
 * 下载器请求的浏览器端封装。
 * 所有请求都发给同源的 /api/m3u8dl 代理：m3u8-dl 的 CORS 不允许
 * 跨域 authorization 头，且由服务端转发可以避免浏览器预检失败。
 */

import type { ActionResult, DownloadSettings, DownloadTaskPayload, DownloaderConnection } from './types';

interface ProxyResponse {
    code?: number;
    message?: string;
    error?: string;
    data?: unknown;
}

function connectionOf(settings: DownloadSettings): DownloaderConnection {
    return { baseUrl: settings.baseUrl, token: settings.token };
}

async function callProxy(body: unknown, timeoutMs = 15000): Promise<{ ok: boolean; status: number; payload: ProxyResponse | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch('/api/m3u8dl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as ProxyResponse | null;
        return { ok: response.ok, status: response.status, payload };
    } catch (error) {
        const aborted = error instanceof DOMException && error.name === 'AbortError';
        return {
            ok: false,
            status: 0,
            payload: { error: aborted ? '请求下载器超时，请检查服务是否在线' : '无法连接下载代理' },
        };
    } finally {
        clearTimeout(timer);
    }
}

function toResult(response: { ok: boolean; status: number; payload: ProxyResponse | null }, successMessage: string): ActionResult {
    const { payload, ok, status } = response;
    if (!ok) {
        return { ok: false, message: payload?.error || `代理请求失败（HTTP ${status}）` };
    }
    if (payload?.code !== undefined && payload.code !== 0) {
        return { ok: false, message: payload.message || '下载器返回错误' };
    }
    return { ok: true, message: payload?.message || successMessage };
}

/** 设置面板里的「测试连接」：读取下载器 /api/config 验证地址与 token */
export async function testDownloader(settings: DownloadSettings): Promise<ActionResult> {
    const response = await callProxy({ action: 'test', settings: connectionOf(settings) }, 8000);
    return toResult(response, '连接成功');
}

/** 提交一条下载任务 */
export async function submitDownload(settings: DownloadSettings, task: DownloadTaskPayload): Promise<ActionResult> {
    const response = await callProxy({
        action: 'submit',
        settings: connectionOf(settings),
        list: [task],
    });
    return toResult(response, '已提交到下载器');
}
