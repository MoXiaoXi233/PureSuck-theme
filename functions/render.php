<?php
if (!defined('__TYPECHO_ROOT_DIR__'))
    exit;

// ==================== 渲染管道模块 ====================
// 协调各页面模块，按顺序处理文章内容

// 内容渲染主函数
function renderPostContent($content)
{
    // 文章页功能处理
    $content = parse_Shortcodes($content);
    $content = parse_alerts($content);
    $content = parse_windows($content);
    $content = parse_timeline($content);
    $content = parsePicGrid($content);

    $content = theme_wrap_tables($content);
    $content = add_zoomable_to_images($content);
    $content = parseOwOcodes($content);

    return TOC_Generate($content);
}
