'use client';

import React from 'react';
import { X } from 'lucide-react';

/** 下载模块共用的轻量 UI 原语，跟随项目主题 CSS 变量自动适配明暗 */
export const INPUT_CLASS = [
    'w-full rounded-lg border border-[var(--glass-border)] px-3 py-2 text-sm',
    'bg-[color-mix(in_srgb,var(--bg-color)_70%,transparent)] text-[var(--text-color)]',
    'outline-none transition-colors placeholder:text-[var(--text-color-secondary)]',
    'focus:border-[var(--accent-color)]',
].join(' ');

export const PRIMARY_BTN = [
    'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium',
    'bg-[var(--accent-color)] text-white transition-opacity hover:opacity-90',
    'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

export const SECONDARY_BTN = [
    'inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--glass-border)]',
    'px-4 py-2 text-sm text-[var(--text-color)] transition-colors',
    'hover:bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

export function Field({
    label,
    hint,
    children,
    className = '',
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={className}>
            <div className="mb-1 text-xs font-medium text-[var(--text-color-secondary)]">{label}</div>
            {children}
            {hint && (
                <div className="mt-1 text-[11px] leading-4 text-[var(--text-color-secondary)]">{hint}</div>
            )}
        </div>
    );
}

export function Toggle({
    checked,
    onChange,
    label,
    hint,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
    hint?: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-left"
        >
            <span>
                <span className="block text-sm text-[var(--text-color)]">{label}</span>
                {hint && <span className="block text-[11px] text-[var(--text-color-secondary)]">{hint}</span>}
            </span>
            <span
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-[var(--accent-color)]' : 'bg-[color-mix(in_srgb,var(--text-color-secondary)_35%,transparent)]'}`}
            >
                <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
                />
            </span>
        </button>
    );
}

export function DialogShell({
    title,
    subtitle,
    icon,
    onClose,
    children,
    footer,
    width = 'max-w-lg',
}: {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: string;
}) {
    return (
        <div
            className="fixed inset-0 z-[2147483647] flex items-center justify-center p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onKeyDown={(event) => event.stopPropagation()}
        >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div
                className={`relative flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-2xl`}
            >
                <header className="flex items-start justify-between gap-3 border-b border-[var(--glass-border)] px-5 py-4">
                    <div className="flex items-center gap-2.5">
                        {icon && <span className="text-[var(--accent-color)]">{icon}</span>}
                        <div>
                            <h2 className="text-base font-semibold leading-5 text-[var(--text-color)]">{title}</h2>
                            {subtitle && (
                                <p className="mt-0.5 text-xs text-[var(--text-color-secondary)]">{subtitle}</p>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="关闭"
                        className="rounded-full p-1.5 text-[var(--text-color-secondary)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] hover:text-[var(--text-color)]"
                    >
                        <X size={18} />
                    </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

                {footer && (
                    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--glass-border)] px-5 py-3">
                        {footer}
                    </footer>
                )}
            </div>
        </div>
    );
}

export function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-start gap-3 py-1 text-xs">
            <span className="w-16 shrink-0 text-[var(--text-color-secondary)]">{label}</span>
            <span
                className={`min-w-0 flex-1 break-all text-[var(--text-color)] ${mono ? 'font-mono text-[11px]' : ''}`}
                title={value}
            >
                {value || '—'}
            </span>
        </div>
    );
}
