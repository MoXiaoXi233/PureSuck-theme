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

    $content = psNormalizeBlockParagraphs($content);
    $content = psCleanupEmptyParagraphs($content);

    return $content;
}

// 修复短代码解析后产生的 <p><div...></div></p> 结构，避免浏览器自动插入空段落。
function psNormalizeBlockParagraphs($content)
{
    if (!is_string($content) || $content === '') {
        return (string)$content;
    }

    $blockTags = '(?:div|section|article|aside|figure|ul|ol|table|blockquote|pre|h[1-6])';
    $spaceLike = '(?:\s|&nbsp;|&#160;|<br\s*\/?>)*';

    // <p> + 空白 + 块级开始标签 => 去掉开头 p
    $content = preg_replace('/<p>' . $spaceLike . '(<'.$blockTags.'\b[^>]*>)/iu', '$1', $content);
    // 块级结束标签 + 空白 + </p> => 去掉结尾 p
    $content = preg_replace('/(<\/'.$blockTags.'>)' . $spaceLike . '<\/p>/iu', '$1', $content);

    return $content;
}

// 清理解析后遗留的空段落，避免组件前后出现多余空白。
function psCleanupEmptyParagraphs($content)
{
    if (!is_string($content) || $content === '') {
        return (string)$content;
    }

    return preg_replace('/<p>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p>/iu', '', $content);
}

// 内容渲染主函数
function renderPostContent($content)
{
    $source = (string)$content;
    if (trim($source) === '') {
        $GLOBALS['toc_html'] = '';
        return $source;
    }

    $version = defined('PS_THEME_VERSION') ? PS_THEME_VERSION : '0';
    $optionFingerprint = psGetRenderOptionFingerprint();
    $contentHash = md5($source);
    $cacheKey = 'render_post_content:v6:' . $version . ':' . $contentHash . ':' . $optionFingerprint;
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

    $content = psRenderContentPipeline($source);
    $toc = (string)($GLOBALS['toc_html'] ?? '');
    setCache($cacheKey, ['content' => $content, 'toc' => $toc], 'render');

    return $content;
}
