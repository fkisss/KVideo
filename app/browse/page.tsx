'use client';

/**
 * Browse Page (/browse)
 * Lets the user browse each configured video source (接口) separately:
 *  - pick a source
 *  - pick one of that source's categories (片单)
 *  - see the source's video list (片源)
 *  - click a poster to play directly (reuses the existing /player flow)
 *
 * This is an additive feature. It reuses existing infrastructure (settingsStore, the player
 * route and CMS API conventions) without modifying any existing code paths.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icon';
import { settingsStore } from '@/lib/store/settings-store';
import type { VideoSource } from '@/lib/types';

interface Category {
  type_id: number | string;
  type_name: string;
}

interface BrowseVideo {
  vod_id: number | string;
  vod_name: string;
  vod_pic?: string;
  vod_remarks?: string;
  type_name?: string;
  vod_year?: string;
  source: string;
}

const LATEST_TYPE = '';

function PosterImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-[2/3] bg-[color-mix(in_srgb,var(--glass-bg)_50%,transparent)] rounded-[var(--radius-2xl)] overflow-hidden">
      {src && !failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover rounded-[var(--radius-2xl)] transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
          loading="lazy"
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
          <Icons.Film size={48} className="text-[var(--text-color-secondary)] opacity-40" />
          <span className="text-xs text-[var(--text-color-secondary)] opacity-60 text-center line-clamp-2">{alt}</span>
        </div>
      )}
      {/* Play overlay on hover */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
          <Icons.Play size={22} className="text-black translate-x-[1px]" />
        </div>
      </div>
    </div>
  );
}

export default function BrowsePage() {
  const [sources, setSources] = useState<VideoSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>(LATEST_TYPE);
  const [videos, setVideos] = useState<BrowseVideo[]>([]);
  const [page, setPage] = useState(1);
  const [pagecount, setPagecount] = useState(1);
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState('');

  // Load sources from settings on mount and keep in sync.
  useEffect(() => {
    const load = () => {
      const enabled = settingsStore
        .getSettings()
        .sources.filter((s) => s.enabled !== false && s.baseUrl);
      setSources(enabled);
      setSelectedSourceId((prev) => prev || (enabled[0]?.id ?? ''));
    };
    load();
    const unsub = settingsStore.subscribe(load);
    return () => unsub();
  }, []);

  const selectedSource = useMemo(
    () => sources.find((s) => s.id === selectedSourceId),
    [sources, selectedSourceId]
  );

  // Fetch categories whenever the selected source changes.
  useEffect(() => {
    if (!selectedSource) {
      setCategories([]);
      return;
    }
    let aborted = false;
    setLoadingCats(true);
    setCategories([]);
    fetch('/api/browse/types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: selectedSource }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!aborted) setCategories(Array.isArray(d.categories) ? d.categories : []);
      })
      .catch(() => {
        if (!aborted) setCategories([]);
      })
      .finally(() => {
        if (!aborted) setLoadingCats(false);
      });
    return () => {
      aborted = true;
    };
  }, [selectedSource]);

  const fetchList = useCallback(
    async (source: VideoSource, typeId: string, pg: number, append: boolean) => {
      setLoadingList(true);
      setError('');
      try {
        const res = await fetch('/api/browse/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source, typeId, page: pg }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || '加载失败');
        const incoming: BrowseVideo[] = Array.isArray(d.videos) ? d.videos : [];
        setVideos((prev) => (append ? [...prev, ...incoming] : incoming));
        setPage(typeof d.page === 'number' ? d.page : pg);
        setPagecount(typeof d.pagecount === 'number' ? d.pagecount : 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
        if (!append) setVideos([]);
      } finally {
        setLoadingList(false);
      }
    },
    []
  );

  // Fetch the video list whenever source or category changes (fresh page 1).
  useEffect(() => {
    if (!selectedSource) return;
    fetchList(selectedSource, selectedTypeId, 1, false);
  }, [selectedSource, selectedTypeId, fetchList]);

  const handleSelectSource = (id: string) => {
    if (id === selectedSourceId) return;
    setSelectedSourceId(id);
    setSelectedTypeId(LATEST_TYPE);
  };

  const handleLoadMore = () => {
    if (selectedSource && page < pagecount && !loadingList) {
      fetchList(selectedSource, selectedTypeId, page + 1, true);
    }
  };

  const buildPlayerUrl = (v: BrowseVideo) =>
    `/player?id=${encodeURIComponent(String(v.vod_id))}&source=${encodeURIComponent(v.source)}&title=${encodeURIComponent(v.vod_name)}`;

  const hasSources = sources.length > 0;

  return (
    <div className="min-h-screen bg-[var(--bg-color)]">
      <Navbar onReset={() => {}} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 mt-6">
        <div className="flex items-center gap-2 mb-6">
          <Icons.Layers size={22} className="text-[var(--accent-color)]" />
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-color)]">分类浏览</h2>
          <span className="text-sm text-[var(--text-color-secondary)]">按接口浏览片单与片源，点击直接播放</span>
        </div>

        {!hasSources ? (
          <Card className="text-center py-16">
            <Icons.Film size={48} className="mx-auto text-[var(--text-color-secondary)] opacity-40 mb-4" />
            <p className="text-[var(--text-color)] font-medium mb-2">还没有可用的视频源</p>
            <p className="text-sm text-[var(--text-color-secondary)] mb-6">
              请先在设置中添加或导入视频源接口
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-full)] bg-[var(--accent-color)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              前往设置
            </Link>
          </Card>
        ) : (
          <>
            {/* Source selector */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-[var(--text-color-secondary)] mb-2 uppercase tracking-wide">接口 / 视频源</div>
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSource(s.id)}
                    data-focusable
                    className={`px-3.5 py-1.5 rounded-[var(--radius-full)] text-sm border transition-all duration-200 cursor-pointer ${
                      s.id === selectedSourceId
                        ? 'bg-[var(--accent-color)] text-white border-transparent'
                        : 'bg-[var(--glass-bg)] text-[var(--text-color)] border-[var(--glass-border)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Category selector */}
            <div className="mb-6">
              <div className="text-xs font-semibold text-[var(--text-color-secondary)] mb-2 uppercase tracking-wide">片单 / 分类</div>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => setSelectedTypeId(LATEST_TYPE)}
                  data-focusable
                  className={`px-3 py-1.5 rounded-[var(--radius-full)] text-sm border transition-all duration-200 cursor-pointer ${
                    selectedTypeId === LATEST_TYPE
                      ? 'bg-[var(--accent-color)] text-white border-transparent'
                      : 'bg-[var(--glass-bg)] text-[var(--text-color)] border-[var(--glass-border)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
                  }`}
                >
                  最新
                </button>
                {loadingCats ? (
                  <span className="text-sm text-[var(--text-color-secondary)]">加载分类中...</span>
                ) : (
                  categories.map((cat) => {
                    const value = String(cat.type_id);
                    return (
                      <button
                        key={value}
                        onClick={() => setSelectedTypeId(value)}
                        data-focusable
                        className={`px-3 py-1.5 rounded-[var(--radius-full)] text-sm border transition-all duration-200 cursor-pointer ${
                          selectedTypeId === value
                            ? 'bg-[var(--accent-color)] text-white border-transparent'
                            : 'bg-[var(--glass-bg)] text-[var(--text-color)] border-[var(--glass-border)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
                        }`}
                      >
                        {cat.type_name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Video grid */}
            {error && videos.length === 0 ? (
              <Card className="text-center py-16">
                <p className="text-[var(--text-color)] font-medium mb-2">加载失败</p>
                <p className="text-sm text-[var(--text-color-secondary)] mb-6">{error}</p>
                <button
                  onClick={() => selectedSource && fetchList(selectedSource, selectedTypeId, 1, false)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-full)] bg-[var(--accent-color)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
                >
                  重试
                </button>
              </Card>
            ) : loadingList && videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--accent-color)] border-t-transparent mb-4" />
                <p className="text-[var(--text-color-secondary)]">正在加载片源...</p>
              </div>
            ) : videos.length === 0 ? (
              <Card className="text-center py-16">
                <Icons.Film size={48} className="mx-auto text-[var(--text-color-secondary)] opacity-40 mb-4" />
                <p className="text-[var(--text-color-secondary)]">该分类暂无内容</p>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
                  {videos.map((v, idx) => (
                    <Link
                      key={`${v.source}-${v.vod_id}-${idx}`}
                      href={buildPlayerUrl(v)}
                      prefetch={false}
                      data-focusable
                      className="group cursor-pointer hover:translate-y-[-2px] transition-transform duration-200 ease-out block"
                    >
                      <Card
                        hover={false}
                        blur={false}
                        className="p-0 h-full shadow-sm border-[var(--glass-border)] hover:shadow-lg transition-shadow"
                      >
                        <PosterImage src={v.vod_pic} alt={v.vod_name} />
                        <div className="p-2.5">
                          <h4 className="font-semibold text-sm text-[var(--text-color)] line-clamp-2 min-h-[2.5rem] group-hover:text-[var(--accent-color)] transition-colors">
                            {v.vod_name}
                          </h4>
                          {v.vod_remarks && (
                            <p className="text-xs text-[var(--text-color-secondary)] mt-1 truncate">{v.vod_remarks}</p>
                          )}
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Load more */}
                <div className="flex justify-center mt-8">
                  {page < pagecount ? (
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingList}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] text-sm font-medium hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingList ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--accent-color)] border-t-transparent" />
                          加载中...
                        </>
                      ) : (
                        <>
                          加载更多
                          <Icons.ChevronDown size={16} />
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="text-sm text-[var(--text-color-secondary)]">已到底部</span>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
