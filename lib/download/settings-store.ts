/**
 * 下载扩展专用的设置存储。
 *
 * 刻意不接入上游 settingsStore：上游的 AppSettings、默认值、导入导出和云同步
 * 都是会随版本频繁改动的文件，把自有设置项塞进去会让每次同步上游都产生冲突。
 * 这里用独立 key + 独立订阅，对上游零修改。
 */

import { DEFAULT_DOWNLOAD_SETTINGS, DOWNLOAD_SETTINGS_KEY } from './defaults';
import type { DownloadSettings, PathPreset } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function normalizePresets(value: unknown): PathPreset[] {
    if (!Array.isArray(value)) return clone(DEFAULT_DOWNLOAD_SETTINGS.presets);
    const presets: PathPreset[] = [];
    for (const item of value) {
        if (!isRecord(item)) continue;
        const id = typeof item.id === 'string' ? item.id.trim() : '';
        const path = typeof item.path === 'string' ? item.path.trim() : '';
        if (!id || !path || presets.some((preset) => preset.id === id)) continue;
        presets.push({
            id,
            label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : id,
            path,
            flat: item.flat === true,
        });
    }
    // 全部被删除时回退到出厂预设，保证弹窗始终有可选项
    return presets.length ? presets : clone(DEFAULT_DOWNLOAD_SETTINGS.presets);
}

/** 对外部数据（localStorage / 导入）做逐字段校验与合并，避免坏数据让弹窗崩溃 */
export function normalizeDownloadSettings(value: unknown): DownloadSettings {
    const fallback = DEFAULT_DOWNLOAD_SETTINGS;
    const raw = isRecord(value) ? value : {};

    const autoConfirmSeconds = typeof raw.autoConfirmSeconds === 'number' && Number.isFinite(raw.autoConfirmSeconds)
        ? Math.min(30, Math.max(0, Math.round(raw.autoConfirmSeconds)))
        : fallback.autoConfirmSeconds;

    return {
        baseUrl: typeof raw.baseUrl === 'string' && raw.baseUrl.trim()
            ? raw.baseUrl.trim().replace(/\/+$/, '')
            : fallback.baseUrl,
        token: typeof raw.token === 'string' ? raw.token : fallback.token,
        presets: normalizePresets(raw.presets),
        defaultPresetId: typeof raw.defaultPresetId === 'string' && raw.defaultPresetId.trim()
            ? raw.defaultPresetId.trim()
            : fallback.defaultPresetId,
        defaultSaveDir: typeof raw.defaultSaveDir === 'string' && raw.defaultSaveDir.trim()
            ? raw.defaultSaveDir.trim()
            : fallback.defaultSaveDir,
        autoConfirmSeconds,
        openDownloadPage: typeof raw.openDownloadPage === 'boolean'
            ? raw.openDownloadPage
            : fallback.openDownloadPage,
    };
}

const listeners = new Set<() => void>();
let cache: DownloadSettings | null = null;
/** SSR 阶段返回固定引用，满足 useSyncExternalStore 对 snapshot 稳定性的要求 */
const SSR_SNAPSHOT: DownloadSettings = clone(DEFAULT_DOWNLOAD_SETTINGS);

export function getDownloadSettings(): DownloadSettings {
    if (cache) return cache;
    if (typeof window === 'undefined') return SSR_SNAPSHOT;

    let parsed: unknown = null;
    try {
        const stored = window.localStorage.getItem(DOWNLOAD_SETTINGS_KEY);
        if (stored) parsed = JSON.parse(stored);
    } catch {
        parsed = null;
    }
    cache = normalizeDownloadSettings(parsed);
    return cache;
}

export function saveDownloadSettings(settings: DownloadSettings): void {
    const normalized = normalizeDownloadSettings(settings);
    cache = normalized;
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(DOWNLOAD_SETTINGS_KEY, JSON.stringify(normalized));
        } catch {
            // 隐私模式 / 配额不足时仍保证本次会话内生效
        }
    }
    for (const listener of listeners) listener();
}

export function resetDownloadSettings(): DownloadSettings {
    const defaults = clone(DEFAULT_DOWNLOAD_SETTINGS);
    saveDownloadSettings(defaults);
    return defaults;
}

export function subscribeDownloadSettings(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
