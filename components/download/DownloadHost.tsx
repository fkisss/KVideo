'use client';

/**
 * 下载扩展的唯一挂载点（由 DesktopVideoPlayer 渲染一次）。
 *
 * 上游代码只需要调用 setDownloadContext / openDownloadDialog；
 * 每次打开弹窗都用新的 key 重建 DownloadSession，因此状态天然干净，
 * 不需要在 effect 里批量 setState 做重置。
 */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import {
    closeDownloadDialog,
    getDownloadContext,
    isDownloadDialogVisible,
    subscribeDownloadDialog,
} from '@/lib/download/bus';
import { submitDownload, testDownloader } from '@/lib/download/client';
import { fetchVideoMeta, readPlayerQuery } from '@/lib/download/detail';
import { buildDownloadPlan, validatePlan } from '@/lib/download/naming';
import {
    getDownloadSettings,
    resetDownloadSettings,
    saveDownloadSettings,
    subscribeDownloadSettings,
} from '@/lib/download/settings-store';
import type {
    ActionResult,
    DownloadSettings,
    PlanOverrides,
    PlayerDownloadContext,
    VideoMeta,
} from '@/lib/download/types';
import { DownloadDialog, type DownloadStatus } from './DownloadDialog';
import { DownloadSettingsPanel } from './DownloadSettingsPanel';

const EMPTY_CONTEXT: PlayerDownloadContext = {
    src: '',
    title: '',
    episodeName: '',
    episodeIndex: 0,
    totalEpisodes: 0,
};

const NO_TOUCHED: Record<keyof PlanOverrides, boolean> = {
    presetId: false,
    saveDir: false,
    filename: false,
};

/** 原生全屏时浏览器只渲染全屏元素子树，弹窗必须挂进去才可见 */
function resolvePortalRoot(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    const fullscreen = document.fullscreenElement;
    const root = fullscreen instanceof HTMLElement
        ? (fullscreen.tagName === 'VIDEO' ? fullscreen.parentElement : fullscreen)
        : null;
    return root ?? document.body;
}

interface Snapshot {
    settings: DownloadSettings;
    overrides: PlanOverrides;
    status: DownloadStatus;
    context: PlayerDownloadContext | null;
    touched: Record<keyof PlanOverrides, boolean>;
    openPageOverride: boolean | null;
}

/** 外壳：只负责可见性、设置订阅与「每次打开重建会话」 */
export function DownloadHost() {
    const visible = useSyncExternalStore(subscribeDownloadDialog, isDownloadDialogVisible, () => false);
    const settings = useSyncExternalStore(subscribeDownloadSettings, getDownloadSettings, getDownloadSettings);
    const [sessionKey, setSessionKey] = useState(0);

    useEffect(() => subscribeDownloadDialog(() => {
        // 订阅回调中更新 key：外部状态变化触发，符合 hooks 规则
        if (isDownloadDialogVisible()) setSessionKey((value) => value + 1);
    }), []);

    const portalRoot = visible ? resolvePortalRoot() : null;
    if (!visible || !portalRoot) return null;

    return createPortal(<DownloadSession key={sessionKey} settings={settings} />, portalRoot);
}

/** 一次下载会话：元数据补全、倒计时、提交与结果 */
function DownloadSession({ settings }: { settings: DownloadSettings }) {
    const [context] = useState<PlayerDownloadContext | null>(() => getDownloadContext());
    const [meta, setMeta] = useState<VideoMeta | null>(null);
    const [metaLoading, setMetaLoading] = useState(true);
    const [overrides, setOverrides] = useState<PlanOverrides>({});
    const [touched, setTouched] = useState<Record<keyof PlanOverrides, boolean>>(NO_TOUCHED);
    const [view, setView] = useState<'confirm' | 'settings'>('confirm');
    const [autoPaused, setAutoPaused] = useState(false);
    const [remainingMs, setRemainingMs] = useState(() => settings.autoConfirmSeconds * 1000);
    const [status, setStatus] = useState<DownloadStatus>('idle');
    const [result, setResult] = useState<ActionResult | null>(null);
    const [popupBlocked, setPopupBlocked] = useState(false);
    const [openPageForThisDownload, setOpenPageForThisDownload] = useState<boolean | null>(null);

    // 在 effect 中同步「最新值」，让提交回调保持稳定，倒计时不会被反复重置
    const snapshotRef = useRef<Snapshot>({
        settings,
        overrides,
        status,
        context,
        touched,
        openPageOverride: openPageForThisDownload,
    });
    const metaRef = useRef<VideoMeta | null>(null);
    const metaPromiseRef = useRef<Promise<VideoMeta | null> | null>(null);
    const submittingRef = useRef(false);
    const submitRef = useRef<() => void>(() => {});

    // 按需补全 type_name / 集数 / 真实集名；失败时命名逻辑自动回退到播放器上下文
    useEffect(() => {
        let cancelled = false;
        const query = readPlayerQuery();
        const promise = fetchVideoMeta({
            videoId: query.videoId,
            sourceId: query.sourceId,
            episodeIndex: context?.episodeIndex ?? query.episodeIndex,
        }).then((data) => {
            if (!cancelled) {
                metaRef.current = data;
                setMeta(data);
                setMetaLoading(false);
            }
            return data;
        });
        metaPromiseRef.current = promise;
        return () => {
            cancelled = true;
            metaPromiseRef.current = null;
        };
    }, [context]);

    // ESC 关闭弹窗，并阻止播放器把同一次按键当作退出全屏
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            closeDownloadDialog();
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, []);

    const plan = useMemo(
        () => buildDownloadPlan(context ?? EMPTY_CONTEXT, meta, settings, overrides),
        [context, meta, settings, overrides],
    );

    const openPage = openPageForThisDownload ?? settings.openDownloadPage;

    const tryOpenDownloadPage = useCallback(() => {
        const opened = window.open(snapshotRef.current.settings.baseUrl, '_blank', 'noopener,noreferrer');
        setPopupBlocked(!opened);
    }, []);

    const handleSubmit = useCallback(async () => {
        const snapshot = snapshotRef.current;
        if (submittingRef.current || snapshot.status !== 'idle') return;

        // 自动提交可能早于详情返回；短暂等待以保证用真实集名而不是序号兜底
        if (metaPromiseRef.current && metaRef.current === null) {
            await Promise.race([
                metaPromiseRef.current,
                new Promise<void>((resolve) => setTimeout(resolve, 1200)),
            ]);
        }

        const currentSettings = snapshot.settings;
        const finalPlan = buildDownloadPlan(
            snapshot.context ?? EMPTY_CONTEXT,
            metaRef.current,
            currentSettings,
            snapshot.overrides,
        );
        const validationError = validatePlan(finalPlan);
        if (validationError) {
            setStatus('error');
            setResult({ ok: false, message: validationError });
            return;
        }

        submittingRef.current = true;
        setStatus('submitting');
        const response = await submitDownload(currentSettings, {
            url: finalPlan.url,
            filename: finalPlan.filename,
            saveDir: finalPlan.saveDir,
        });
        submittingRef.current = false;
        setStatus(response.ok ? 'success' : 'error');
        setResult(response);

        if (response.ok && (snapshot.openPageOverride ?? currentSettings.openDownloadPage)) {
            tryOpenDownloadPage();
        }
    }, [tryOpenDownloadPage]);

    // 倒计时：超时未取消/未交互即按当前（默认）设置提交
    useEffect(() => {
        if (view !== 'confirm' || status !== 'idle' || autoPaused) return;
        const total = Math.max(0, settings.autoConfirmSeconds * 1000);
        if (total === 0) return;
        const startedAt = Date.now();
        const timer = window.setInterval(() => {
            const left = Math.max(0, total - (Date.now() - startedAt));
            setRemainingMs(left);
            if (left <= 0) {
                window.clearInterval(timer);
                submitRef.current();
            }
        }, 100);
        return () => window.clearInterval(timer);
    }, [view, status, autoPaused, settings.autoConfirmSeconds]);

    const handlePatch = useCallback((patch: Partial<PlanOverrides>, field: keyof PlanOverrides) => {
        // 任何交互都暂停自动提交，避免用户正在改设置时被超时抢先提交
        setAutoPaused(true);
        setTouched((prev) => ({ ...prev, [field]: true }));
        setOverrides((prev) => {
            const next = { ...prev, ...patch };
            // 切换预设时，若用户没手动改过目录，让目录随新预设重算
            if (field === 'presetId' && !snapshotRef.current.touched.saveDir) next.saveDir = undefined;
            return next;
        });
    }, []);

    const handleCancel = useCallback(() => closeDownloadDialog(), []);
    const handleRetry = useCallback(() => {
        setStatus('idle');
        setResult(null);
        setAutoPaused(true);
        setRemainingMs(0);
    }, []);

    // 统一的 ref 同步（放在 effect 内，避免 render 期间读写 ref）
    useEffect(() => {
        snapshotRef.current = {
            settings,
            overrides,
            status,
            context,
            touched,
            openPageOverride: openPageForThisDownload,
        };
        submitRef.current = handleSubmit;
    });

    if (view === 'settings') {
        return (
            <DownloadSettingsPanel
                settings={settings}
                onSave={(next: DownloadSettings) => {
                    saveDownloadSettings(next);
                    setAutoPaused(true);
                    setView('confirm');
                }}
                onBack={() => {
                    setAutoPaused(true);
                    setView('confirm');
                }}
                onReset={() => resetDownloadSettings()}
                onTest={(candidate) => testDownloader(candidate)}
            />
        );
    }

    return (
        <DownloadDialog
            plan={plan}
            settings={settings}
            status={status}
            result={result}
            remainingMs={settings.autoConfirmSeconds > 0 ? remainingMs : 0}
            autoPaused={autoPaused}
            metaLoading={metaLoading}
            popupBlocked={popupBlocked}
            openPageForThisDownload={openPage}
            onPatch={handlePatch}
            onOpenPageChange={(value) => {
                setOpenPageForThisDownload(value);
                setAutoPaused(true);
            }}
            onSubmit={() => { void handleSubmit(); }}
            onCancel={handleCancel}
            onOpenSettings={() => {
                setAutoPaused(true);
                setView('settings');
            }}
            onRetry={handleRetry}
            onOpenDownloadPage={tryOpenDownloadPage}
        />
    );
}
