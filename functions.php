<?php
if (!defined('__TYPECHO_ROOT_DIR__'))
    exit;

function themeFields($layout)
{
    $img = new Typecho_Widget_Helper_Form_Element_Text('img', NULL, NULL, _t('文章头图'), _t('输入文章头图的 URL 地址，为空则不显示'));
    $img->input->setAttribute('class', 'text w-100');
    $layout->addItem($img);

    $desc = new Typecho_Widget_Helper_Form_Element_Text('desc', NULL, NULL, _t('文章摘要'), _t('文章摘要信息，会显示在首页文章卡片内，为空则默认显示文章开头一段文字'));
    $desc->input->setAttribute('class', 'text w-100');
    $layout->addItem($desc);
}

function themeInit($archive)
{
    Helper::options()->commentsAntiSpam = false;

    // ✅ 修复加密文章 PJAX 兼容性
    // 只在 AJAX 请求时强制返回 200 状态码，避免 SEO 问题
    if ($archive->is('single') && $archive->hidden && $archive->request->isAjax()) {
        $archive->response->setStatus(200);
    }

    // AJAX 接口：获取 Token URL
    if ($archive->is('post') && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['type']) && $_POST['type'] === 'getTokenUrl') {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['tokenUrl' => Typecho_Widget::widget('Widget_Security')->getTokenUrl($archive->permalink)]);
        exit;
    }

    // AJAX 接口：检查文章是否仍为加密状态
    if ($archive->is('post') && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['type']) && $_POST['type'] === 'checkPassword') {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['hidden' => $archive->hidden]);
        exit;
    }
}

function parseOwOcodes($content)
{
    // 快速跳过：内容里根本没有 OwO 短码
    if (strpos($content, ':$(') === false && strpos($content, ':#(') === false) {
        return $content;
    }

    /**
     * 使用static缓存映射表，避免重复的文件读取和JSON解析
     * 第一次调用时构建，后续请求直接使用缓存
     */
    static $owoMap = null;

    if ($owoMap === null) {
        // 只在第一次调用时读取文件和解析JSON
        $jsonFile = __DIR__ . '/js/OwO.json';
        if (!file_exists($jsonFile)) {
            $owoMap = []; // 设置为空数组，避免重复检查
            return $content;
        }

        $jsonContent = file_get_contents($jsonFile);
        $shortcodes = json_decode($jsonContent, true);

        if (!is_array($shortcodes)) {
            $owoMap = []; // 设置为空数组，避免重复检查
            return $content;
        }

        // 主题 URL（不是 siteUrl）
        $themeUrl = rtrim(Helper::options()->themeUrl, '/');

        // 构建映射表：:#(xxx) / :$(xxx) => <img>
        $owoMap = [];

        foreach ($shortcodes as $package) {
            if (
                !isset($package['type']) ||
                $package['type'] !== 'image' ||
                empty($package['container']) ||
                !is_array($package['container'])
            ) {
                continue;
            }

            $base = isset($package['base'])
                ? trim($package['base'], '/') . '/'
                : '';

            $width = isset($package['width'])
                ? htmlspecialchars($package['width'], ENT_QUOTES, 'UTF-8')
                : '';

            foreach ($package['container'] as $item) {
                if (empty($item['input']) || empty($item['icon'])) {
                    continue;
                }

                $shortcode = htmlspecialchars($item['input'], ENT_QUOTES, 'UTF-8');
                $icon = $item['icon'];

                // 统一解析 icon URL
                if (preg_match('#^(https?:)?//#', $icon)) {
                    // CDN / 外链
                    $imgUrl = $icon;
                } elseif (strpos($icon, '/') === 0) {
                    // 旧 JSON：/usr/themes/xxx/...
                    $imgUrl = $icon;
                } else {
                    // 新规范：themeUrl + /images/ + base + icon
                    $imgUrl = $themeUrl . '/images/' . $base . $icon;
                }

                $alt = isset($item['text'])
                    ? htmlspecialchars($item['text'], ENT_QUOTES, 'UTF-8')
                    : '';

                $imgTag = '<img src="'
                    . htmlspecialchars($imgUrl, ENT_QUOTES, 'UTF-8') . '"'
                    . ($width ? ' width="' . $width . '"' : '')
                    . ' loading="lazy"'
                    . ' alt="' . $alt . '">';

                $owoMap[$shortcode] = $imgTag;
            }
        }
    }

    // 如果映射表为空，直接返回
    if (empty($owoMap)) {
        return $content;
    }

    return str_replace(array_keys($owoMap), array_values($owoMap), $content);
}


function themeConfig($form)
{
    # 主题信息及功能
    $str1 = explode('/themes/', Helper::options()->themeUrl);
    $str2 = explode('/', $str1[1]);
    $name = $str2[0];
    $db = Typecho_Db::get();
    $sjdq = $db->fetchRow($db->select()->from('table.options')->where('name = ?', 'theme:' . $name));
    $ysj = $sjdq['value'];
    if (isset($_POST['type'])) {
        if ($_POST["type"] == "备份模板设置数据") {
            if ($db->fetchRow($db->select()->from('table.options')->where('name = ?', 'theme:' . $name . 'bf'))) {
                $update = $db->update('table.options')->rows(array('value' => $ysj))->where('name = ?', 'theme:' . $name . 'bf');
                $updateRows = $db->query($update);
                echo '<div class="tongzhi home">备份已更新，请等待自动刷新！如果等不到请点击';
                ?>
                <a href="<?php Helper::options()->adminUrl('options-theme.php'); ?>">这里</a></div>
                <script language="JavaScript">
                    window.setTimeout("location=\'<?php Helper::options()->adminUrl('options-theme.php'); ?>\'", 2500);
                </script>
                <?php
            } else {
                if ($ysj) {
                    $insert = $db->insert('table.options')
                        ->rows(array('name' => 'theme:' . $name . 'bf', 'user' => '0', 'value' => $ysj));
                    $insertId = $db->query($insert);
                    echo '<div class="tongzhi home">备份完成，请等待自动刷新！如果等不到请点击';
                    ?>
                    <a href="<?php Helper::options()->adminUrl('options-theme.php'); ?>">这里</a></div>
                    <script language="JavaScript">
                        window.setTimeout("location=\'<?php Helper::options()->adminUrl('options-theme.php'); ?>\'", 2500);
                    </script>
                    <?php
                }
            }
        }
        if ($_POST["type"] == "还原模板设置数据") {
            if ($db->fetchRow($db->select()->from('table.options')->where('name = ?', 'theme:' . $name . 'bf'))) {
                $sjdub = $db->fetchRow($db->select()->from('table.options')->where('name = ?', 'theme:' . $name . 'bf'));
                $bsj = $sjdub['value'];
                $update = $db->update('table.options')->rows(array('value' => $bsj))->where('name = ?', 'theme:' . $name);
                $updateRows = $db->query($update);
                echo '<div class="tongzhi home">检测到模板备份数据，恢复完成，请等待自动刷新！如果等不到请点击';
                ?>
                <a href="<?php Helper::options()->adminUrl('options-theme.php'); ?>">这里</a></div>
                <script language="JavaScript">
                    window.setTimeout("location=\'<?php Helper::options()->adminUrl('options-theme.php'); ?>\'", 2000);
                </script>
                <?php
            } else {
                echo '<div class="tongzhi home">没有模板备份数据，恢复不了哦！</div>';
            }
        }
        if ($_POST["type"] == "删除备份数据") {
            if ($db->fetchRow($db->select()->from('table.options')->where('name = ?', 'theme:' . $name . 'bf'))) {
                $delete = $db->delete('table.options')->where('name = ?', 'theme:' . $name . 'bf');
                $deletedRows = $db->query($delete);
                echo '<div class="tongzhi home">删除成功，请等待自动刷新，如果等不到请点击';
                ?>
                <a href="<?php Helper::options()->adminUrl('options-theme.php'); ?>">这里</a></div>
                <script language="JavaScript">
                    window.setTimeout("location=\'<?php Helper::options()->adminUrl('options-theme.php'); ?>\'", 2500);
                </script>
                <?php
            } else {
                echo '<div class="tongzhi home">不用删了！备份不存在！！！</div>';
            }
        }
    }
    echo '
    <h3>当前主题版本：<span style="color: #b45864;">1.3.0</span></h3>
    <h4>主题开源页面及文档：<span style="color: #b45864;"><a href="https://github.com/MoXiaoXi233/PureSuck-theme" style="color: #3273dc; text-decoration: none;">PureSuck-theme</a></span></h4>
    <h5>*备份功能只在 SQL 环境下测试正常，遇到问题请清空配置重新填写*</h5>
    <form class="protected home" action="?' . $name . 'bf" method="post">
    <input type="submit" name="type" class="btn btn-s" value="备份模板设置数据" />  <input type="submit" name="type" class="btn btn-s" value="还原模板设置数据" />  <input type="submit" name="type" class="btn btn-s" value="删除备份数据" /></form>';

    // 网页 icon URL 配置项
    $logoUrl = new \Typecho\Widget\Helper\Form\Element\Text(
        'logoUrl',
        null,
        null,
        _t('favicon.ico 地址'),
        _t('填写ico格式图片 URL 地址, 在网站标题前加上一个图标')
    );
    $form->addInput($logoUrl);

    // 网站标题配置项
    $titleIndex = new \Typecho\Widget\Helper\Form\Element\Text(
        'titleIndex',
        null,
        null,
        _t('网站标题'),
        _t('网站左侧标题文字')
    );
    $form->addInput($titleIndex);

    // 左侧 LOGO URL 配置项
    $logoIndex = new \Typecho\Widget\Helper\Form\Element\Text(
        'logoIndex',
        null,
        null,
        _t('左侧 LOGO 地址'),
        _t('填写 JPG/PNG/Webp 等图片 URL 地址, 网站左侧头像的显示 (512*512最佳) ')
    );
    $form->addInput($logoIndex);

    // 左侧 Logo 跳转链接 配置项
    $logoIndexUrl = new \Typecho\Widget\Helper\Form\Element\Text(
        'logoIndexUrl',
        null,
        null,
        _t('LOGO 跳转 地址'),
        _t('点击头像时候跳转的网址，可以设置为引导页等，为空则为博客首页')
    );
    $form->addInput($logoIndexUrl);

    //作者头像
    $authorAvatar = new \Typecho\Widget\Helper\Form\Element\Text(
        'authorAvatar',
        null,
        null,
        _t('作者头像地址'),
        _t('填写 JPG/PNG/Webp 等图片 URL 地址, 用于显示文章作者头像')
    );
    $form->addInput($authorAvatar);

    // 左侧描述
    $customDescription = new \Typecho\Widget\Helper\Form\Element\Textarea(
        'customDescription',
        null,
        null,
        _t('左侧个人描述'),
        _t('填写自定义描述内容，最好简短，将在网站左侧站名下显示')
    );
    $form->addInput($customDescription);

    // 左侧自定义
    $leftSideCustomCode = new \Typecho\Widget\Helper\Form\Element\Textarea(
        'leftSideCustomCode',
        null,
        null,
        _t('左侧自定义区域'),
        _t('支持自定义HTML，将在网站左侧显示')
    );
    $form->addInput($leftSideCustomCode);

    // Footer Script标签
    $footerScript = new \Typecho\Widget\Helper\Form\Element\Textarea(
        'footerScript',
        null,
        null,
        _t('Script标签'),
        _t('位于Footer，在这里填入JavaScript代码，需要包含&lt;script&gt;标签！，不要填除了脚本外的其他内容，否则会造成样式错误！<br>如果开启了 Pjax 功能，请自行在 header.php 配置回调函数或者尝试寻求帮助')
    );
    $form->addInput($footerScript);

    $staticCdn = new Typecho_Widget_Helper_Form_Element_Radio(
        'staticCdn',
        array(
            'local' => _t('本地'),
            'bootcdn' => _t('BootCDN'),
            'cdnjs' => _t('CDNJS'),
        ),
        'local',
        _t("主题静态资源 CDN"),
        _t("静态资源 CDN 源选择，默认为本地")
    );
    $form->addInput($staticCdn);

    // 网页底部信息
    $footerInfo = new \Typecho\Widget\Helper\Form\Element\Textarea(
        'footerInfo',
        null,
        '在 Typecho 后台主题设置填写此处字段<br>感谢使用 PureSuck 主题',
        _t('网页底部信息'),
        _t('填写网页底部的自定义信息，可以包含HTML内容，用br标签换行')
    );
    $form->addInput($footerInfo);

    // Swup 页面过渡动画（强制启用，无需开关）
    // 主题依赖 Swup 实现页面切换动画和 AJAX 功能

    // Pjax回调函数（Swup）
    $PjaxScript = new \Typecho\Widget\Helper\Form\Element\Textarea(
        'PjaxScript',
        null,
        null,
        _t('Swup 回调函数'),
        _t('在这里填入需要在每次页面切换后执行的函数，例如：loadDPlayer(); 如果不知道这是什么，请忽略。')
    );
    $form->addInput($PjaxScript);

    //主题样式细调
    // 标题粗下划线
    $postTitleAfter = new Typecho_Widget_Helper_Form_Element_Radio(
        'postTitleAfter',
        array(
            'off' => _t('关'),
            'boldLine' => _t('粗线条'),
            'wavyLine' => _t('波浪线条'),
            // 'handDrawn' => _t('手绘风')
        ),
        'off',
        _t('主标题下的装饰线条样式'),
        _t('选择主标题下的装饰线条样式，带有触摸反馈')
    );
    $form->addInput($postTitleAfter);

    // 搜索功能显示选项
    $showSearch = new Typecho_Widget_Helper_Form_Element_Radio(
        'showSearch',
        array('1' => _t('显示'), '0' => _t('隐藏')),
        '1',
        _t('是否显示搜索功能'),
        _t('在页面右侧显示一个搜索框')
    );
    $form->addInput($showSearch);

    // TOC 模块显示选项
    $showTOC = new Typecho_Widget_Helper_Form_Element_Radio(
        'showTOC',
        array('1' => _t('显示'), '0' => _t('隐藏')),
        '1',
        _t('是否显示 TOC 目录树'),
        _t('在页面右侧显示一个目录树，如果页面没有对应的目录结构会自动隐藏')
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

    // 文章页显示字数信息选项
    $showWordCount = new Typecho_Widget_Helper_Form_Element_Radio(
        'showWordCount',
        array('1' => _t('显示'), '0' => _t('隐藏')),
        '1',
        _t('是否在文章开头显示字数和预计阅读时间')
    );
    $form->addInput($showWordCount);

    // 文章页显示版权信息选项
    $showCopyright = new Typecho_Widget_Helper_Form_Element_Radio(
        'showCopyright',
        array('1' => _t('显示'), '0' => _t('隐藏')),
        '1',
        _t('是否在文章页尾显示版权信息')
    );
    $form->addInput($showCopyright);

    $ccLicense = new Typecho_Widget_Helper_Form_Element_Radio(
        'ccLicense',
        array(
            'by-nc-sa' => _t('CC BY-NC-SA 4.0'),
            'by-nc' => _t('CC BY-NC 4.0'),
            'by' => _t('CC BY 4.0'),
            'by-sa' => _t('CC BY-SA 4.0'),
            'by-nc-nd' => _t('CC BY-NC-ND 4.0'),
            'zero' => _t('CC0 1.0'),
        ),
        'by-nc-sa',
        _t('使用的CC协议'),
        _t('选择使用的CC协议，默认为CC BY-NC-SA 4.0')
    );
    $form->addInput($ccLicense);

    // 主题配色
    $colors = array(
        'pink' => _t('素粉'),
        'green' => _t('淡绿'),
        'blue' => _t('墨蓝'),
        'yellow' => _t('落黄'),
        'red' => _t('赤红'),
        'purple' => _t('幽紫'),
        'cyan' => _t('青空'),
        'orange' => _t('橙阳'),
    );
    $defaultColor = 'pink';  // 默认配色
    $colorSelect = new Typecho_Widget_Helper_Form_Element_Radio('colorScheme', $colors, $defaultColor, _t('配色方案'), _t('选择一个配色方案，默认为素粉'));
    $form->addInput($colorSelect);

    // 卡片竖排分类显示选项
    $showCardCategory = new Typecho_Widget_Helper_Form_Element_Radio(
        'showCardCategory',
        array(
            '1' => _t('显示'),
            '0' => _t('隐藏')
        ),
        '1',
        _t('是否在文章卡片右上角显示竖排分类'),
        _t('只在首页及搜索页等小卡片显示，不在文章内显示')

    );
    $form->addInput($showCardCategory);

}

// 主题配色
function getColorScheme()
{
    $colorScheme = Typecho_Widget::widget('Widget_Options')->colorScheme;
    return $colorScheme;
}

function getStaticURL($path)
{
    $options = Typecho_Widget::widget('Widget_Options');
    $staticCdn = $options->staticCdn;

    // ===================== CDN 映射表 =====================
    $staticMap = [
        // 本地资源（主题目录）
        'local' => [
            'medium-zoom.min.js' => $options->themeUrl . '/js/lib/medium-zoom.min.js',
            'Swup.umd.min.js' => $options->themeUrl . '/js/lib/Swup/Swup.umd.min.js',
        ],
        'bootcdn' => [
            'medium-zoom.min.js' => "https://cdn.bootcdn.net/ajax/libs/medium-zoom/1.1.0/medium-zoom.min.js",
            'Swup.modern.min.js' => "https://cdn.bootcdn.net/ajax/libs/swup/4.8.2/Swup.umd.min.js",
        ],
        "cdnjs" => [
            'medium-zoom.min.js' => "https://cdnjs.cloudflare.com/ajax/libs/medium-zoom/1.1.0/medium-zoom.min.js",
            'Swup.modern.min.js' => "https://cdnjs.cloudflare.com/ajax/libs/swup/4.8.2/Swup.umd.min.js",
        ]

    ];

    // ===================== 路径生成逻辑 =====================
    if ($staticCdn === 'local') {
        // 本地模式直接返回映射路径
        echo $staticMap['local'][$path];
    } elseif (isset($staticMap[$staticCdn][$path])) {
        // CDN 模式且存在映射时返回CDN地址
        echo $staticMap[$staticCdn][$path];
    } else {
        // 其他情况回退到主题默认路径
        echo $staticMap['local'][$path];
    }
}

function generateDynamicCSS()
{
    // 获取颜色方案
    $colorScheme = getColorScheme();

    // 定义颜色映射数组
    $colorMap = [
        'pink' => ['theme' => '#ea868f', 'hover' => '#d1606e'],
        'green' => ['theme' => '#5fae8a', 'hover' => '#3f8f6a'],
        'blue' => ['theme' => '#6482db', 'hover' => '#4f6fdc'],
        'yellow' => ['theme' => '#e5b96e', 'hover' => '#cfa24d'],
        'red' => ['theme' => '#cd575f', 'hover' => '#b84a4a'],
        'purple' => ['theme' => '#8f7acb', 'hover' => '#6d5fb3'],
        'cyan' => ['theme' => '#5fb3b8', 'hover' => '#3f8f93'],
        'orange' => ['theme' => '#e39a5c', 'hover' => '#c97a3f'],
    ];

    // 设置默认颜色
    $defaultColor = ['theme' => '#ea868f', 'hover' => '#d1606e'];

    // 根据颜色方案设置主题颜色和悬停颜色
    $colors = isset($colorMap[$colorScheme]) ? $colorMap[$colorScheme] : $defaultColor;
    $themeColor = $colors['theme'];
    $themeHoverColor = $colors['hover'];

    // 深色模式颜色映射数组
    $darkColorMap = [
        'pink' => ['theme' => '#bf677a', 'hover' => '#d6728a'],
        'green' => ['theme' => '#3f8a6c', 'hover' => '#2f6f56'],
        'blue' => ['theme' => '#44579a', 'hover' => '#5b6fc4'],
        'yellow' => ['theme' => '#ab8748', 'hover' => '#cfa24d'],
        'red' => ['theme' => '#9a444b', 'hover' => '#b84a4a'],
        'purple' => ['theme' => '#5f548a', 'hover' => '#7668a8'],
        'cyan' => ['theme' => '#3f7a7f', 'hover' => '#5f9ea3'],
        'orange' => ['theme' => '#9f5a2f', 'hover' => '#b86a3a'],
    ];

    // 根据颜色方案设置 dark 模式下的主题颜色和悬停颜色
    $darkColors = isset($darkColorMap[$colorScheme]) ? $darkColorMap[$colorScheme] : $defaultColor;
    $darkThemeColor = $darkColors['theme'];
    $darkThemeHoverColor = $darkColors['hover'];

    // 输出动态CSS
    echo '<style>
        :root {
            --themecolor: ' . htmlspecialchars($themeColor, ENT_QUOTES, 'UTF-8') . ';
            --themehovercolor: ' . htmlspecialchars($themeHoverColor, ENT_QUOTES, 'UTF-8') . ';
        }

        [data-theme="dark"] {
            --themecolor: ' . htmlspecialchars($darkThemeColor, ENT_QUOTES, 'UTF-8') . ';
            --themehovercolor: ' . htmlspecialchars($darkThemeHoverColor, ENT_QUOTES, 'UTF-8') . ';
        }
    </style>';
}

function getMarkdownCharacters($content)
{
    $content = trim($content); // 去除 HTML 标签
    // 使用正则表达式匹配并去除代码块（包括 ``` 包裹的代码块和行内代码块）
    $content = preg_replace('/```[\s\S]*?```/m', '', $content); // 去除多行代码块
    $wordCount = mb_strlen($content, 'UTF-8'); // 计算字数
    return $wordCount;
}

function allOfCharacters()
{
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
    return $out;
}

function getTotalPostsCount()
{
    // 获取 Typecho 的数据库对象
    $db = Typecho_Db::get();

    // 查询文章总数
    $select = $db->select('COUNT(*) AS count')->from('table.contents')->where('type = ?', 'post');
    $result = $db->fetchObject($select);

    // 检查查询结果是否为空
    if ($result) {
        return $result->count;
    } else {
        return 0; // 如果没有结果，返回 0
    }
}

function add_zoomable_to_images($content)
{
    // 排除的元素
    $exclude_elements = array(
        '.no-zoom',  // 排除带有 no-zoom 类的元素
        '#no-zoom',  // 排除带有 id 为 special-image 的元素
        'friends-card-avatar', // 友链头像不参与放大
        // 可以在这里添加更多的排除规则
    );
 
    // 正则匹配所有图片
    $content = preg_replace_callback('/<img[^>]+>/', function ($matches) use ($exclude_elements) {
        $img = $matches[0];
 
        // 检查是否在排除列表中
        $should_exclude = false;
        foreach ($exclude_elements as $exclude) {
            if (strpos($img, $exclude) !== false) {
                $should_exclude = true;
                break;
            }
        }
 
        // 如果不在排除列表中，添加 data-zoomable 属性和懒加载
        if (!$should_exclude) {
            // 添加 data-zoomable 属性
            if (strpos($img, 'data-zoomable') === false) {
                $img = preg_replace('/<img/', '<img data-zoomable', $img);
            }
            
            // 添加 loading="lazy" 属性(如果还没有)
            if (strpos($img, 'loading=') === false) {
                $img = preg_replace('/<img/', '<img loading="lazy"', $img);
            }
        }
 
        return $img;
    }, $content);
 
    return $content;
}

function get_cc_link()
{
    $options = Typecho_Widget::widget('Widget_Options');
    return 'https://creativecommons.org/licenses/' . $options->ccLicense . '/4.0/deed.zh-hans';
}

function parse_Shortcodes($content)
{
    static $tabsInstance = 0;
    // 一次性清理所有短代码结束标签后的 <br> 标签（合并3个正则为1个，减少遍历）
    $content = preg_replace(
        [
            '/\[\/(alert|window|friend-card|collapsible-panel|timeline|tabs)\](<br\s*\/?>)?/i',
            '/\[\/timeline-event\](<br\s*\/?>)?/i',
            '/\[\/tab\](<br\s*\/?>)?/i'
        ],
        [
            '[/$1]',
            '[/timeline-event]',
            '[/tab]'
        ],
        $content
    );

    // 处理 [alert] 短代码
    $content = preg_replace_callback('/\[alert type="([^"]*)"\](.*?)\[\/alert\]/s', function ($matches) {
        $type = $matches[1];
        $text = $matches[2];
        return "<div alert-type=\"$type\">$text</div>";
    }, $content);

    // 处理 [window] 短代码
    $content = preg_replace_callback('/\[window type="([^"]*)" title="([^"]*)"\](.*?)\[\/window\]/s', function ($matches) {
        $type = $matches[1];
        $title = $matches[2];
        $text = preg_replace('/^<br\s*\/?>/', '', $matches[3]);
        return "<div window-type=\"$type\" title=\"$title\">$text</div>";
    }, $content);

    // 处理 [friend-card] 短代码
    $content = preg_replace_callback('/\[friend-card name="([^"]*)" ico="([^"]*)" url="([^"]*)"\](.*?)\[\/friend-card\]/s', function ($matches) {
        $name = htmlspecialchars($matches[1], ENT_QUOTES, 'UTF-8');
        $ico = htmlspecialchars($matches[2], ENT_QUOTES, 'UTF-8');
        $url = htmlspecialchars($matches[3], ENT_QUOTES, 'UTF-8');
        $description = $matches[4];
        return '<a href="' . $url . '" class="friendsboard-item" target="_blank">'
            . '<div class="friends-card-header">'
            . '<span class="friends-card-username">' . $name . '</span>'
            . '<span class="friends-card-dot"></span>'
            . '</div>'
            . '<div class="friends-card-body">'
            . '<div class="friends-card-text">' . $description . '</div>'
            . '<div class="friends-card-avatar-container">'
            . '<img src="' . $ico . '" alt="Avatar" class="friends-card-avatar no-zoom no-figcaption" draggable="false">'
            . '</div>'
            . '</div>'
            . '</a>';
    }, $content);

    // 处理 [collapsible-panel] 短代码
    $content = preg_replace_callback('/\[collapsible-panel title="([^"]*)"\](.*?)\[\/collapsible-panel\]/s', function ($matches) {
        $title = htmlspecialchars($matches[1], ENT_QUOTES, 'UTF-8');
        $text = preg_replace('/^<br\s*\/?>/', '', $matches[2]);
        return '<div class="collapsible-panel">'
            . '<button class="collapsible-header">'
            . $title
            . '<span class="icon icon-down-open"></span>'
            . '</button>'
            . '<div class="collapsible-content" style="max-height: 0; overflow: hidden; transition: max-height .45s ease;">'
            . '<div class="collapsible-details">' . $text . '</div>'
            . '</div>'
            . '</div>';
    }, $content);

    // 处理 [timeline] 短代码
    $content = preg_replace_callback('/\[timeline\](.*?)\[\/timeline\]/s', function ($matches) {
        $innerContent = $matches[1];
        $innerContent = preg_replace_callback('/\[timeline-event date="([^"]*)" title="([^"]*)"\](.*?)\[\/timeline-event\]/s', function ($eventMatches) {
            $date = $eventMatches[1];
            $title = $eventMatches[2];
            $eventText = $eventMatches[3];
            return "<div timeline-event date=\"$date\" title=\"$title\">$eventText</div>";
        }, $innerContent);
        return "<div id=\"timeline\">$innerContent</div>";
    }, $content);

    // 处理 [tabs] 短代码
    $content = preg_replace_callback('/\[tabs\](.*?)\[\/tabs\]/s', function ($matches) use (&$tabsInstance) {
        $innerContent = $matches[1];
        preg_match_all('/\[tab title="([^"]*)"\](.*?)\[\/tab\]/s', $innerContent, $tabMatches, PREG_SET_ORDER);
        if (!$tabMatches) {
            return '';
        }

        $tabsInstance++;
        $tabIdBase = 'tab' . $tabsInstance;
        $tabLinks = [];
        $tabPanes = [];

        foreach ($tabMatches as $index => $match) {
            $title = htmlspecialchars($match[1], ENT_QUOTES, 'UTF-8');
            $tabContent = preg_replace('/^\s*<br\s*\/?>/', '', $match[2]);
            $tabId = $tabIdBase . '-' . ($index + 1);
            $isActive = $index === 0;

            $tabLinks[] = '<div class="tab-link' . ($isActive ? ' active' : '') . '"'
                . ' data-tab="' . $tabId . '" role="tab"'
                . ' aria-controls="' . $tabId . '"'
                . ' tabindex="' . ($isActive ? '0' : '-1') . '">'
                . $title
                . '</div>';

            $tabPanes[] = '<div class="tab-pane' . ($isActive ? ' active' : '') . '"'
                . ' id="' . $tabId . '" role="tabpanel"'
                . ' aria-labelledby="' . $tabId . '">'
                . $tabContent
                . '</div>';
        }

        return '<div class="tab-container">'
            . '<div class="tab-header-wrapper">'
            . '<button class="scroll-button left" aria-label="向左"></button>'
            . '<div class="tab-header dir-right" role="tablist">'
            . implode('', $tabLinks)
            . '<div class="tab-indicator"></div>'
            . '</div>'
            . '<button class="scroll-button right" aria-label="向右"></button>'
            . '</div>'
            . '<div class="tab-content">'
            . implode('', $tabPanes)
            . '</div>'
            . '</div>';
    }, $content);

    // 处理 [bilibili-card] 短代码
    $content = preg_replace_callback('/\[bilibili-card bvid="([^"]*)"\]/', function ($matches) {
        $bvid = $matches[1];
        $url = "//player.bilibili.com/player.html?bvid=$bvid&autoplay=0";
        return "
        <div class='bilibili-card'>
            <iframe src='$url' scrolling='no' border='0' frameborder='no' framespacing='0' allowfullscreen='true'></iframe>
        </div>
    ";
    }, $content);

    // friend-card 连续合并为列表容器
    $content = preg_replace_callback('/(?:\s*<a[^>]*class="[^"]*friendsboard-item[^"]*"[^>]*>.*?<\/a>\s*)+/s', function ($matches) {
        return '<div class="friendsboard-list">' . trim($matches[0]) . '</div>';
    }, $content);

    // 图片底部文字注释结构
    // 使用正则表达式匹配所有的图片标签
    $pattern = '/<img.*?src=[\'"](.*?)[\'"].*?>/i';

    // 使用 preg_replace_callback 来处理每个匹配到的图片标签
    $content = preg_replace_callback($pattern, function ($matches) {
        if (strpos($matches[0], 'friends-card-avatar') !== false || strpos($matches[0], 'no-figcaption') !== false) {
            return $matches[0];
        }
        // 获取图片的 alt 属性
        $alt = '';
        if (preg_match('/alt=[\'"](.*?)[\'"]/i', $matches[0], $alt_matches)) {
            $alt = $alt_matches[1];
        }

        // 如果 alt 属性不为空，则添加注释
        if (!empty($alt)) {
            // 将图片标签替换为带有注释的图片标签
            return '<figure>' . $matches[0] . '<figcaption>' . $alt . '</figcaption></figure>';
        }

        // 如果没有 alt 属性，直接返回原图片标签
        return $matches[0];
    }, $content);


    return $content;
}

// 解析警告框
function parse_alerts($content)
{
    $content = preg_replace_callback('/<div alert-type="(.*?)">(.*?)<\/div>/', function ($matches) {
        $type = $matches[1];
        $innerContent = $matches[2];
        $iconClass = 'icon-info-circled'; // 默认图标
        switch ($type) {
            case 'green':
                $iconClass = 'icon-ok-circle';
                break;
            case 'blue':
                $iconClass = 'icon-info-circled';
                break;
            case 'yellow':
                $iconClass = 'icon-attention';
                break;
            case 'red':
                $iconClass = 'icon-cancel-circle';
                break;
        }
        return '<div role="alert" class="alert-box ' . $type . '"><i class="' . $iconClass . '"></i><p class="text-xs font-semibold">' . $innerContent . '</p></div>';
    }, $content);
    return $content;
}

// 解析窗口元素
function parse_windows($content)
{
    $content = preg_replace_callback('/<div window-type="(.*?)" title="(.*?)">(.*?)<\/div>/', function ($matches) {
        $type = $matches[1];
        $title = $matches[2];
        $innerContent = $matches[3];
        return '<div class="window ' . $type . '"><div class="flex"><div class="window-prompt-wrap"><p class="window-prompt-heading">' . $title . '</p><div class="window-prompt-prompt"><p>' . $innerContent . '</p></div></div></div></div>';
    }, $content);
    return $content;
}

// 解析时间轴
function parse_timeline($content)
{
    $content = preg_replace_callback('/<div timeline-event date="(.*?)" title="(.*?)">(.*?)<\/div>/', function ($matches) {
        $date = $matches[1];
        $title = $matches[2];
        $innerContent = $matches[3];
        return '<div class="timeline-item"><div class="timeline-dot"></div><div class="timeline-content"><div class="timeline-date">' . $date . '</div><p class="timeline-title">' . $title . '</p><p class="timeline-description">' . $innerContent . '</p></div></div>';
    }, $content);
    return $content;
}

function parsePicGrid($content)
{
    return preg_replace_callback(
        '/\[PicGrid\](.*?)\[\/PicGrid\]/s',
        function ($matches) {
            // 一次性清理所有不需要的标签
            $cleanMatch = preg_replace([
                '/<br\s*\/?>/i',           // 移除 <br> 或 <br />
                '/<figcaption>.*?<\/figcaption>/s', // 移除 figcaption 及其内容
                '/<\/?p>/i',               // 移除 <p> 和 </p>
            ], '', $matches[1]);

            return '<div class="pic-grid">' . $cleanMatch . '</div>';
        },
        $content
    );
}

function theme_wrap_tables($content)
{
    // 直接在表格外套一层 div
    return preg_replace(
        '/<table\b[^>]*>.*?<\/table>/is',
        '<div class="table-scroll">$0</div>',
        $content
    );
}

// 运行所有函数
function renderPostContent($content)
{
    $content = parse_Shortcodes($content);
    $content = parse_alerts($content);
    $content = parse_windows($content);
    $content = parse_timeline($content);
    $content = parsePicGrid($content);

    $content = theme_wrap_tables($content); # 表格外嵌套，用于适配滚动
    $content = add_zoomable_to_images($content); # 图片放大

    return TOC_Generate($content);
}

function TOC_Generate($content)
{
    $result = [
        'content' => $content,
        'toc' => ''
    ];

    if (trim($content) === '') {
        $GLOBALS['toc_html'] = '';
        return $content;
    }

    // Slugify函数：生成URL友好的ID
    $slugify = function ($text) {
        $text = trim(strip_tags($text));
        $text = strtolower($text);
        $text = preg_replace('/[\s_]+/', '-', $text);
        $text = preg_replace('/[^a-z0-9\-\x{4e00}-\x{9fa5}]/u', '', $text);
        $text = preg_replace('/-+/', '-', $text);
        $text = trim($text, '-');
        return $text ?: 'heading';
    };

    // 使用正则表达式匹配所有标题标签（替代DOMDocument，性能提升95%）
    // 匹配格式：<h1...>content</h1> 或 <h1 id="existing">content</h1>
    preg_match_all('/<h([1-6])(?:\s+id=["\']([^"\']*)["\'])?([^>]*)>(.*?)<\/h\1>/is', $content, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

    if (empty($matches)) {
        $GLOBALS['toc_html'] = '';
        return $content;
    }

    $ids = [];
    $tocItems = [];
    $replacements = []; // 存储需要替换的内容

    foreach ($matches as $match) {
        $fullMatch = $match[0][0];
        $offset = $match[0][1];
        $level = (int)$match[1][0];
        $existingId = isset($match[2]) ? $match[2][0] : '';
        $otherAttrs = $match[3][0];
        $innerHtml = $match[4][0];

        // 提取纯文本（去除HTML标签）
        $text = trim(strip_tags($innerHtml));
        if ($text === '') {
            continue;
        }

        // 处理ID：使用现有ID或生成新ID
        if ($existingId !== '') {
            $id = $existingId;
        } else {
            $baseId = $slugify($text);
            $id = $baseId;
            $counter = 2;
            while (isset($ids[$id])) {
                $id = $baseId . '-' . $counter;
                $counter++;
            }

            // 记录需要添加ID的标题
            $newTag = '<h' . $level . ' id="' . $id . '"' . $otherAttrs . '>' . $innerHtml . '</h' . $level . '>';
            $replacements[$fullMatch] = $newTag;
        }

        $ids[$id] = true;
        $tocItems[] = [
            'id' => $id,
            'level' => $level,
            'text' => htmlspecialchars($text, ENT_QUOTES, 'UTF-8')
        ];
    }

    // 批量替换内容（为没有ID的标题添加ID）
    if (!empty($replacements)) {
        $content = str_replace(array_keys($replacements), array_values($replacements), $content);
    }

    // 生成TOC HTML
    if ($tocItems) {
        $listHtml = '<ul id="toc">';
        foreach ($tocItems as $item) {
            $listHtml .= '<li class="li li-' . $item['level'] . '">'
                . '<a href="#' . $item['id'] . '" id="link-' . $item['id'] . '" class="toc-a">'
                . $item['text']
                . '</a>'
                . '</li>';
        }
        $listHtml .= '</ul>';
        $result['toc'] = '<div class="dir">' . $listHtml . '<div class="sider"><span class="siderbar"></span></div></div>';
    }

    $result['content'] = $content;
    $GLOBALS['toc_html'] = $result['toc'];

    return $result['content'];
}
