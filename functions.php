<?php
if (!defined('__TYPECHO_ROOT_DIR__'))
    exit;

// Theme constants (used for cache keys, etc.)
if (!defined('PS_THEME_VERSION')) {
    define('PS_THEME_VERSION', '1.3.2');
}

// ==================== 主入口文件 ====================
// Typecho标准结构：functions/ 目录存放功能文件

// 缓存层：文件缓存等
require_once __DIR__ . '/functions/cache.php';

// 文章页功能：TOC、图片、表情、文章字段
require_once __DIR__ . '/functions/article.php';

// 首页功能：列表、卡片等

// 侧边栏功能：统计、搜索、分类、标签
require_once __DIR__ . '/functions/sidebar.php';

// 短代码功能：解析与渲染
require_once __DIR__ . '/functions/shortcodes.php';

// 通用功能：初始化、配置、CDN、配色
require_once __DIR__ . '/functions/common.php';

// 渲染管道：协调各模块处理内容
require_once __DIR__ . '/functions/render.php';

// OWO 表情面板：服务端渲染
require_once __DIR__ . '/functions/owo.php';
