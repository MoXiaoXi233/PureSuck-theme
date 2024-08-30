<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

function themeFields($layout)
{
    $description = new Typecho_Widget_Helper_Form_Element_Text('description', NULL, NULL, _t('描述'), _t('简单一句话描述'));
    $description->input->setAttribute('class', 'text w-100');
    $layout->addItem($description);
}
function parseOwOcodes($content) {
    // 读取 JSON 文件
    $jsonFile = __DIR__ . '/js/OwO.json';
    if (!file_exists($jsonFile)) {
        return htmlspecialchars($content, ENT_QUOTES, 'UTF-8');
    }

    $jsonContent = file_get_contents($jsonFile);
    $shortcodes = json_decode($jsonContent, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        return htmlspecialchars($content, ENT_QUOTES, 'UTF-8');
    }

    // 遍历 JSON 文件中的所有表情包类型
    foreach ($shortcodes as $key => $package) {
        if (isset($package['type']) && $package['type'] === 'image' && isset($package['container'])) {
            foreach ($package['container'] as $data) {
                $shortcode = htmlspecialchars($data['input'], ENT_QUOTES, 'UTF-8');
                $imgTag = sprintf(
                    '<img src="%s" width="%s" loading="lazy" alt="%s">',
                    htmlspecialchars($data['icon'], ENT_QUOTES, 'UTF-8'),
                    htmlspecialchars($package['width'], ENT_QUOTES, 'UTF-8'),
                    htmlspecialchars($data['text'], ENT_QUOTES, 'UTF-8')
                );
                $content = str_replace($shortcode, $imgTag, $content);
            }
        }
    }

    return $content;
}

function themeConfig($form)
{
    // 网页 icon URL 配置项
    $logoUrl = new \Typecho\Widget\Helper\Form\Element\Text(
        'logoUrl',
        null,
        null,
        _t('favicon.ico 地址'),
        _t('填写ico格式图片 URL 地址, 在网站标题前加上一个 icon')
    );
    $form->addInput($logoUrl);


    // 左侧 LOGO URL 配置项
    $logoIndex = new \Typecho\Widget\Helper\Form\Element\Text(
        'logoIndex',
        null,
        null,
        _t('左侧 LOGO 地址'),
        _t('填写JPG/PNG/Webp等图片 URL 地址, 网站左侧头像的显示(512*512最佳)')
    );
    $form->addInput($logoIndex);

    // 左侧描述
    $customDescription = new \Typecho\Widget\Helper\Form\Element\Textarea(
        'customDescription',
        null,
        null,
        _t('左侧描述'),
        _t('填写自定义描述内容，将在网站左侧显示')
    );
    $form->addInput($customDescription);

    // 左侧自定义
    $leftSideCustomCode = new \Typecho\Widget\Helper\Form\Element\Textarea(
        'leftSideCustomCode',
        null,
        null,
        _t('左侧自定义区域'),
        _t('支持自定义html，将在网站左侧显示')
    );
    $form->addInput($leftSideCustomCode);

    //作者头像
    $authorAvatar = new \Typecho\Widget\Helper\Form\Element\Text(
        'authorAvatar',
        null,
        null,
        _t('作者头像地址'),
        _t('填写JPG/PNG/Webp等图片 URL 地址, 用于显示文章作者头像')
    );
    $form->addInput($authorAvatar);

    // 网站标题配置项
    $titleIndex = new \Typecho\Widget\Helper\Form\Element\Text(
        'titleIndex',
        null,
        null,
        _t('网站标题'),
        _t('网站左侧标题文字')
    );
    $form->addInput($titleIndex);

    // 网页底部信息
    $footerInfo = new \Typecho\Widget\Helper\Form\Element\Textarea(
        'footerInfo',
        null,
        null,
        _t('网页底部信息'),
        _t('填写网页底部的自定义信息，可以包含HTML内容，用<br>')
    );
    $form->addInput($footerInfo);

    // Footer script标签
    $footerScript = new \Typecho\Widget\Helper\Form\Element\Textarea(
        'footerScript',
        null,
        null,
        _t('Script标签'),
        _t('位于Footer，可以插统计站的代码，在这里填入JavaScript代码，需要包含&lt;script&gt;标签')
    );
    $form->addInput($footerScript);

    // 搜索功能显示选项
    $showSearch = new Typecho_Widget_Helper_Form_Element_Radio(
        'showSearch',
        array('1' => _t('显示'), '0' => _t('隐藏')),
        '1',
        _t('是否显示搜索功能')
    );
    $form->addInput($showSearch);

    // TOC 模块显示选项
    $showTOC = new Typecho_Widget_Helper_Form_Element_Radio(
        'showTOC',
        array('1' => _t('显示'), '0' => _t('隐藏')),
        '1',
        _t('是否显示目录树')
    );
    $form->addInput($showTOC);

    // 分类模块显示选项
    $showCategory = new Typecho_Widget_Helper_Form_Element_Radio(
        'showCategory',
        array('1' => _t('显示'), '0' => _t('隐藏')),
        '1',
        _t('是否显示分类模块')
    );
    $form->addInput($showCategory);

    // 标签模块显示选项
    $showTag = new Typecho_Widget_Helper_Form_Element_Radio(
        'showTag',
        array('1' => _t('显示'), '0' => _t('隐藏')),
        '1',
        _t('是否显示标签模块')
    );
    $form->addInput($showTag);

    // 主题配色
    $colors = array(
        'pink' => _t('素粉'),
        'green' => _t('淡绿'),
        'blue' => _t('墨蓝'),
        'yellow' => _t('落黄')
    );
    $defaultColor = 'pink';  // 默认配色
    $colorSelect = new Typecho_Widget_Helper_Form_Element_Radio('colorScheme', $colors, $defaultColor, _t('配色方案'), _t('选择一个配色方案，默认为素粉'));
    $form->addInput($colorSelect);
}

// 主题配色
function getColorScheme()
{
    $colorScheme = Typecho_Widget::widget('Widget_Options')->colorScheme;
    return $colorScheme;
}

function generateDynamicCSS()
{
    // 获取颜色方案
    $colorScheme = getColorScheme();

    // 定义颜色映射数组
    $colorMap = [
        'pink' => ['theme' => '#ea868f', 'hover' => '#DB2777'],  // 粉色
        'green' => ['theme' => '#48c774', 'hover' => '#15803d'], // 绿色
        'blue' => ['theme' => '#3273dc', 'hover' => '#3B82F6'],  // 蓝色
        'yellow' => ['theme' => '#feb272', 'hover' => '#B45309'] // 黄色
    ];

    // 设置默认颜色
    $defaultColor = ['theme' => '#ea868f', 'hover' => '#d1606e'];

    // 根据颜色方案设置主题颜色和悬停颜色
    $colors = isset($colorMap[$colorScheme]) ? $colorMap[$colorScheme] : $defaultColor;
    $themeColor = $colors['theme'];
    $themeHoverColor = $colors['hover'];

    // 输出动态CSS
    echo '<style>:root { --themecolor: ' . htmlspecialchars($themeColor, ENT_QUOTES, 'UTF-8') . '; --themehovercolor: ' . htmlspecialchars($themeHoverColor, ENT_QUOTES, 'UTF-8') . '; }</style>';
}
