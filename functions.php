<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

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
}

function parseOwOcodes($content)
{
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
                $imgUrl = Typecho_Common::url(htmlspecialchars($data['icon'], ENT_QUOTES, 'UTF-8'), Helper::options()->siteUrl);
                $imgTag = sprintf(
                    '<img src="%s" width="%s" loading="lazy" alt="%s">',
                    $imgUrl,
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
    <h3>当前主题版本：<span style="color: #b45864;">1.2.6</span></h3>
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

    // Pjax 开关
    // https://github.com/MoOx/pjax

    $enablepjax = new Typecho_Widget_Helper_Form_Element_Radio(
        'enablepjax',
        array('1' => _t('启用'), '0' => _t('关闭')),
        '1',
        _t('是否启用 Pjax 加载（实验性）'),
        _t('可以大幅提高页面加载效率和切换体验')
    );
    $form->addInput($enablepjax);

    // Pjax回调函数
    $PjaxScript = new \Typecho\Widget\Helper\Form\Element\Textarea(
        'PjaxScript',
        null,
        null,
        _t('Pjax回调函数'),
        _t('在这里填入需要被 Pjax 回调的函数，例如：loadDPlayer(); 如果不知道这是什么，请忽略。')
    );
    $form->addInput($PjaxScript);

    // $enablepjax = new Typecho_Widget_Helper_Form_Element_Select('enablepjax', array(
    //     '1' => '启用',
    //     '0' => '关闭'
    // ), '1', _t('是否启用 Pjax 加载'), _t('是否启用 Pjax 加载'));
    // $layout->addItem($enablepjax);  // 注册

    // echo `如果你启用了 PJax，你可能需要稍微配置一下代码使它正常运行。<br />
    // 所有被 <pjax></pjax> 标签包裹的所有元素将被pjax重载。<br />
    // 所有含有 data-pjax 标记的 script 标签将被pjax重载。<br />
    // <ul >
    // <li>事件：<code>pjax:send</code>在 Pjax 请求开始后触发。</font></li>
    // <li>事件：<code>pjax:complete</code>在 Pjax 请求完成后触发。</font></li>
    // <li>事件：<code>pjax:success</code>在 Pjax 请求成功后触发。</font></li>
    // <li>事件：<code>pjax:error</code>在 Pjax 请求失败后触发。</li>
    // </ul>`;

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

    // 代码高亮设置
    $codeBlockSettings = new Typecho_Widget_Helper_Form_Element_Checkbox(
        'codeBlockSettings',
        array(
            'ShowLineNumbers' => _t('显示代码行数'),
            'ShowCopyButton' => _t('显示复制按钮')
        ),
        array('ShowLineNumbers', 'ShowCopyButton'), // 默认选中
        _t('代码高亮个性化')
    );
    $form->addInput($codeBlockSettings->multiMode());

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
            'aos.js'            => $options->themeUrl . '/js/lib/aos.js',
            'aos.css'           => $options->themeUrl . '/css/lib/aos.css',
            'a11y-dark.min.css' => $options->themeUrl . '/css/lib/a11y-dark.min.css',
            'medium-zoom.min.js' => $options->themeUrl . '/js/lib/medium-zoom.min.js',
            'highlight.min.js'  => $options->themeUrl . '/js/lib/highlight.min.js',
            'pjax.min.js'       => $options->themeUrl . '/js/lib/pjax.min.js',
            'pace.min.js'       => $options->themeUrl . '/js/lib/pace.min.js',
            'pace-theme-default.min.css' => $options->themeUrl . '/css/lib/pace-theme-default.min.css'
        ],
        'bootcdn' => [
            'aos.js'            => "https://cdn.bootcdn.net/ajax/libs/aos/2.3.4/aos.js",
            'aos.css'           => "https://cdn.bootcdn.net/ajax/libs/aos/2.3.4/aos.css",
            'a11y-dark.min.css' => "https://cdn.bootcdn.net/ajax/libs/highlight.js/11.10.0/styles/a11y-dark.min.css",
            'medium-zoom.min.js' => "https://cdn.bootcdn.net/ajax/libs/medium-zoom/1.1.0/medium-zoom.min.js",
            'highlight.min.js'  => "https://cdn.bootcdn.net/ajax/libs/highlight.js/11.10.0/highlight.min.js",
            'pjax.min.js'       => "https://cdn.bootcdn.net/ajax/libs/pjax/0.2.8/pjax.min.js",
            'pace.min.js'       => 'https://cdn.bootcdn.net/ajax/libs/pace/1.2.4/pace.min.js',
            'pace-theme-default.min.css' => "https://cdn.bootcdn.net/ajax/libs/pace/1.2.4/pace-theme-default.min.css"
        ],
        "cdnjs" => [
            'aos.js'            => "https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.js",
            'aos.css'           => "https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.css",
            'a11y-dark.min.css' => "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/a11y-dark.min.css",
            'medium-zoom.min.js' => "https://cdnjs.cloudflare.com/ajax/libs/medium-zoom/1.1.0/medium-zoom.min.js",
            'highlight.min.js'  => "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/highlight.min.js",
            'pjax.min.js'       => "https://cdnjs.cloudflare.com/ajax/libs/pjax/0.2.8/pjax.min.js",
            'pace.min.js'       => 'https://cdnjs.cloudflare.com/ajax/libs/pace/1.2.4/pace.min.js',
            'pace-theme-default.min.css' => "https://cdnjs.cloudflare.com/ajax/libs/pace/1.2.4/pace-theme-default.min.css"
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
        'pink' => ['theme' => '#ea868f', 'hover' => '#DB2777'],  // 粉色
        'green' => ['theme' => '#48c774', 'hover' => '#15803d'], // 绿色
        'blue' => ['theme' => '#3273dc', 'hover' => '#3B82F6'],  // 蓝色
        'yellow' => ['theme' => '#feb272', 'hover' => '#B45309'], // 黄色
        'red' => ['theme' => '#ef4444', 'hover' => '#dc2626'],   // 红色
        'purple' => ['theme' => '#8b5cf6', 'hover' => '#7c3aed'], // 紫色
        'cyan' => ['theme' => '#06b6d4', 'hover' => '#0891b2'],   // 青色
        'orange' => ['theme' => '#f97316', 'hover' => '#ea580c'], // 橙色
    ];

    // 设置默认颜色
    $defaultColor = ['theme' => '#ea868f', 'hover' => '#d1606e'];

    // 根据颜色方案设置主题颜色和悬停颜色
    $colors = isset($colorMap[$colorScheme]) ? $colorMap[$colorScheme] : $defaultColor;
    $themeColor = $colors['theme'];
    $themeHoverColor = $colors['hover'];

    // 深色模式颜色映射数组
    $darkColorMap = [
        'pink' => ['theme' => '#b45864', 'hover' => '#d72b6f'],
        'green' => ['theme' => '#2e7c55', 'hover' => '#0f6933'],
        'blue' => ['theme' => '#2855b0', 'hover' => '#1f55e6'],
        'yellow' => ['theme' => '#bf763f', 'hover' => '#934109'],
        'red' => ['theme' => '#b91c1c', 'hover' => '#991b1b'],    // 暗红色
        'purple' => ['theme' => '#6d28d9', 'hover' => '#5b21b6'], // 暗紫色
        'cyan' => ['theme' => '#0e7490', 'hover' => '#155e75'],   // 暗青色
        'orange' => ['theme' => '#c2410c', 'hover' => '#9a3412'], // 暗橙色
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

        // 如果不在排除列表中，添加 data-zoomable 属性
        if (!$should_exclude) {
            if (strpos($img, 'data-zoomable') === false) {
                $img = preg_replace('/<img/', '<img data-zoomable', $img);
            }
        }

        return $img;
    }, $content);

    return $content;
}

function parse_Shortcodes($content)
{
    // 替换短代码结束标签后的 <br> 标签
    $content = preg_replace('/\[\/(alert|window|friend-card|collapsible-panel|timeline|tabs)\](<br\s*\/?>)?/i', '[/$1]', $content);
    $content = preg_replace('/\[\/timeline-event\](<br\s*\/?>)?/i', '[/timeline-event]', $content);
    $content = preg_replace('/\[\/tab\](<br\s*\/?>)?/i', '[/tab]', $content);

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
        $name = $matches[1];
        $ico = $matches[2];
        $url = $matches[3];
        $description = $matches[4];
        return "<div friend-name=\"$name\" ico=\"$ico\" url=\"$url\">$description</div>";
    }, $content);

    // 处理 [collapsible-panel] 短代码
    $content = preg_replace_callback('/\[collapsible-panel title="([^"]*)"\](.*?)\[\/collapsible-panel\]/s', function ($matches) {
        $title = $matches[1];
        $text = preg_replace('/^<br\s*\/?>/', '', $matches[2]);
        return "<div collapsible-panel title=\"$title\">$text</div>";
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
    $content = preg_replace_callback('/\[tabs\](.*?)\[\/tabs\]/s', function ($matches) {
        $innerContent = $matches[1];
        $innerContent = preg_replace_callback('/\[tab title="([^"]*)"\](.*?)\[\/tab\]/s', function ($tabMatches) {
            $title = $tabMatches[1];
            $tabContent = preg_replace('/^\s*<br\s*\/?>/', '', $tabMatches[2]);
            return "<div tab-title=\"$title\">$tabContent</div>";
        }, $innerContent);
        return "<div tabs>$innerContent</div>";
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

    // 图片底部文字注释结构
    // 使用正则表达式匹配所有的图片标签
    $pattern = '/<img.*?src=[\'"](.*?)[\'"].*?>/i';

    // 使用 preg_replace_callback 来处理每个匹配到的图片标签
    $content = preg_replace_callback($pattern, function ($matches) {
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
        return '<div class="notifications-container"><div class="window ' . $type . '"><div class="flex"><div class="window-prompt-wrap"><p class="window-prompt-heading">' . $title . '</p><div class="window-prompt-prompt"><p>' . $innerContent . '</p></div></div></div></div></div>';
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
    $pattern = '/\[PicGrid\](.*?)\[\/PicGrid\]/s';
    preg_match_all($pattern, $content, $matches);

    if (!empty($matches[1])) {
        foreach ($matches[1] as $match) {
            $cleanMatch = str_replace('<br>', '', $match);
            $cleanMatch = preg_replace('/<figcaption>.*?<\/figcaption>/', '', $cleanMatch);
            $cleanMatch = preg_replace('/<\/?p>/', '', $cleanMatch);

            // 为每个 <figure> 标签添加属性
            $cleanMatch = preg_replace_callback('/<figure([^>]*)>/i', function ($matches) {
                $attributes = $matches[1];
                $new_attributes = ' data-aos="fade-up" data-aos-anchor-placement="top-bottom" data-aos-delay="85"';
                return "<figure$attributes$new_attributes>";
            }, $cleanMatch);

            $gridContent = '<div class="pic-grid">' . $cleanMatch . '</div>';
            $content = str_replace('[PicGrid]' . $match . '[/PicGrid]', $gridContent, $content);
        }
    }

    return $content;
}

// 运行所有函数
function parseShortcodes($content)
{
    $content = parse_Shortcodes($content);
    $content = parse_alerts($content);
    $content = parse_windows($content);
    $content = parse_timeline($content);
    $content = parsePicGrid($content);

    $content = add_zoomable_to_images($content); # 图片放大

    // 为所有HTML标签添加 data-aos（极简正则版）
    $content = preg_replace_callback(
        '/<(\w+)(\s|>)/i',
        function ($matches) {

            return '<' . $matches[1] . ' animation: fadeInUp 0.5s ease forwards; ' . $matches[2];

            return $matches[0];
        },
        $content
    );

    return $content;
}
