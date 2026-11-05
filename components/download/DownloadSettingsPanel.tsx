'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, Plus, RotateCcw, Settings2, Trash2 } from 'lucide-react';
import type { ActionResult, DownloadSettings, PathPreset } from '@/lib/download/types';
import { DialogShell, Field, INPUT_CLASS, PRIMARY_BTN, SECONDARY_BTN, Toggle } from './ui';

export interface DownloadSettingsPanelProps {
    settings: DownloadSettings;
    onSave: (settings: DownloadSettings) => void;
    onBack: () => void;
    onReset: () => DownloadSettings;
    onTest: (settings: DownloadSettings) => Promise<ActionResult>;
}

function cloneSettings(settings: DownloadSettings): DownloadSettings {
    return { ...settings, presets: settings.presets.map((preset) => ({ ...preset })) };
}

/** 下载器的长期设置：地址 / token / 预设路径 / 自动确认 / 跳转行为 */
export function DownloadSettingsPanel({ settings, onSave, onBack, onReset, onTest }: DownloadSettingsPanelProps) {
    const [draft, setDraft] = useState<DownloadSettings>(() => cloneSettings(settings));
    const [showToken, setShowToken] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<ActionResult | null>(null);
    const [error, setError] = useState('');

    const patch = (next: Partial<DownloadSettings>) => {
        setDraft((prev) => ({ ...prev, ...next }));
        setTestResult(null);
        setError('');
    };

    const updatePreset = (id: string, next: Partial<PathPreset>) => {
        patch({
            presets: draft.presets.map((preset) => (preset.id === id ? { ...preset, ...next } : preset)),
        });
    };

    const addPreset = () => {
        const id = `preset-${Date.now().toString(36)}`;
        patch({
            presets: [
                ...draft.presets,
                { id, label: '新预设', path: '/mnt/nas-video/', flat: false },
            ],
        });
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            setTestResult(await onTest(draft));
        } finally {
            setTesting(false);
        }
    };

    const handleSave = () => {
        let baseUrl = draft.baseUrl.trim().replace(/\/+$/, '');
        try {
            const url = new URL(baseUrl);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol');
            baseUrl = url.toString().replace(/\/+$/, '');
        } catch {
            setError('下载器地址不合法，请填写完整的 http:// 或 https:// 地址');
            return;
        }

        const presets = draft.presets
            .filter((preset) => preset.label.trim() && preset.path.trim())
            .map((preset) => ({ ...preset, label: preset.label.trim(), path: preset.path.trim() }));
        if (!presets.length) {
            setError('至少需要保留一个保存路径预设');
            return;
        }

        const defaultPresetId = presets.some((preset) => preset.id === draft.defaultPresetId)
            ? draft.defaultPresetId
            : presets[0].id;

        onSave({
            ...draft,
            baseUrl,
            presets,
            defaultPresetId,
            token: draft.token.trim(),
            defaultSaveDir: draft.defaultSaveDir.trim() || '/mnt/nas-video/',
            autoConfirmSeconds: Math.min(30, Math.max(0, Math.round(draft.autoConfirmSeconds || 0))),
        });
    };

    return (
        <DialogShell
            title="下载器设置"
            subtitle="设置保存在本机浏览器，不会写回代码，也不影响上游设置"
            icon={<Settings2 size={20} />}
            onClose={onBack}
            width="max-w-2xl"
            footer={
                <>
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-sm text-[var(--text-color-secondary)] transition-colors hover:text-[var(--text-color)]"
                        onClick={() => {
                            setDraft(cloneSettings(onReset()));
                            setError('');
                            setTestResult(null);
                        }}
                    >
                        <RotateCcw size={15} /> 恢复默认
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className={SECONDARY_BTN} onClick={onBack}>返回</button>
                        <button type="button" className={SECONDARY_BTN} onClick={handleTest} disabled={testing}>
                            {testing ? <Loader2 size={15} className="animate-spin" /> : null}
                            测试连接
                        </button>
                        <button type="button" className={PRIMARY_BTN} onClick={handleSave}>保存设置</button>
                    </div>
                </>
            }
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="M3U8 下载器地址" hint="m3u8-dl WebUI 的根地址，例如 http://192.168.3.13:6600" className="sm:col-span-2">
                    <input
                        className={`${INPUT_CLASS} font-mono text-xs`}
                        value={draft.baseUrl}
                        onChange={(event) => patch({ baseUrl: event.target.value })}
                        placeholder="http://192.168.3.13:6600"
                        spellCheck={false}
                    />
                </Field>

                <Field label="API Token" hint="下载器访问密码的 MD5 前 8 位；留空则使用服务端环境变量" className="sm:col-span-2">
                    <div className="relative">
                        <input
                            className={`${INPUT_CLASS} pr-10 font-mono text-xs`}
                            type={showToken ? 'text' : 'password'}
                            value={draft.token}
                            onChange={(event) => patch({ token: event.target.value })}
                            placeholder="留空使用服务端配置"
                            spellCheck={false}
                            autoComplete="off"
                        />
                        <button
                            type="button"
                            onClick={() => setShowToken((value) => !value)}
                            aria-label={showToken ? '隐藏 token' : '显示 token'}
                            className="absolute right-2 top-1.5 rounded-full p-1 text-[var(--text-color-secondary)] hover:text-[var(--text-color)]"
                        >
                            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </Field>

                <Field label="默认保存路径" hint="自动分类找不到对应预设时使用">
                    <input
                        className={`${INPUT_CLASS} font-mono text-xs`}
                        value={draft.defaultSaveDir}
                        onChange={(event) => patch({ defaultSaveDir: event.target.value })}
                        spellCheck={false}
                    />
                </Field>

                <Field label="默认预设" hint="自动分类失败时选用">
                    <select
                        className={INPUT_CLASS}
                        value={draft.defaultPresetId}
                        onChange={(event) => patch({ defaultPresetId: event.target.value })}
                    >
                        {draft.presets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                                {preset.label || preset.id}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field label="自动确认超时（秒）" hint="0 表示关闭自动下载，必须手动确认；最大 30 秒">
                    <input
                        type="number"
                        min={0}
                        max={30}
                        step={1}
                        className={INPUT_CLASS}
                        value={draft.autoConfirmSeconds}
                        onChange={(event) => patch({ autoConfirmSeconds: Number(event.target.value) || 0 })}
                    />
                </Field>

                <div className="flex items-end pb-1">
                    <Toggle
                        checked={draft.openDownloadPage}
                        onChange={(value) => patch({ openDownloadPage: value })}
                        label="下载后打开下载页"
                        hint="弹窗中可临时覆盖"
                    />
                </div>
            </div>

            {/* 预设路径列表 */}
            <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-medium text-[var(--text-color-secondary)]">保存路径预设</div>
                    <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-[var(--accent-color)] hover:underline"
                        onClick={addPreset}
                    >
                        <Plus size={14} /> 添加预设
                    </button>
                </div>

                <div className="space-y-2">
                    {draft.presets.map((preset) => (
                        <div
                            key={preset.id}
                            className="rounded-xl border border-[var(--glass-border)] px-3 py-2.5"
                        >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <input
                                    className="w-full rounded-lg border border-[var(--glass-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text-color)] outline-none focus:border-[var(--accent-color)] sm:w-28"
                                    value={preset.label}
                                    onChange={(event) => updatePreset(preset.id, { label: event.target.value })}
                                    aria-label="预设名称"
                                />
                                <input
                                    className="min-w-0 flex-1 rounded-lg border border-[var(--glass-border)] bg-transparent px-2 py-1.5 font-mono text-xs text-[var(--text-color)] outline-none focus:border-[var(--accent-color)]"
                                    value={preset.path}
                                    onChange={(event) => updatePreset(preset.id, { path: event.target.value })}
                                    aria-label="预设路径"
                                    spellCheck={false}
                                />
                                <button
                                    type="button"
                                    onClick={() => patch({ presets: draft.presets.filter((item) => item.id !== preset.id) })}
                                    aria-label="删除预设"
                                    className="shrink-0 rounded-full p-1.5 text-[var(--text-color-secondary)] hover:bg-red-500/10 hover:text-red-500"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-[11px] text-[var(--text-color-secondary)]">
                                <input
                                    type="checkbox"
                                    checked={preset.flat === true}
                                    onChange={(event) => updatePreset(preset.id, { flat: event.target.checked })}
                                    className="accent-[var(--accent-color)]"
                                />
                                直接保存到该目录，不建剧名子目录（电影用）
                            </label>
                        </div>
                    ))}
                </div>
                <p className="mt-2 text-[11px] leading-4 text-[var(--text-color-secondary)]">
                    内置 id 为 movie / tv / variety 的预设会自动匹配 /api/detail 返回的分类；
                    自定义预设可在下载弹窗中手动选择。
                </p>
            </div>

            {testResult && (
                <div className={`mt-4 rounded-lg px-3 py-2 text-xs ${testResult.ok ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                    {testResult.ok ? '连接成功：' : '连接失败：'}{testResult.message}
                </div>
            )}
            {error && (
                <div className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</div>
            )}
        </DialogShell>
    );
}
