import type { DownloadSettings, PathPreset } from './types';

/** 独立 localStorage key：不复用上游 kvideo-settings，避免污染设置导出/云同步 */
export const DOWNLOAD_SETTINGS_KEY = 'kvideo-download-settings';

export const DEFAULT_PRESETS: PathPreset[] = [
    { id: 'tv', label: '电视剧', path: '/mnt/nas-video/电视剧/' },
    { id: 'movie', label: '电影', path: '/mnt/nas-video/电影/', flat: true },
    { id: 'variety', label: '综艺', path: '/mnt/nas-video/综艺/' },
];

/**
 * 出厂默认值。修改这里即可改变所有浏览器的初始配置；
 * 用户在设置面板里的修改保存在 localStorage，不会写回代码。
 * 服务端代理也支持 M3U8DL_URL / M3U8DL_TOKEN 环境变量作为兜底。
 */
export const DEFAULT_DOWNLOAD_SETTINGS: DownloadSettings = {
    baseUrl: 'http://192.168.3.13:6600',
    // m3u8-dl 的访问 token（访问密码 MD5 前 8 位）。留空则使用服务端环境变量。
    token: '07e1cd7d',
    presets: DEFAULT_PRESETS,
    defaultPresetId: 'tv',
    defaultSaveDir: '/mnt/nas-video/',
    autoConfirmSeconds: 3,
    openDownloadPage: false,
};
