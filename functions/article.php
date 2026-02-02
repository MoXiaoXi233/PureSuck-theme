<?php
if (!defined('__TYPECHO_ROOT_DIR__'))
    exit;

// ==================== 文章页功能模块 ====================
// 包含：TOC、短代码、图片处理、表情、文章字段

// 文章自定义字段
function themeFields($layout)
{
    $img = new Typecho_Widget_Helper_Form_Element_Text('img', NULL, NULL, _t('文章头图'), _t('输入文章头图的 URL 地址，为空则不显示'));
    $img->input->setAttribute('class', 'text w-100');
    $layout->addItem($img);

    $desc = new Typecho_Widget_Helper_Form_Element_Text('desc', NULL, NULL, _t('文章摘要'), _t('文章摘要信息，会显示在首页文章卡片内，为空则默认显示文章开头一段文字'));
    $desc->input->setAttribute('class', 'text w-100');
    $layout->addItem($desc);
}

// TOC 目录生成器
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

    $slugify = function ($text) {
        $text = trim(strip_tags($text));
        $text = strtolower($text);
        $text = preg_replace('/[\s_]+/', '-', $text);
        $text = preg_replace('/[^a-z0-9\-\x{4e00}-\x{9fa5}]/u', '', $text);
        $text = preg_replace('/-+/', '-', $text);
        $text = trim($text, '-');
        return $text ?: 'heading';
    };

    preg_match_all('/<h([1-6])(?:\s+id=["\']([^"\']*)["\'])?([^>]*)>(.*?)<\/h\1>/is', $content, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

    if (empty($matches)) {
        $GLOBALS['toc_html'] = '';
        return $content;
    }

    $ids = [];
    $tocItems = [];
    $replacements = [];

    foreach ($matches as $match) {
        $fullMatch = $match[0][0];
        $level = (int)$match[1][0];
        $existingId = isset($match[2]) ? $match[2][0] : '';
        $otherAttrs = $match[3][0];
        $innerHtml = $match[4][0];

        $text = trim(strip_tags($innerHtml));
        if ($text === '') {
            continue;
        }

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

    if (!empty($replacements)) {
        $content = str_replace(array_keys($replacements), array_values($replacements), $content);
    }

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

// 短代码解析器
function parse_Shortcodes($content)
{
    static $tabsInstance = 0;

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

    $content = preg_replace_callback('/\[alert type="([^"]*)"\](.*?)\[\/alert\]/s', function ($matches) {
        $type = $matches[1];
        $text = $matches[2];
        return "<div alert-type=\"$type\">$text</div>";
    }, $content);

    $content = preg_replace_callback('/\[window type="([^"]*)" title="([^"]*)"\](.*?)\[\/window\]/s', function ($matches) {
        $type = $matches[1];
        $title = $matches[2];
        $text = preg_replace('/^<br\s*\/?>/', '', $matches[3]);
        return "<div window-type=\"$type\" title=\"$title\">$text</div>";
    }, $content);

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

    $content = preg_replace_callback('/\[collapsible-panel title="([^"]*)"\](.*?)\[\/collapsible-panel\]/s', function ($matches) {
        $title = htmlspecialchars($matches[1], ENT_QUOTES, 'UTF-8');
        $text = preg_replace('/^<br\s*\/?>/', '', $matches[2]);
        return '<div class="collapsible-panel">'
            . '<button class="collapsible-header">'
            . $title
            . '<span class="icon icon-down-open"></span>'
            . '</button>'
            . '<div class="collapsible-content" style="max-height: 0; overflow: hidden;">'
            . '<div class="collapsible-details">' . $text . '</div>'
            . '</div>'
            . '</div>';
    }, $content);

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

    $content = preg_replace_callback('/\[bilibili-card bvid="([^"]*)"\]/', function ($matches) {
        $bvid = $matches[1];
        $url = "//player.bilibili.com/player.html?bvid=$bvid&autoplay=0";
        return "
        <div class='bilibili-card'>
            <iframe src='$url' scrolling='no' border='0' frameborder='no' framespacing='0' allowfullscreen='true'></iframe>
        </div>
    ";
    }, $content);

    $content = preg_replace_callback('/(?:\s*<a[^>]*class="[^"]*friendsboard-item[^"]*"[^>]*>.*?<\/a>\s*)+/s', function ($matches) {
        return '<div class="friendsboard-list">' . trim($matches[0]) . '</div>';
    }, $content);

    $pattern = '/<img.*?src=[\'"](.*?)[\'"].*?>/i';
    $content = preg_replace_callback($pattern, function ($matches) {
        if (strpos($matches[0], 'friends-card-avatar') !== false || strpos($matches[0], 'no-figcaption') !== false) {
            return $matches[0];
        }
        $alt = '';
        if (preg_match('/alt=[\'"](.*?)[\'"]/i', $matches[0], $alt_matches)) {
            $alt = $alt_matches[1];
        }

        if (!empty($alt)) {
            return '<figure>' . $matches[0] . '<figcaption>' . $alt . '</figcaption></figure>';
        }

        return $matches[0];
    }, $content);

    return $content;
}

function parse_alerts($content)
{
    $content = preg_replace_callback('/<div alert-type="(.*?)">(.*?)<\/div>/', function ($matches) {
        $type = $matches[1];
        $innerContent = $matches[2];
        $iconClass = 'icon-info-circled';
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
            $cleanMatch = preg_replace([
                '/<br\s*\/?>/i',
                '/<figcaption>.*?<\/figcaption>/s',
                '/<\/?p>/i',
            ], '', $matches[1]);

            return '<div class="pic-grid">' . $cleanMatch . '</div>';
        },
        $content
    );
}

// 图片处理功能
function add_zoomable_to_images($content)
{
    $exclude_elements = array(
        '.no-zoom',
        '#no-zoom',
        'friends-card-avatar',
    );

    $content = preg_replace_callback('/<img[^>]+>/', function ($matches) use ($exclude_elements) {
        $img = $matches[0];

        $should_exclude = false;
        foreach ($exclude_elements as $exclude) {
            if (strpos($img, $exclude) !== false) {
                $should_exclude = true;
                break;
            }
        }

        if (!$should_exclude) {
            if (strpos($img, 'data-zoomable') === false) {
                $img = preg_replace('/<img/', '<img data-zoomable', $img);
            }

            if (strpos($img, 'data-lazy-src') === false && strpos($img, 'loading="eager"') === false) {
                if (preg_match('/src=["\']([^"\']+)["\']/', $img, $srcMatch)) {
                    $originalSrc = $srcMatch[1];
                    $placeholder = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                    $img = preg_replace('/src=["\'][^"\']+["\']/', 'src="' . $placeholder . '" data-lazy-src="' . htmlspecialchars($originalSrc, ENT_QUOTES) . '"', $img);
                }

                if (preg_match('/srcset=["\']([^"\']+)["\']/', $img, $srcsetMatch)) {
                    $originalSrcset = $srcsetMatch[1];
                    $img = preg_replace('/srcset=["\'][^"\']+["\']/', 'data-lazy-srcset="' . htmlspecialchars($originalSrcset, ENT_QUOTES) . '"', $img);
                }
            }
        }

        return $img;
    }, $content);

    return $content;
}

function theme_wrap_tables($content)
{
    return preg_replace(
        '/<table\b[^>]*>.*?<\/table>/is',
        '<div class="table-scroll">$0</div>',
        $content
    );
}

// OwO 表情解析器
function parseOwOcodes($content)
{
    if (strpos($content, ':$(') === false && strpos($content, ':#(') === false) {
        return $content;
    }

    static $owoMap = null;

    if ($owoMap === null) {
        $jsonFile = __DIR__ . '/../js/OwO.json';
        if (!file_exists($jsonFile)) {
            $owoMap = [];
            return $content;
        }

        $jsonContent = file_get_contents($jsonFile);
        $shortcodes = json_decode($jsonContent, true);

        if (!is_array($shortcodes)) {
            $owoMap = [];
            return $content;
        }

        $themeUrl = rtrim(Helper::options()->themeUrl, '/');
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

                if (preg_match('#^(https?:)?//#', $icon)) {
                    $imgUrl = $icon;
                } elseif (strpos($icon, '/') === 0) {
                    $imgUrl = $icon;
                } else {
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

    if (empty($owoMap)) {
        return $content;
    }

    return str_replace(array_keys($owoMap), array_values($owoMap), $content);
}

// 文章字数统计
function getMarkdownCharacters($content)
{
    $content = preg_replace('/```[\s\S]*?```/m', '', $content);
    preg_match_all('/[\x{4e00}-\x{9fa5}]/u', $content, $matches);
    return count($matches[0]);
}
