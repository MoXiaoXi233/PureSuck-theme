<?php
if (!defined('__TYPECHO_ROOT_DIR__'))
    exit;

// ==================== 短代码模块 ====================
// 1) 解析入口
// 2) 渲染与补丁

// 短代码统一入口与快速跳过
function applyShortcodes($content, array $shortcodes)
{
    foreach ($shortcodes as $shortcode) {
        if (!empty($shortcode['check'])) {
            $checks = is_array($shortcode['check']) ? $shortcode['check'] : [$shortcode['check']];
            $found = false;
            foreach ($checks as $check) {
                if (strpos($content, $check) !== false) {
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                continue;
            }
        }

        $content = preg_replace_callback($shortcode['pattern'], $shortcode['handler'], $content);
    }

    return $content;
}

function parseShortcodes($content)
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

    $shortcodes = [
        [
            // 基础提示
            'check' => '[alert',
            'pattern' => '/\[alert type="([^"]*)"\](.*?)\[\/alert\]/s',
            'handler' => function ($matches) {
                $type = $matches[1];
                $text = $matches[2];
                return "<div alert-type=\"$type\">$text</div>";
            }
        ],
        [
            'check' => '[window',
            'pattern' => '/\[window type="([^"]*)" title="([^"]*)"\](.*?)\[\/window\]/s',
            'handler' => function ($matches) {
                $type = $matches[1];
                $title = $matches[2];
                $text = preg_replace('/^<br\s*\/?>/', '', $matches[3]);
                return "<div window-type=\"$type\" title=\"$title\">$text</div>";
            }
        ],
        [
            // 卡片
            'check' => '[github',
            'pattern' => '/\[github\s+url="([^"]+)"\s*\]/i',
            'handler' => function ($matches) {
                return renderGithubCard($matches[1]);
            }
        ],
        [
            'check' => '[post',
            'pattern' => '/\[post\s+url="([^"]+)"\s*\]/i',
            'handler' => function ($matches) {
                return renderPostcard($matches[1]);
            }
        ],
        [
            'check' => '[friend-card',
            'pattern' => '/\[friend-card name="([^"]*)" ico="([^"]*)" url="([^"]*)"\](.*?)\[\/friend-card\]/s',
            'handler' => function ($matches) {
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
            }
        ],
        [
            // 面板
            'check' => '[collapsible-panel',
            'pattern' => '/\[collapsible-panel title="([^"]*)"\](.*?)\[\/collapsible-panel\]/s',
            'handler' => function ($matches) {
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
            }
        ],
        [
            // 时间线
            'check' => '[timeline',
            'pattern' => '/\[timeline\](.*?)\[\/timeline\]/s',
            'handler' => function ($matches) {
                $innerContent = $matches[1];
                $innerContent = preg_replace_callback('/\[timeline-event date="([^"]*)" title="([^"]*)"\](.*?)\[\/timeline-event\]/s', function ($eventMatches) {
                    $date = $eventMatches[1];
                    $title = $eventMatches[2];
                    $eventText = $eventMatches[3];
                    return "<div timeline-event date=\"$date\" title=\"$title\">$eventText</div>";
                }, $innerContent);
                return "<div id=\"timeline\">$innerContent</div>";
            }
        ],
        [
            // 选项卡
            'check' => '[tabs',
            'pattern' => '/\[tabs\](.*?)\[\/tabs\]/s',
            'handler' => function ($matches) use (&$tabsInstance) {
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
                    . '<button class="scroll-button left" aria-label="Left"><i class="icon icon-left-open"></i></button>'
                    . '<div class="tab-header dir-right" role="tablist">'
                    . implode('', $tabLinks)
                    . '<div class="tab-indicator"></div>'
                    . '</div>'
                    . '<button class="scroll-button right" aria-label="Right"><i class="icon icon-right-open"></i></button>'
                    . '</div>'
                    . '<div class="tab-content">'
                    . implode('', $tabPanes)
                    . '</div>'
                    . '</div>';
            }
        ],
        [
            // 媒体
            'check' => '[bilibili-card',
            'pattern' => '/\[bilibili-card bvid="([^"]*)"\]/',
            'handler' => function ($matches) {
                $bvid = $matches[1];
                $url = "//player.bilibili.com/player.html?bvid=$bvid&autoplay=0";
                return "\n        <div class='bilibili-card'>\n            <iframe src='$url' scrolling='no' border='0' frameborder='no' framespacing='0' allowfullscreen='true'></iframe>\n        </div>\n    ";
            }
        ]
    ];

    $content = applyShortcodes($content, $shortcodes);

    if (strpos($content, 'friendsboard-item') !== false) {
        // 友链卡片合并分组
        $content = preg_replace_callback('/(?:\s*<a[^>]*class="[^"]*friendsboard-item[^"]*"[^>]*>.*?<\/a>\s*)+/s', function ($matches) {
            return '<div class="friendsboard-list">' . trim($matches[0]) . '</div>';
        }, $content);
    }

    // 用 alt 生成 figure/figcaption
    if (strpos($content, '<img') !== false) {
        $pattern = '/<img.*?src=[\'\"](.*?)[\'\"].*?>/i';
        $content = preg_replace_callback($pattern, function ($matches) {
            if (strpos($matches[0], 'friends-card-avatar') !== false || strpos($matches[0], 'no-figcaption') !== false) {
                return $matches[0];
            }
            $alt = '';
            if (preg_match('/alt=[\'\"](.*?)[\'\"]/i', $matches[0], $alt_matches)) {
                $alt = $alt_matches[1];
            }

            if (!empty($alt)) {
                return '<figure>' . $matches[0] . '<figcaption>' . $alt . '</figcaption></figure>';
            }

            return $matches[0];
        }, $content);
    }

    return $content;
}

// ==================== 短代码渲染 ====================
// 基于短代码输出的 HTML 再加工

function parseAlerts($content)
{
    if (strpos($content, 'alert-type="') === false) {
        return $content;
    }

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

function parseWindows($content)
{
    if (strpos($content, 'window-type="') === false) {
        return $content;
    }

    $content = preg_replace_callback('/<div window-type="(.*?)" title="(.*?)">(.*?)<\/div>/', function ($matches) {
        $type = $matches[1];
        $title = $matches[2];
        $innerContent = $matches[3];
        return '<div class="window ' . $type . '"><div class="flex"><div class="window-prompt-wrap"><p class="window-prompt-heading">' . $title . '</p><div class="window-prompt-prompt"><p>' . $innerContent . '</p></div></div></div></div>';
    }, $content);
    return $content;
}

function parseTimeline($content)
{
    if (strpos($content, 'timeline-event') === false) {
        return $content;
    }

    $content = preg_replace_callback('/<div timeline-event date="(.*?)" title="(.*?)">(.*?)<\/div>/', function ($matches) {
        $date = $matches[1];
        $title = $matches[2];
        $innerContent = $matches[3];
        return '<div class="timeline-item"><div class="timeline-dot"></div><div class="timeline-content"><div class="timeline-date">' . $date . '</div><p class="timeline-title">' . $title . '</p><p class="timeline-description">' . $innerContent . '</p></div></div>';
    }, $content);
    return $content;
}

// PicGrid 画廊
function parsePicGrid($content)
{
    if (stripos($content, '[PicGrid]') === false) {
        return $content;
    }

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
