'use client';

import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Download,
    ExternalLink,
    FolderOpen,
    Loader2,
    Settings2,
} from 'lucide-react';
import type {
    ActionResult,
    DownloadPlan,
    DownloadSettings,
    PlanOverrides,
} from '@/lib/download/types';
import {
    DialogShell,
    Field,
    InfoRow,
    INPUT_CLASS,
    PRIMARY_BTN,
    SECONDARY_BTN,
    Toggle,
} from './ui';

export type DownloadStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface DownloadDialogProps {
    plan: DownloadPlan;
    settings: DownloadSettings;
    status: DownloadStatus;
    result: ActionResult | null;
    remainingMs: number;
    autoPaused: boolean;
    metaLoading: boolean;
    popupBlocked: boolean;
    openPageForThisDownload: boolean;
    onPatch: (patch: Partial<PlanOverrides>, field: keyof PlanOverrides) => void;
    onOpenPageChange: (value: boolean) => void;
    onSubmit: () => void;
    onCancel: () => void;
    onOpenSettings: () => void;
    onRetry: () => void;
    onOpenDownloadPage: () => void;
}

/** 点击「下载视频」后的确认界面：信息预览 + 临时修改 + 倒计时自动提交 */
export function DownloadDialog({
    plan,
    settings,
    status,
    result,
    remainingMs,
    autoPaused,
    metaLoading,
    popupBlocked,
    openPageForThisDownload,
    onPatch,
    onOpenPageChange,
    onSubmit,
    onCancel,
    onOpenSettings,
    onRetry,
    onOpenDownloadPage,
}: DownloadDialogProps) {
    const totalMs = Math.max(0, settings.autoConfirmSeconds * 1000);
    const counting = status === 'idle' && !autoPaused && totalMs > 0;
    const progress = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
    const secondsLeft = Math.ceil(remainingMs / 1000);
    const locked = status === 'submitting';

    return (
        <DialogShell
            title="下载视频"
            subtitle={metaLoading ? '正在读取影片信息…' : '确认信息后开始下载，或直接等待自动提交'}
            icon={<Download size={20} />}
            onClose={onCancel}
            width="max-w-xl"
            footer={
                <>
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-sm text-[var(--text-color-secondary)] transition-colors hover:text-[var(--text-color)]"
                        onClick={onOpenSettings}
                        disabled={locked}
                    >
                        <Settings2 size={16} />
                        设置
                    </button>
                    <div className="flex items-center gap-2">
                        <button type="button" className={SECONDARY_BTN} onClick={onCancel}>
                            {status === 'idle' ? '取消' : '关闭'}
                        </button>
                        {status === 'success' ? (
                            <button type="button" className={PRIMARY_BTN} onClick={onCancel}>
                                <CheckCircle2 size={16} /> 完成
                            </button>
                        ) : status === 'error' ? (
                            <button type="button" className={PRIMARY_BTN} onClick={onRetry}>
                                重试
                            </button>
                        ) : (
                            <button type="button" className={PRIMARY_BTN} onClick={onSubmit} disabled={locked}>
                                {locked ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                {locked ? '提交中…' : `立即下载${counting ? ` (${secondsLeft}s)` : ''}`}
                            </button>
                        )}
                    </div>
                </>
            }
        >
            {/* 下载相关信息 */}
            <div className="rounded-xl border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-color)_55%,transparent)] px-3 py-2">
                <InfoRow label="片名" value={plan.title} />
                <InfoRow label="类型" value={`${plan.presetLabel} · ${plan.isMovie ? '电影（直接保存）' : '多集（按剧名分目录）'}`} />
                <InfoRow label="集信息" value={plan.episodeLabel || '（无集名，使用片名）'} />
                <InfoRow label="下载器" value={settings.baseUrl} mono />
                <InfoRow label="视频地址" value={plan.url} mono />
            </div>

            {/* 本次可临时修改的常用项 */}
            <div className="mt-4 space-y-3">
                <Field
                    label="保存位置（预设）"
                    hint="电影直接存入该目录；电视剧/综艺会自动再建一层剧名目录"
                >
                    <select
                        className={INPUT_CLASS}
                        value={plan.presetId}
                        onChange={(event) => onPatch({ presetId: event.target.value }, 'presetId')}
                        disabled={locked}
                    >
                        {settings.presets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                                {preset.label} — {preset.path}
                            </option>
                        ))}
                        {!settings.presets.some((preset) => preset.id === plan.presetId) && (
                            <option value={plan.presetId}>{plan.presetLabel}（自动分类）</option>
                        )}
                    </select>
                </Field>

                <Field label="保存目录">
                    <div className="relative">
                        <FolderOpen size={15} className="pointer-events-none absolute left-3 top-2.5 text-[var(--text-color-secondary)]" />
                        <input
                            className={`${INPUT_CLASS} pl-9 font-mono text-xs`}
                            value={plan.saveDir}
                            onChange={(event) => onPatch({ saveDir: event.target.value }, 'saveDir')}
                            spellCheck={false}
                            disabled={locked}
                        />
                    </div>
                </Field>

                <Field label="文件名">
                    <div className="flex items-center gap-2">
                        <input
                            className={INPUT_CLASS}
                            value={plan.filename}
                            onChange={(event) => onPatch({ filename: event.target.value }, 'filename')}
                            spellCheck={false}
                            disabled={locked}
                        />
                        <span className="shrink-0 text-xs text-[var(--text-color-secondary)]">.mp4</span>
                    </div>
                </Field>

                <div className="rounded-lg border border-dashed border-[var(--glass-border)] px-3 py-2">
                    <div className="mb-1 text-[11px] text-[var(--text-color-secondary)]">最终保存为</div>
                    <div className="break-all font-mono text-xs text-[var(--text-color)]" title={plan.fullPath}>
                        {plan.fullPath}
                    </div>
                </div>

                <Toggle
                    checked={openPageForThisDownload}
                    onChange={onOpenPageChange}
                    label="下载开始后打开下载页"
                    hint="仅对本次下载生效；长期默认值在「设置」里修改"
                />
            </div>

            {/* 倒计时 / 提交结果 */}
            <div className="mt-4 rounded-xl border border-[var(--glass-border)] px-3 py-2.5">
                {status === 'submitting' && (
                    <div className="flex items-center gap-2 text-sm text-[var(--text-color)]">
                        <Loader2 size={16} className="animate-spin text-[var(--accent-color)]" />
                        正在提交到下载器…
                    </div>
                )}

                {status === 'success' && (
                    <div className="space-y-1.5 text-sm">
                        <div className="flex items-center gap-2 text-[var(--text-color)]">
                            <CheckCircle2 size={16} className="text-green-500" />
                            {result?.message || '已提交到下载器'}
                        </div>
                        {popupBlocked && (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 text-xs text-[var(--accent-color)] underline"
                                onClick={onOpenDownloadPage}
                            >
                                <ExternalLink size={13} /> 浏览器拦截了新窗口，点此打开下载页
                            </button>
                        )}
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex items-start gap-2 text-sm text-[var(--text-color)]">
                        <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                        <span className="break-all">{result?.message || '提交失败，请检查设置'}</span>
                    </div>
                )}

                {status === 'idle' && counting && (
                    <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--text-color-secondary)]">
                            <span className="inline-flex items-center gap-1.5">
                                <Clock size={13} /> {secondsLeft} 秒后按当前设置自动下载
                            </span>
                            <span>修改任意项或打开设置会暂停自动提交</span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text-color-secondary)_20%,transparent)]">
                            <div
                                className="h-full rounded-full bg-[var(--accent-color)] transition-[width] duration-100 ease-linear"
                                style={{ width: `${progress * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {status === 'idle' && !counting && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-color-secondary)]">
                        <Clock size={13} />
                        {totalMs > 0
                            ? '自动下载已暂停，请点击「立即下载」确认'
                            : '自动下载已关闭，请点击「立即下载」确认'}
                    </div>
                )}
            </div>
        </DialogShell>
    );
}
