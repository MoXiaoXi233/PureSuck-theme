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

    $description = new Typecho_Widget_Helper_Form_Element_Text('description', NULL, NULL, _t('网页描述'), _t('简单一句话描述文章内容，用于网站 Description，有利于 SEO 优化，非必要'));
    $description->input->setAttribute('class', 'text w-100');
    $layout->addItem($description);
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
    <h3>当前主题版本：<span style="color: #b45864;">1.2.1</span></h3>
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
        _t('位于Footer，可以插统计站的代码，在这里填入JavaScript代码，需要包含&lt;script&gt;标签，不要填其他内容，否则会造成样式错误！<br>如果开启了 Pjax 功能，请自行在 header.php 配置回调函数或者向他人寻求帮助')
    );
    $form->addInput($footerScript);

    // 网页底部信息
    $footerInfo = new \Typecho\Widget\Helper\Form\Element\Textarea(
        'footerInfo',
        null,
        null,
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
            'show' => _t('显示'),
            'hide' => _t('隐藏')
        ),
        'show',
        _t('是否显示主标题下的装饰线条'),
        _t('选择是否显示主标题下的装饰线条的装饰线条，带有触摸反馈')
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

    // 深色模式颜色映射数组
    $darkColorMap = [
        'pink' => ['theme' => '#b45864', 'hover' => '#d72b6f'],
        'green' => ['theme' => '#2e7c55', 'hover' => '#0f6933'],
        'blue' => ['theme' => '#2855b0', 'hover' => '#1f55e6'],
        'yellow' => ['theme' => '#bf763f', 'hover' => '#934109']
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
