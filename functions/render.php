<?php
if (!defined('__TYPECHO_ROOT_DIR__'))
    exit;

// ==================== 渲染管道模块 ====================
// 协调各页面模块，按顺序处理文章内容

// 内容渲染主函数
function renderPostContent($content)
{
    // 文章页功能处理
    if (trim((string)$content) === '') {
        $GLOBALS['toc_html'] = '';
        return $content;
    }

    $version = defined('PS_THEME_VERSION') ? PS_THEME_VERSION : '0';
    $cacheKey = 'render_post_content:v1:' . $version . ':' . md5($content);
    $ttl = 6 * 3600;

    $cache = getCache($cacheKey, $ttl, 'render');
    if (
        $cache &&
        !empty($cache['fresh']) &&
        isset($cache['data']) &&
        is_array($cache['data']) &&
        array_key_exists('content', $cache['data'])
    ) {
        $GLOBALS['toc_html'] = (string)($cache['data']['toc'] ?? '');
        return (string)$cache['data']['content'];
    }

    $content = parseShortcodes($content);
    $content = parseAlerts($content);
    $content = parseWindows($content);
    $content = parseTimeline($content);
    $content = parsePicGrid($content);

    $content = wrapTables($content);
    $content = addZoomableToImages($content);
    $content = parseOwOcodes($content);

    $content = generateToc($content);
    $toc = (string)($GLOBALS['toc_html'] ?? '');
    setCache($cacheKey, ['content' => $content, 'toc' => $toc], 'render');
    return $content;
}
