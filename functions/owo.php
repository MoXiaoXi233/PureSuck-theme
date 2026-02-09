<?php
/**
 * OWO 表情面板 - PHP 服务端渲染
 *
 * 将表情面板 HTML 在服务端预渲染，减少客户端 JS 执行和网络请求
 * JS 端只负责交互逻辑（打开/关闭、切换分组、插入表情）
 */

if (!defined('__TYPECHO_ROOT_DIR__')) exit;

/**
 * 获取 OWO 表情数据（带缓存）
 */
function getOwoData() {
    static $data = null;

    if ($data !== null) {
        return $data;
    }

    $jsonFile = __DIR__ . '/../js/OwO.json';

    if (!file_exists($jsonFile)) {
        $data = [];
        return $data;
    }

    $content = file_get_contents($jsonFile);
    $data = json_decode($content, true);

    if (!is_array($data)) {
        $data = [];
    }

    return $data;
}

/**
 * 渲染 OWO 表情面板 HTML
 *
 * @param string $logo 按钮文字
 * @return string HTML 字符串
 */
function renderOwoPanel($logo = 'OωO表情') {
    $data = getOwoData();

    if (empty($data)) {
        return '<div class="OwO"></div>';
    }

    $packages = array_keys($data);
    $themeUrl = Helper::options()->themeUrl;
    $imageBase = $themeUrl . '/images/';

    // 开始构建 HTML
    $html = '<div class="OwO" data-owo-ssr="1">';

    // Logo 按钮
    $html .= '<div class="OwO-logo"><span>' . htmlspecialchars($logo) . '</span></div>';

    // Body 容器
    $html .= '<div class="OwO-body">';
    $html .= '<div class="OwO-panel">';

    // Viewport - 表情内容区
    $html .= '<div class="OwO-viewport">';

    foreach ($packages as $index => $pkgName) {
        $pkg = $data[$pkgName];
        $type = $pkg['type'] ?? 'emoticon';
        $items = $pkg['container'] ?? [];
        $width = $pkg['width'] ?? null;
        $base = $pkg['base'] ?? '';

        // 处理图片路径前缀
        $imgPrefix = '';
        if ($type === 'image' && $base) {
            $imgPrefix = $imageBase . trim($base, '/') . '/';
        }

        // 表情列表
        $hidden = $index === 0 ? '' : ' hidden';
        $html .= '<ul class="OwO-items OwO-items-' . $type . '" data-pkg-idx="' . $index . '"' . $hidden . '>';

        foreach ($items as $item) {
            $icon = $item['icon'] ?? '';
            $text = $item['text'] ?? '';
            $input = $item['input'] ?? $icon;

            $html .= '<li class="OwO-item" title="' . htmlspecialchars($text) . '" data-input="' . htmlspecialchars($input) . '">';

            if ($type === 'image') {
                // 图片表情
                $imgSrc = $icon;
                // 如果不是绝对路径或外链，添加前缀
                if (!preg_match('#^(https?:)?//#', $icon) && !str_starts_with($icon, '/')) {
                    $imgSrc = $imgPrefix . $icon;
                }
                $style = $width ? ' style="width:' . htmlspecialchars($width) . '"' : '';
                $html .= '<img src="' . htmlspecialchars($imgSrc) . '" alt="' . htmlspecialchars($text) . '" loading="lazy"' . $style . '>';
            } else {
                // 文字表情（颜文字/emoji）
                $html .= htmlspecialchars($icon);
            }

            $html .= '</li>';
        }

        $html .= '</ul>';
    }

    $html .= '</div>'; // viewport

    // Bar - 分组切换栏
    $html .= '<div class="OwO-bar">';
    $html .= '<ul class="OwO-packages">';

    foreach ($packages as $index => $pkgName) {
        $active = $index === 0 ? ' OwO-package-active' : '';
        $html .= '<li class="' . $active . '" data-idx="' . $index . '"><span>' . htmlspecialchars($pkgName) . '</span></li>';
    }

    $html .= '</ul>';
    $html .= '<div class="OwO-indicator"></div>';
    $html .= '</div>'; // bar

    $html .= '</div>'; // panel
    $html .= '</div>'; // body
    $html .= '</div>'; // OwO

    return $html;
}
