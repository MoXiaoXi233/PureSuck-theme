<?php
if (!defined('__TYPECHO_ROOT_DIR__'))
    exit;

// ==================== 渲染管道模块 ====================
// 协调各页面模块，按顺序处理文章内容

// 内容渲染主函数
function renderPostContent($content)
{
    // 文章页功能处理
    $content = parseShortcodes($content);
    $content = parseAlerts($content);
    $content = parseWindows($content);
    $content = parseTimeline($content);
    $content = parsePicGrid($content);

    $content = wrapTables($content);
    $content = addZoomableToImages($content);
    $content = parseOwOcodes($content);

    return generateToc($content);
}
