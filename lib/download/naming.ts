/**
 * 下载文件命名与保存路径的纯函数集合。
 *
 * 设计目标（对应需求）：
 *  - 电影只有一集/一条线路：直接保存，文件名 = 片名-线路名，不建子目录
 *      唐伯虎点秋香2019 + HD国语 -> 唐伯虎点秋香2019-HD国语.mp4
 *  - 电视剧/综艺有多集：用资源站的真实集名，禁止用 index+1 冒充集号
 *      你好，星期六 + 20261102特别企划
 *        -> /综艺/你好星期六/你好星期六-20261102特别企划.mp4
 *
 * 本文件不依赖 DOM / React，可直接做单元测试。
 */

import type {
    DownloadCategory,
    DownloadPlan,
    DownloadSettings,
    PathPreset,
    PlanOverrides,
    PlayerDownloadContext,
    VideoMeta,
} from './types';

/** Windows / POSIX 通用非法字符与控制字符 */
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;

/**
 * 需要剔除的标点。中文逗号必须直接删除而不是替换为空格：
 * 「你好，星期六」期望得到「你好星期六」。
 * 保留 - 和 _ 作为分隔符，保留空格供英文片名使用。
 */
const STRIP_PUNCTUATION = /[，。、；：！？（）【】《》〈〉「」『』“”‘’…—～·,.;:!?()\[\]{}'"`~#$%^&+=]/g;

const MAX_NAME_LENGTH = 120;
const FALLBACK_TITLE = '未命名视频';

/** 清理为可作文件名/目录名的字符串 */
export function sanitizeName(input: string): string {
    const value = String(input ?? '')
        .replace(INVALID_FILENAME_CHARS, '')
        .replace(STRIP_PUNCTUATION, '')
        .replace(/\s+/g, ' ')
        .replace(/^[\s.\-_]+|[\s.\-_]+$/g, '')
        .trim();
    return value.slice(0, MAX_NAME_LENGTH).trim() || FALLBACK_TITLE;
}

/** 统一目录分隔符、去掉结尾斜杠；空串原样返回 */
export function normalizeDir(path: string): string {
    const value = String(path ?? '').trim().replace(/\\/g, '/');
    if (!value) return '';
    return value.replace(/\/+$/, '') || '/';
}

/** 拼接目录，child 会自动做文件名安全化 */
export function joinDir(base: string, child?: string): string {
    const root = normalizeDir(base);
    const segment = child ? sanitizeName(child) : '';
    if (!segment) return root;
    return root === '/' ? `/${segment}` : `${root}/${segment}`;
}

/** 播放器启用代理时 src 形如 /api/proxy?url=...，下载器需要原始 m3u8 直链 */
export function resolveOriginalUrl(src: string): string {
    const value = String(src ?? '').trim();
    if (!value || !value.includes('/api/proxy')) return value;
    const match = value.match(/[?&]url=([^&]+)/);
    if (!match) return value;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

/**
 * 推断内容分类。
 * 注意「喜剧片」含「剧」字，必须先判「片/电影」再判「剧」，否则电影会被误判成剧集。
 */
export function detectCategory(meta: VideoMeta | null, context: PlayerDownloadContext): DownloadCategory {
    const typeName = String(meta?.typeName ?? '').trim();
    if (typeName) {
        if (/综艺|真人秀|选秀|脱口秀|访谈/.test(typeName)) return 'variety';
        if (/电影|片|剧场/.test(typeName)) return 'movie';
        if (/剧|连续|季|动漫|动画/.test(typeName)) return 'tv';
    }

    const episodeCount = meta?.episodeCount ?? context.totalEpisodes;
    if (Number.isFinite(episodeCount) && episodeCount > 0 && episodeCount <= 1) {
        return 'movie';
    }
    return 'tv';
}

/** 生成文件名（不含扩展名） */
export function buildFileName(
    title: string,
    episodeLabel: string,
    episodeIndex: number,
    isMovie: boolean,
): string {
    const cleanTitle = sanitizeName(title);
    // 空集名不能走 sanitizeName，否则会拿到「未命名视频」并被误当成真实集名
    const cleanEpisode = String(episodeLabel ?? '').trim() ? sanitizeName(episodeLabel) : '';

    // 真实集名优先。只有在完全缺失时才用序号兜底，避免出现「你好，星期六 第555集」。
    if (cleanEpisode && cleanEpisode !== cleanTitle) {
        return `${cleanTitle}-${cleanEpisode}`;
    }
    if (isMovie || cleanEpisode === cleanTitle) {
        return cleanTitle;
    }
    return `${cleanTitle}-第${Math.max(0, Math.floor(episodeIndex)) + 1}集`;
}

/** 解析预设：找不到时回退到默认预设，再回退到默认根目录 */
export function resolvePreset(settings: DownloadSettings, presetId: string): PathPreset {
    const found = settings.presets.find((item) => item.id === presetId)
        ?? settings.presets.find((item) => item.id === settings.defaultPresetId)
        ?? settings.presets[0];
    return found ?? {
        id: presetId,
        label: presetId,
        path: settings.defaultSaveDir,
        flat: presetId === 'movie',
    };
}

/**
 * 生成完整下载方案。overrides 来自弹窗里用户的临时修改；
 * 元数据异步返回时，只要把用户已修改的字段继续放进 overrides，就不会覆盖用户编辑。
 */
export function buildDownloadPlan(
    context: PlayerDownloadContext,
    meta: VideoMeta | null,
    settings: DownloadSettings,
    overrides: PlanOverrides = {},
): DownloadPlan {
    const title = sanitizeName(meta?.title || context.title);
    const rawEpisode = meta?.episodeName || context.episodeName || '';
    const episodeLabel = rawEpisode.trim() ? sanitizeName(rawEpisode) : '';
    const presetId = overrides.presetId ?? detectCategory(meta, context);
    const preset = resolvePreset(settings, presetId);
    const isMovie = preset.flat ?? (preset.id === 'movie');

    // 电影直接存进分类目录；剧集/综艺额外建一层以片名命名的目录。
    const autoSaveDir = isMovie
        ? normalizeDir(preset.path)
        : joinDir(preset.path, title);

    const autoFilename = buildFileName(title, episodeLabel, context.episodeIndex, isMovie);
    const filename = sanitizeName(overrides.filename ?? autoFilename);
    const saveDir = normalizeDir(overrides.saveDir ?? autoSaveDir);
    const fullPath = saveDir === '/'
        ? `/${filename}.mp4`
        : `${saveDir}/${filename}.mp4`;

    return {
        url: resolveOriginalUrl(context.src),
        filename,
        saveDir,
        fullPath,
        presetId: preset.id,
        presetLabel: preset.label,
        isMovie,
        title,
        episodeLabel,
        metaResolved: meta !== null,
    };
}

/** 提交前校验，返回错误信息或 null */
export function validatePlan(plan: DownloadPlan): string | null {
    if (!plan.url || !/^https?:\/\//i.test(plan.url)) {
        return '没有可用的视频直链，请等待播放地址加载后再试';
    }
    if (!plan.saveDir) return '保存目录不能为空';
    if (!plan.filename) return '文件名不能为空';
    if (/[\\/:*?"<>|]/.test(plan.filename)) return '文件名包含非法字符';
    return null;
}
