'use client';

/**
 * 播放器与下载弹窗之间的轻量事件总线。
 *
 * 11/4 的实现把 onDownloadVideo / downloadFilename 从 DesktopVideoPlayer
 * 逐层透传到 DesktopOverlayWrapper -> DesktopOverlay -> DesktopMoreMenu，
 * 改动了 6 个上游文件。这里改为「播放器注册上下文 + 菜单触发打开」，
 * 上游只需两个插件式挂点，不需要任何 props 透传。
 */

import type { PlayerDownloadContext } from './types';

let downloadContext: PlayerDownloadContext | null = null;
let dialogVisible = false;
const dialogListeners = new Set<() => void>();

export function setDownloadContext(context: PlayerDownloadContext | null): void {
    downloadContext = context;
}

export function getDownloadContext(): PlayerDownloadContext | null {
    return downloadContext;
}

export function isDownloadDialogVisible(): boolean {
    return dialogVisible;
}

export function openDownloadDialog(): void {
    dialogVisible = true;
    for (const listener of dialogListeners) listener();
}

export function closeDownloadDialog(): void {
    dialogVisible = false;
    for (const listener of dialogListeners) listener();
}

export function subscribeDownloadDialog(listener: () => void): () => void {
    dialogListeners.add(listener);
    return () => { dialogListeners.delete(listener); };
}
