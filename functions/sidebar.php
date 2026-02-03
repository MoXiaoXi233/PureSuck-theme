<?php
if (!defined('__TYPECHO_ROOT_DIR__'))
    exit;

// ==================== 侧边栏功能模块 ====================
// 包含：统计、搜索、分类、标签、个人信息

// 全站文章总字数
function getAllCharacters()
{
    $cacheKey = 'all_characters:v1';
    $ttl = 6 * 3600;
    $cache = getCache($cacheKey, $ttl, 'stats');
    if ($cache && !empty($cache['fresh'])) {
        return (string)$cache['data'];
    }

    $chars = 0;
    $db = Typecho_Db::get();
    $select = $db->select('text')->from('table.contents');
    $rows = $db->fetchAll($select);
    foreach ($rows as $row) {
        $chars += getMarkdownCharacters($row['text']);
    }
    $unit = '';
    if ($chars >= 10000) {
        $chars /= 10000;
        $unit = 'w';
    } else if ($chars >= 1000) {
        $chars /= 1000;
        $unit = 'k';
    }
    $out = sprintf('%.2lf %s', $chars, $unit);
    setCache($cacheKey, $out, 'stats');
    return $out;
}

// 获取文章总数
function getTotalPostsCount()
{
    $cacheKey = 'total_posts:v1';
    $ttl = 6 * 3600;
    $cache = getCache($cacheKey, $ttl, 'stats');
    if ($cache && !empty($cache['fresh'])) {
        return (int)$cache['data'];
    }

    $db = Typecho_Db::get();
    $select = $db->select('COUNT(*) AS count')->from('table.contents')->where('type = ?', 'post');
    $result = $db->fetchObject($select);

    if ($result) {
        $count = (int)$result->count;
        setCache($cacheKey, $count, 'stats');
        return $count;
    } else {
        return 0;
    }
}

// 获取 CC 协议链接
function getCcLink()
{
    $options = Typecho_Widget::widget('Widget_Options');
    return 'https://creativecommons.org/licenses/' . $options->ccLicense . '/4.0/deed.zh-hans';
}
