/**
 * KVideo 下载扩展的公共类型。
 *
 * 该文件属于自有扩展模块（lib/download/*），不引用任何上游组件，
 * 以便上游 KuekHaoYang/KVideo 更新时可以直接同步。
 */

/** 元数据自动推断出的内容分类，同时是内置预设的 id */
export type DownloadCategory = 'movie' | 'tv' | 'variety' | 'custom';

export interface PathPreset {
    /** 内置三类使用 movie / tv / variety；自定义预设可用任意 id */
    id: string;
    label: string;
    /** 下载器所在主机上的目录，例如 /mnt/nas-video/电影/ */
    path: string;
    /** true = 直接保存到该目录（电影）；false = 额外建一层片名目录（剧集/综艺） */
    flat?: boolean;
}

export interface DownloadSettings {
    /** m3u8-dl 的 WebUI / API 根地址 */
    baseUrl: string;
    /** m3u8-dl 的 authorization token（访问密码的 MD5 前 8 位） */
    token: string;
    /** 可增删改的保存路径预设 */
    presets: PathPreset[];
    /** 自动推断结果找不到对应预设时使用的预设 id */
    defaultPresetId: string;
    /** 预设缺失时的兜底根目录 */
    defaultSaveDir: string;
    /** 弹窗自动确认秒数；0 表示必须手动确认 */
    autoConfirmSeconds: number;
    /** 提交成功后是否打开下载器页面 */
    openDownloadPage: boolean;
}

/** 播放器在运行时注册的上下文（由 DesktopVideoPlayer 提供） */
export interface PlayerDownloadContext {
    /** 当前播放地址，可能是 /api/proxy?url=... */
    src: string;
    title: string;
    /** 资源站返回的真实集名，例如 20261102特别企划 / HD国语 */
    episodeName: string;
    episodeIndex: number;
    totalEpisodes: number;
}

/** /api/detail 中用于命名与分类的字段 */
export interface VideoMeta {
    title?: string;
    /** 例如 喜剧片 / 大陆综艺 / 国产剧 */
    typeName?: string;
    episodeCount?: number;
    episodeName?: string;
}

/** 弹窗中可被临时覆盖的字段 */
export interface PlanOverrides {
    presetId?: string;
    saveDir?: string;
    filename?: string;
}

/** 一条完整的下载方案（展示 + 提交共用） */
export interface DownloadPlan {
    /** 提交给下载器的直链（不含播放器代理前缀） */
    url: string;
    /** 文件名，不含扩展名 */
    filename: string;
    /** 保存目录，不含文件名 */
    saveDir: string;
    /** 预览用完整路径，含 .mp4 */
    fullPath: string;
    presetId: string;
    presetLabel: string;
    isMovie: boolean;
    title: string;
    episodeLabel: string;
    /** 元数据是否来自 /api/detail（用于在弹窗里标注可信度） */
    metaResolved: boolean;
}

/** m3u8-dl POST /api/download 的 list 元素 */
export interface DownloadTaskPayload {
    url: string;
    filename: string;
    saveDir: string;
}

/** 传给服务端代理的连接信息 */
export interface DownloaderConnection {
    baseUrl: string;
    token: string;
}

export interface ActionResult {
    ok: boolean;
    message: string;
}
