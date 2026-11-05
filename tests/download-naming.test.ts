import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildDownloadPlan,
    buildFileName,
    detectCategory,
    joinDir,
    normalizeDir,
    resolveOriginalUrl,
    sanitizeName,
    validatePlan,
} from '@/lib/download/naming';
import { DEFAULT_DOWNLOAD_SETTINGS } from '@/lib/download/defaults';
import { normalizeDownloadSettings } from '@/lib/download/settings-store';
import type { PlayerDownloadContext, VideoMeta } from '@/lib/download/types';

const movieContext: PlayerDownloadContext = {
    src: 'https://c1.ddbbffcdn.com/video/tangbohudianqiuxiang2019/HD国语/index.m3u8',
    title: '唐伯虎点秋香2019',
    episodeName: 'HD国语',
    episodeIndex: 0,
    totalEpisodes: 1,
};

const varietyContext: PlayerDownloadContext = {
    src: 'https://v.lzcdn28.com/20261102/17744_0bff8b66/index.m3u8',
    title: '你好，星期六',
    episodeName: '20261102特别企划',
    episodeIndex: 554,
    totalEpisodes: 555,
};

const movieMeta: VideoMeta = {
    title: '唐伯虎点秋香2019',
    typeName: '喜剧片',
    episodeCount: 1,
    episodeName: 'HD国语',
};

const varietyMeta: VideoMeta = {
    title: '你好，星期六',
    typeName: '大陆综艺',
    episodeCount: 555,
    episodeName: '20261102特别企划',
};

test('sanitizeName removes Chinese punctuation without inserting spaces', () => {
    assert.equal(sanitizeName('你好，星期六'), '你好星期六');
    assert.equal(sanitizeName('唐伯虎点秋香2019'), '唐伯虎点秋香2019');
    // 中文标点按需求直接删除，不插入空格或连字符
    assert.equal(sanitizeName('  《-test：name》  '), 'testname');
    assert.equal(sanitizeName('a\\b/c:d*e?f"g<h>i|j'), 'abcdefghij');
    assert.equal(sanitizeName('   '), '未命名视频');
});

test('normalizeDir / joinDir keep POSIX paths and append cleaned folder name', () => {
    assert.equal(normalizeDir('/mnt/nas-video/综艺/'), '/mnt/nas-video/综艺');
    assert.equal(normalizeDir('C:\\video\\电影\\'), 'C:/video/电影');
    assert.equal(joinDir('/mnt/nas-video/综艺/', '你好，星期六'), '/mnt/nas-video/综艺/你好星期六');
});

test('resolveOriginalUrl strips the player proxy prefix', () => {
    const original = 'https://example.com/a.m3u8';
    assert.equal(
        resolveOriginalUrl(`/api/proxy?url=${encodeURIComponent(original)}&retry=0`),
        original,
    );
    assert.equal(resolveOriginalUrl(original), original);
    assert.equal(resolveOriginalUrl(''), '');
});

test('detectCategory distinguishes 喜剧片 / 大陆综艺 / 剧集 and falls back to episode count', () => {
    assert.equal(detectCategory(movieMeta, movieContext), 'movie');
    assert.equal(detectCategory(varietyMeta, varietyContext), 'variety');
    assert.equal(detectCategory({ typeName: '国产剧', episodeCount: 40 }, varietyContext), 'tv');
    // 元数据缺失时按集数推断
    assert.equal(detectCategory(null, movieContext), 'movie');
    assert.equal(detectCategory(null, varietyContext), 'tv');
});

test('buildFileName uses the real episode name instead of index+1', () => {
    assert.equal(buildFileName('唐伯虎点秋香2019', 'HD国语', 0, true), '唐伯虎点秋香2019-HD国语');
    assert.equal(buildFileName('你好，星期六', '20261102特别企划', 554, false), '你好星期六-20261102特别企划');
    assert.equal(buildFileName('某剧', '', 2, false), '某剧-第3集');
    assert.equal(buildFileName('某电影', '', 0, true), '某电影');
});

test('movie plan saves flat into the movie preset without a title subfolder', () => {
    const plan = buildDownloadPlan(movieContext, movieMeta, DEFAULT_DOWNLOAD_SETTINGS);
    assert.equal(plan.presetId, 'movie');
    assert.equal(plan.isMovie, true);
    assert.equal(plan.filename, '唐伯虎点秋香2019-HD国语');
    assert.equal(plan.saveDir, '/mnt/nas-video/电影');
    assert.equal(plan.fullPath, '/mnt/nas-video/电影/唐伯虎点秋香2019-HD国语.mp4');
    assert.equal(validatePlan(plan), null);
});

test('variety plan nests under the cleaned show title with the real episode name', () => {
    const plan = buildDownloadPlan(varietyContext, varietyMeta, DEFAULT_DOWNLOAD_SETTINGS);
    assert.equal(plan.presetId, 'variety');
    assert.equal(plan.isMovie, false);
    assert.equal(plan.filename, '你好星期六-20261102特别企划');
    assert.equal(plan.saveDir, '/mnt/nas-video/综艺/你好星期六');
    assert.equal(plan.fullPath, '/mnt/nas-video/综艺/你好星期六/你好星期六-20261102特别企划.mp4');
    assert.equal(validatePlan(plan), null);
});

test('plan keeps user overrides when late metadata arrives', () => {
    const plan = buildDownloadPlan(varietyContext, varietyMeta, DEFAULT_DOWNLOAD_SETTINGS, {
        presetId: 'tv',
        filename: '我自己改的名字',
        saveDir: '/mnt/nas-video/自定义/',
    });
    assert.equal(plan.presetId, 'tv');
    assert.equal(plan.filename, '我自己改的名字');
    assert.equal(plan.saveDir, '/mnt/nas-video/自定义');
});

test('fallback plan still works when /api/detail is unavailable', () => {
    const plan = buildDownloadPlan(varietyContext, null, DEFAULT_DOWNLOAD_SETTINGS);
    assert.equal(plan.metaResolved, false);
    assert.equal(plan.filename, '你好星期六-20261102特别企划');
    assert.equal(plan.saveDir, '/mnt/nas-video/电视剧/你好星期六');
});

test('validatePlan rejects missing or non-http source urls', () => {
    const plan = buildDownloadPlan(movieContext, movieMeta, DEFAULT_DOWNLOAD_SETTINGS);
    assert.match(validatePlan({ ...plan, url: '' }) ?? '', /没有可用的视频直链/);
    assert.match(validatePlan({ ...plan, url: '/api/proxy?url=x' }) ?? '', /没有可用的视频直链/);
    assert.match(validatePlan({ ...plan, saveDir: '' }) ?? '', /保存目录/);
});

test('normalizeDownloadSettings repairs broken stored settings', () => {
    const settings = normalizeDownloadSettings({
        baseUrl: '',
        token: 123,
        autoConfirmSeconds: 999,
        presets: [
            { id: 'movie', label: '电影', path: '/mnt/nas-video/电影/', flat: true },
            { id: 'movie', label: '重复', path: '/dup/' },
            { id: '', label: '无效', path: '/x/' },
        ],
        openDownloadPage: 'yes',
    });
    assert.equal(settings.baseUrl, DEFAULT_DOWNLOAD_SETTINGS.baseUrl);
    assert.equal(settings.token, DEFAULT_DOWNLOAD_SETTINGS.token);
    assert.equal(settings.autoConfirmSeconds, 30);
    assert.equal(settings.presets.length, 1);
    assert.equal(settings.presets[0].path, '/mnt/nas-video/电影/');
    assert.equal(settings.openDownloadPage, DEFAULT_DOWNLOAD_SETTINGS.openDownloadPage);
});
