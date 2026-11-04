import { useCallback, useMemo } from 'react';

interface UseUtilitiesProps {
    src: string;
    setToastMessage: (message: string | null) => void;
    setShowToast: (show: boolean) => void;
    toastTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

export function useUtilities({
    src,
    setToastMessage,
    setShowToast,
    toastTimeoutRef
}: UseUtilitiesProps) {
    const showToastNotification = useCallback((message: string) => {
        setToastMessage(message);
        setShowToast(true);

        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }

        toastTimeoutRef.current = setTimeout(() => {
            setShowToast(false);
            setTimeout(() => setToastMessage(null), 300);
        }, 3000);
    }, [setToastMessage, setShowToast, toastTimeoutRef]);

    const handleCopyLink = useCallback(async (url?: string) => {
        try {
            await navigator.clipboard.writeText(url || src);
            showToastNotification('链接已复制到剪贴板');
        } catch (error) {
            console.error('Copy failed:', error);
            showToastNotification('复制失败，请重试');
        }
    }, [src, showToastNotification]);

    const DOWNLOAD_SERVICE_URL = 'http://192.168.3.13:6600';

    const handleDownloadVideo = useCallback(async (url?: string, filename?: string) => {
        const videoUrl = url || src;
        if (!videoUrl) {
            showToastNotification('没有可下载的视频链接');
            return;
        }
        try {
            const resp = await fetch(`${DOWNLOAD_SERVICE_URL}/api/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    list: [{ url: videoUrl, ...(filename ? { filename } : {}) }]
                })
            });
            const data = await resp.json();
            if (data && data.code === 0) {
                showToastNotification('已提交到下载器，可打开下载器查看进度');
            } else {
                showToastNotification((data && data.message) || '提交下载失败');
            }
        } catch (error) {
            console.error('Download submit failed:', error);
            showToastNotification('提交下载失败，请检查下载器服务');
        }
    }, [src, showToastNotification]);

    const utilityActions = useMemo(() => ({
        showToastNotification,
        handleCopyLink,
        handleDownloadVideo
    }), [showToastNotification, handleCopyLink, handleDownloadVideo]);

    return utilityActions;
}
