'use client';

import React from 'react';
import { Icons } from '@/components/ui/Icon';
import { usePlayerSettings } from '../hooks/usePlayerSettings';

import { createPortal } from 'react-dom';

interface DesktopMoreMenuProps {
    showMoreMenu: boolean;
    isProxied?: boolean;
    onToggleMoreMenu: () => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onCopyLink: (type?: 'original' | 'proxy') => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export function DesktopMoreMenu({
    showMoreMenu,
    isProxied = false,
    onToggleMoreMenu,
    onMouseEnter,
    onMouseLeave,
    onCopyLink,
    containerRef
}: DesktopMoreMenuProps) {
    const {
        autoNextEpisode,
        autoSkipIntro,
        skipIntroSeconds,
        autoSkipOutro,
        skipOutroSeconds,
        showModeIndicator,
        setAutoNextEpisode,
        setAutoSkipIntro,
        setSkipIntroSeconds,
        setAutoSkipOutro,
        setSkipOutroSeconds,
        setShowModeIndicator,
    } = usePlayerSettings();

    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const [menuPosition, setMenuPosition] = React.useState({ top: 0, left: 0 });

    React.useEffect(() => {
        if (showMoreMenu && buttonRef.current && containerRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();

            setMenuPosition({
                top: buttonRect.bottom - containerRect.top + 10,
                left: buttonRect.left - containerRect.left
            });
        }
    }, [showMoreMenu, containerRef]);

    const handleToggle = () => {
        if (!showMoreMenu && buttonRef.current && containerRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();

            setMenuPosition({
                top: buttonRect.bottom - containerRect.top + 10,
                left: buttonRect.left - containerRect.left
            });
        }
        onToggleMoreMenu();
    };

    const MenuContent = (
        <div
            className="absolute z-[9999] bg-[var(--glass-bg)] backdrop-blur-[25px] saturate-[180%] rounded-[var(--radius-2xl)] border border-[var(--glass-border)] shadow-[var(--shadow-md)] p-2 w-fit min-w-[220px] animate-in fade-in zoom-in-95 duration-200"
            style={{
                top: menuPosition.top,
                left: menuPosition.left,
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Copy Link Options */}
            {isProxied ? (
                <>
                    <button
                        onClick={() => onCopyLink('original')}
                        className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_15%,transparent)] rounded-[var(--radius-2xl)] transition-colors flex items-center gap-3 cursor-pointer"
                    >
                        <Icons.Link size={18} />
                        <span>复制原链接</span>
                    </button>
                    <button
                        onClick={() => onCopyLink('proxy')}
                        className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_15%,transparent)] rounded-[var(--radius-2xl)] transition-colors flex items-center gap-3 mt-1 cursor-pointer"
                    >
                        <Icons.Link size={18} />
                        <span>复制代理链接</span>
                    </button>
                </>
            ) : (
                <button
                    onClick={() => onCopyLink('original')}
                    className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_15%,transparent)] rounded-[var(--radius-2xl)] transition-colors flex items-center gap-3 cursor-pointer"
                >
                    <Icons.Link size={18} />
                    <span>复制链接</span>
                </button>
            )}

            {/* Divider */}
            <div className="h-px bg-[var(--glass-border)] my-2" />

            {/* Show Mode Indicator Switch */}
            <div className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm text-[var(--text-color)]">
                    <Icons.Zap size={18} />
                    <span>显示模式指示器</span>
                </div>
                <button
                    onClick={() => setShowModeIndicator(!showModeIndicator)}
                    className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${showModeIndicator ? 'bg-[var(--accent-color)]' : 'bg-[color-mix(in_srgb,var(--text-color)_20%,transparent)]'
                        }`}
                    aria-checked={showModeIndicator}
                    role="switch"
                >
                    <span
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${showModeIndicator ? 'translate-x-4' : 'translate-x-0'
                            }`}
                    />
                </button>
            </div>

            {/* Auto Next Episode Switch */}
            <div className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm text-[var(--text-color)]">
                    <Icons.SkipForward size={18} />
                    <span>自动下一集</span>
                </div>
                <button
                    onClick={() => setAutoNextEpisode(!autoNextEpisode)}
                    className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${autoNextEpisode ? 'bg-[var(--accent-color)]' : 'bg-[color-mix(in_srgb,var(--text-color)_20%,transparent)]'
                        }`}
                    aria-checked={autoNextEpisode}
                    role="switch"
                >
                    <span
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${autoNextEpisode ? 'translate-x-4' : 'translate-x-0'
                            }`}
                    />
                </button>
            </div>

            {/* Skip Intro Switch */}
            <div className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-[var(--text-color)]">
                        <Icons.FastForward size={18} />
                        <span>跳过片头</span>
                    </div>
                    <button
                        onClick={() => setAutoSkipIntro(!autoSkipIntro)}
                        className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${autoSkipIntro ? 'bg-[var(--accent-color)]' : 'bg-[color-mix(in_srgb,var(--text-color)_20%,transparent)]'
                            }`}
                        aria-checked={autoSkipIntro}
                        role="switch"
                    >
                        <span
                            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${autoSkipIntro ? 'translate-x-4' : 'translate-x-0'
                                }`}
                        />
                    </button>
                </div>
                {/* Expandable Input */}
                {autoSkipIntro && (
                    <div className="mt-2 ml-7 flex items-center gap-2">
                        <span className="text-xs text-[var(--text-color-secondary)]">时长:</span>
                        <input
                            type="number"
                            min="0"
                            max="600"
                            value={skipIntroSeconds}
                            onChange={(e) => setSkipIntroSeconds(parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-sm text-center bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-[var(--text-color)] focus:outline-none focus:border-[var(--accent-color)] no-spinner"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-xs text-[var(--text-color-secondary)]">秒</span>
                    </div>
                )}
            </div>

            {/* Skip Outro Switch */}
            <div className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-[var(--text-color)]">
                        <Icons.Rewind size={18} />
                        <span>跳过片尾</span>
                    </div>
                    <button
                        onClick={() => setAutoSkipOutro(!autoSkipOutro)}
                        className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${autoSkipOutro ? 'bg-[var(--accent-color)]' : 'bg-[color-mix(in_srgb,var(--text-color)_20%,transparent)]'
                            }`}
                        aria-checked={autoSkipOutro}
                        role="switch"
                    >
                        <span
                            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${autoSkipOutro ? 'translate-x-4' : 'translate-x-0'
                                }`}
                        />
                    </button>
                </div>
                {/* Expandable Input */}
                {autoSkipOutro && (
                    <div className="mt-2 ml-7 flex items-center gap-2">
                        <span className="text-xs text-[var(--text-color-secondary)]">剩余:</span>
                        <input
                            type="number"
                            min="0"
                            max="600"
                            value={skipOutroSeconds}
                            onChange={(e) => setSkipOutroSeconds(parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-sm text-center bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-[var(--text-color)] focus:outline-none focus:border-[var(--accent-color)] no-spinner"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-xs text-[var(--text-color-secondary)]">秒</span>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={handleToggle}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                className="group flex items-center justify-center w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-all duration-300 hover:scale-110 active:scale-95"
                aria-label="更多选项"
                title="更多选项"
            >
                <Icons.MoreHorizontal className="text-white/80 group-hover:text-white" size={24} />
            </button>

            {/* More Menu Dropdown (Portal) */}
            {showMoreMenu && typeof document !== 'undefined' && createPortal(MenuContent, containerRef.current || document.body)}
        </div>
    );
}
