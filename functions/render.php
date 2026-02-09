<?php
if (!defined('__TYPECHO_ROOT_DIR__'))
    exit;

// ==================== 渲染管道模块 ====================
// 协调各页面模块，按顺序处理文章内容

function psGetRenderOptionFingerprint()
{
    $options = Typecho_Widget::widget('Widget_Options');

    // 只包含真正影响渲染输出的配置
    $fingerprint = [
        'v' => defined('PS_THEME_VERSION') ? PS_THEME_VERSION : '0',
        'toc' => (string)($options->showTOC ?? '1')
    ];

    return md5(json_encode($fingerprint));
}

function psRenderContentPipeline($content)
{
    $steps = [
        'parseShortcodes',
        'parseAlerts',
        'parseWindows',
        'parseTimeline',
        'parsePicGrid',
        'wrapTables',
        'addZoomableToImages',
        'parseOwOcodes',
        'generateToc'
    ];

    foreach ($steps as $step) {
        if (!function_exists($step)) {
            continue;
        }
        $content = $step($content);
    }

    return $content;
}

// 内容渲染主函数
function renderPostContent($content)
{
    $source = (string)$content;
    if (trim($source) === '') {
        $GLOBALS['toc_html'] = '';
        $GLOBALS['ps_render_context'] = [
            'cache_hit' => false,
            'cache_key' => '',
            'content_hash' => '',
            'toc' => ''
        ];
        return $source;
    }

    $version = defined('PS_THEME_VERSION') ? PS_THEME_VERSION : '0';
    $optionFingerprint = psGetRenderOptionFingerprint();
    $contentHash = md5($source);
    $cacheKey = 'render_post_content:v2:' . $version . ':' . $contentHash . ':' . $optionFingerprint;
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
        $GLOBALS['ps_render_context'] = [
            'cache_hit' => true,
            'cache_key' => $cacheKey,
            'content_hash' => $contentHash,
            'toc' => (string)($cache['data']['toc'] ?? '')
        ];
        return (string)$cache['data']['content'];
    }

    $content = psRenderContentPipeline($source);
    $toc = (string)($GLOBALS['toc_html'] ?? '');
    setCache($cacheKey, ['content' => $content, 'toc' => $toc], 'render');

    $GLOBALS['ps_render_context'] = [
        'cache_hit' => false,
        'cache_key' => $cacheKey,
        'content_hash' => $contentHash,
        'toc' => $toc
    ];

    return $content;
}
