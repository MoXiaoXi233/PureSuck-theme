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

// GitHub repo card helpers
function ps_github_parse_repo($input)
{
    $input = trim((string)$input);
    if ($input === '') {
        return null;
    }

    $input = htmlspecialchars_decode($input, ENT_QUOTES);
    $input = trim($input);

    $owner = '';
    $repo = '';

    if (preg_match('~^(https?:)?//github\.com/([^/\s]+)/([^/\s\#?]+)~i', $input, $matches)) {
        $owner = $matches[2];
        $repo = $matches[3];
    } elseif (preg_match('~^github\.com/([^/\s]+)/([^/\s\#?]+)~i', $input, $matches)) {
        $owner = $matches[1];
        $repo = $matches[2];
    } elseif (preg_match('#^([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)$#', $input, $matches)) {
        $owner = $matches[1];
        $repo = $matches[2];
    }

    $repo = preg_replace('/\.git$/i', '', $repo);

    if ($owner === '' || $repo === '') {
        return null;
    }

    if (!preg_match('/^[A-Za-z0-9_.-]+$/', $owner) || !preg_match('/^[A-Za-z0-9_.-]+$/', $repo)) {
        return null;
    }

    return [
        'owner' => $owner,
        'repo' => $repo,
        'url' => 'https://github.com/' . $owner . '/' . $repo
    ];
}

function ps_github_parse_user($input)
{
    $input = trim((string)$input);
    if ($input === '') {
        return null;
    }

    $input = htmlspecialchars_decode($input, ENT_QUOTES);
    $input = trim($input);
    $input = preg_replace('~^https?://~i', '', $input);
    $input = preg_replace('~^//~', '', $input);

    if (stripos($input, 'github.com/') === 0) {
        $input = substr($input, strlen('github.com/'));
    }

    $input = preg_replace('/[?#].*$/', '', $input);
    $input = trim($input, "/ \t\n\r\0\x0B");

    if ($input === '' || strpos($input, '/') !== false) {
        return null;
    }

    if (!preg_match('/^[A-Za-z0-9-]+$/', $input)) {
        return null;
    }

    return [
        'user' => $input,
        'url' => 'https://github.com/' . $input
    ];
}

function ps_github_cache_dir()
{
    return dirname(__DIR__) . '/cache/github';
}

function ps_github_cache_path($key)
{
    return ps_github_cache_dir() . '/' . md5($key) . '.json';
}

function ps_github_cache_get($key, $ttl)
{
    $path = ps_github_cache_path($key);
    if (!is_file($path)) {
        return null;
    }

    $content = @file_get_contents($path);
    if ($content === false) {
        return null;
    }

    $cache = json_decode($content, true);
    if (!is_array($cache) || empty($cache['data'])) {
        return null;
    }

    $cache['fresh'] = isset($cache['fetched_at']) && (time() - (int)$cache['fetched_at'] < $ttl);
    return $cache;
}

function ps_github_cache_set($key, $data, $etag = null)
{
    $dir = ps_github_cache_dir();
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    $payload = [
        'fetched_at' => time(),
        'etag' => $etag,
        'data' => $data
    ];

    @file_put_contents(
        ps_github_cache_path($key),
        json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );
}

function ps_github_parse_headers($headers)
{
    $status = 0;
    $etag = null;

    if (!is_array($headers)) {
        return ['status' => $status, 'etag' => $etag];
    }

    foreach ($headers as $header) {
        if ($status === 0 && preg_match('#^HTTP/\\S+\\s+(\\d{3})#i', $header, $matches)) {
            $status = (int)$matches[1];
        }

        if ($etag === null && stripos($header, 'ETag:') === 0) {
            $etagValue = trim(substr($header, 5));
            $etag = trim($etagValue);
        }
    }

    return ['status' => $status, 'etag' => $etag];
}

function ps_github_fetch_repo($owner, $repo)
{
    $fullName = $owner . '/' . $repo;
    $cacheKey = 'repo:v2:' . $fullName;
    $ttl = 6 * 3600;
    $cache = ps_github_cache_get($cacheKey, $ttl);

    if ($cache && !empty($cache['fresh'])) {
        return ['data' => $cache['data'], 'stale' => false];
    }

    $headers = "User-Agent: PureSuck-Theme\r\nAccept: application/vnd.github+json\r\n";
    if ($cache && !empty($cache['etag'])) {
        $headers .= "If-None-Match: {$cache['etag']}\r\n";
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => $headers,
            'timeout' => 6
        ]
    ]);

    $url = "https://api.github.com/repos/{$owner}/{$repo}";
    $response = @file_get_contents($url, false, $context);
    $parsed = ps_github_parse_headers(isset($http_response_header) ? $http_response_header : []);
    $status = $parsed['status'];
    $etag = $parsed['etag'] ?: ($cache['etag'] ?? null);

    if ($status === 304 && $cache) {
        ps_github_cache_set($cacheKey, $cache['data'], $etag);
        return ['data' => $cache['data'], 'stale' => false];
    }

    if ($response !== false && $status >= 200 && $status < 300) {
        $data = json_decode($response, true);
        if (is_array($data) && isset($data['full_name'])) {
            $payload = [
                'name' => $data['name'] ?? $repo,
                'owner' => $data['owner']['login'] ?? $owner,
                'html_url' => $data['html_url'] ?? "https://github.com/{$owner}/{$repo}",
                'description' => $data['description'] ?? '',
                'stargazers_count' => (int)($data['stargazers_count'] ?? 0),
                'language' => $data['language'] ?? '',
                'updated_at' => $data['updated_at'] ?? ''
            ];
            ps_github_cache_set($cacheKey, $payload, $etag);
            return ['data' => $payload, 'stale' => false];
        }
    }

    if ($cache && !empty($cache['data'])) {
        return ['data' => $cache['data'], 'stale' => true, 'error' => $status];
    }

    return ['error' => $status];
}

function ps_github_fetch_user($user)
{
    $key = 'user:v2:' . $user;
    $ttl = 6 * 3600;
    $cache = ps_github_cache_get($key, $ttl);

    if ($cache && !empty($cache['fresh'])) {
        return ['data' => $cache['data'], 'stale' => false];
    }

    $headers = "User-Agent: PureSuck-Theme\r\nAccept: application/vnd.github+json\r\n";
    if ($cache && !empty($cache['etag'])) {
        $headers .= "If-None-Match: {$cache['etag']}\r\n";
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => $headers,
            'timeout' => 6
        ]
    ]);

    $url = "https://api.github.com/users/{$user}";
    $response = @file_get_contents($url, false, $context);
    $parsed = ps_github_parse_headers(isset($http_response_header) ? $http_response_header : []);
    $status = $parsed['status'];
    $etag = $parsed['etag'] ?: ($cache['etag'] ?? null);

    if ($status === 304 && $cache) {
        ps_github_cache_set($key, $cache['data'], $etag);
        return ['data' => $cache['data'], 'stale' => false];
    }

    if ($response !== false && $status >= 200 && $status < 300) {
        $data = json_decode($response, true);
        if (is_array($data) && isset($data['login'])) {
            $payload = [
                'login' => $data['login'],
                'name' => $data['name'] ?? '',
                'avatar_url' => $data['avatar_url'] ?? '',
                'html_url' => $data['html_url'] ?? "https://github.com/{$user}",
                'bio' => $data['bio'] ?? '',
                'followers' => (int)($data['followers'] ?? 0),
                'public_repos' => (int)($data['public_repos'] ?? 0)
            ];
            ps_github_cache_set($key, $payload, $etag);
            return ['data' => $payload, 'stale' => false];
        }
    }

    if ($cache && !empty($cache['data'])) {
        return ['data' => $cache['data'], 'stale' => true, 'error' => $status];
    }

    return ['error' => $status];
}

function ps_github_format_stars($stars)
{
    $stars = (int)$stars;
    if ($stars < 1000) {
        return (string)$stars;
    }

    if ($stars < 1000000) {
        $value = round($stars / 1000, 1);
        return rtrim(rtrim((string)$value, '0'), '.') . 'k';
    }

    if ($stars < 1000000000) {
        $value = round($stars / 1000000, 1);
        return rtrim(rtrim((string)$value, '0'), '.') . 'M';
    }

    $value = round($stars / 1000000000, 1);
    return rtrim(rtrim((string)$value, '0'), '.') . 'B';
}

function ps_github_language_color($language)
{
    $map = [
        'JavaScript' => '#f1e05a',
        'TypeScript' => '#3178c6',
        'Python' => '#3572A5',
        'PHP' => '#4F5D95',
        'Go' => '#00ADD8',
        'Rust' => '#dea584',
        'Java' => '#b07219',
        'C++' => '#f34b7d',
        'C#' => '#178600',
        'C' => '#555555',
        'HTML' => '#e34c26',
        'CSS' => '#563d7c',
        'Vue' => '#41b883',
        'Shell' => '#89e051',
        'Swift' => '#F05138',
        'Kotlin' => '#A97BFF',
        'Dart' => '#00B4AB',
        'Ruby' => '#701516'
    ];

    if ($language && isset($map[$language])) {
        return $map[$language];
    }

    return 'var(--themecolor)';
}

function ps_github_render_error($message, $url = '')
{
    $safeMessage = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    $safeUrl = $url ? htmlspecialchars($url, ENT_QUOTES, 'UTF-8') : '';

    $linkHtml = $safeUrl
        ? '<a class="github-card-error-link" href="' . $safeUrl . '" target="_blank" rel="noopener noreferrer">查看仓库</a>'
        : '';

    return '<div class="github-card github-card-error" role="status">'
        . '<div class="github-card-header">'
        . '<span class="github-card-icon"><i class="icon icon-github-circled"></i></span>'
        . '<div class="github-card-title-wrap">'
        . '<div class="github-card-title">GitHub Repo</div>'
        . '<div class="github-card-owner">加载失败</div>'
        . '</div>'
        . '</div>'
        . '<div class="github-card-desc">' . $safeMessage . '</div>'
        . ($linkHtml ? '<div class="github-card-meta">' . $linkHtml . '</div>' : '')
        . '</div>';
}

function ps_github_render_card($url)
{
    $userInfo = ps_github_parse_user($url);
    if ($userInfo) {
        $result = ps_github_fetch_user($userInfo['user']);
        if (empty($result['data'])) {
            if (isset($result['error']) && (int)$result['error'] === 404) {
                return ps_github_render_error('User not found.', $userInfo['url']);
            }
            if (isset($result['error']) && (int)$result['error'] === 403) {
                return ps_github_render_error('GitHub API rate limited.', $userInfo['url']);
            }
            return ps_github_render_error('Failed to fetch GitHub profile.', $userInfo['url']);
        }

        $data = $result['data'];
        $login = htmlspecialchars($data['login'] ?? $userInfo['user'], ENT_QUOTES, 'UTF-8');
        $name = trim((string)($data['name'] ?? ''));
        $title = $name !== '' ? htmlspecialchars($name, ENT_QUOTES, 'UTF-8') : $login;
        $bio = trim((string)($data['bio'] ?? ''));
        if ($bio === '') {
            $bio = 'No bio provided.';
        }
        $bio = htmlspecialchars($bio, ENT_QUOTES, 'UTF-8');
        $followers = ps_github_format_stars($data['followers'] ?? 0);
        $repos = (int)($data['public_repos'] ?? 0);
        $link = htmlspecialchars($data['html_url'] ?? $userInfo['url'], ENT_QUOTES, 'UTF-8');
        $avatar = trim((string)($data['avatar_url'] ?? ''));
        $mediaHtml = $avatar !== ''
            ? '<span class="github-card-media github-card-media-avatar"><img src="' . htmlspecialchars($avatar, ENT_QUOTES, 'UTF-8') . '" alt="' . $login . '" class="github-card-media-img no-zoom no-figcaption" loading="lazy"></span>'
            : '';

        return '<a class="github-card" href="' . $link . '" target="_blank" rel="noopener noreferrer">'
            . '<span class="github-card-layout">'
            . '<span class="github-card-content">'
            . '<span class="github-card-header">'
            . '<span class="github-card-icon"><i class="icon icon-github-circled"></i></span>'
            . '<span class="github-card-title-wrap">'
            . '<span class="github-card-title-row"><span class="github-card-title">' . $title . '</span><span class="github-card-badge github-card-badge-user">User</span></span>'
            . '<span class="github-card-owner">@' . $login . '</span>'
            . '</span>'
            . '</span>'
            . '<span class="github-card-desc">' . $bio . '</span>'
            . '<span class="github-card-meta">'
            . '<span class="meta-item">Followers ' . $followers . '</span>'
            . '<span class="meta-item">Repos ' . $repos . '</span>'
            . '</span>'
            . '</span>'
            . $mediaHtml
            . '</span>'
            . '</a>';
    }
    $repoInfo = ps_github_parse_repo($url);
    if (!$repoInfo) {
        return ps_github_render_error('GitHub 地址解析失败，请检查链接格式。');
    }

    $result = ps_github_fetch_repo($repoInfo['owner'], $repoInfo['repo']);
    if (empty($result['data'])) {
        if (isset($result['error']) && (int)$result['error'] === 404) {
            return ps_github_render_error('仓库不存在或无权限访问。', $repoInfo['url']);
        }
        if (isset($result['error']) && (int)$result['error'] === 403) {
            return ps_github_render_error('GitHub API 访问受限，请稍后重试。', $repoInfo['url']);
        }
        return ps_github_render_error('GitHub 数据获取失败，请稍后重试。', $repoInfo['url']);
    }

    $data = $result['data'];
    $name = htmlspecialchars($data['name'] ?? $repoInfo['repo'], ENT_QUOTES, 'UTF-8');
    $owner = htmlspecialchars($data['owner'] ?? $repoInfo['owner'], ENT_QUOTES, 'UTF-8');
    $desc = trim((string)($data['description'] ?? ''));
    if ($desc === '') {
        $desc = '暂无项目描述';
    }
    $desc = htmlspecialchars($desc, ENT_QUOTES, 'UTF-8');
    $stars = ps_github_format_stars($data['stargazers_count'] ?? 0);
    $language = trim((string)($data['language'] ?? ''));
    $languageLabel = $language !== '' ? htmlspecialchars($language, ENT_QUOTES, 'UTF-8') : 'Unknown';
    $languageColor = ps_github_language_color($language);
    $link = htmlspecialchars($data['html_url'] ?? $repoInfo['url'], ENT_QUOTES, 'UTF-8');
    $cacheBuster = '1';
    if (!empty($data['updated_at'])) {
        $timestamp = strtotime($data['updated_at']);
        if ($timestamp) {
            $cacheBuster = (string)$timestamp;
        }
    }
    $cover = 'https://opengraph.githubassets.com/' . $cacheBuster . '/' . rawurlencode($repoInfo['owner']) . '/' . rawurlencode($repoInfo['repo']);
    $mediaHtml = $cover !== ''
        ? '<span class="github-card-media github-card-media-cover"><img src="' . htmlspecialchars($cover, ENT_QUOTES, 'UTF-8') . '" alt="' . $name . '" class="github-card-media-img no-zoom no-figcaption" loading="lazy"></span>'
        : '';


    return '<a class="github-card" href="' . $link . '" target="_blank" rel="noopener noreferrer">'
        . '<span class="github-card-layout">'
        . '<span class="github-card-content">'
        . '<span class="github-card-header">'
        . '<span class="github-card-icon"><i class="icon icon-github-circled"></i></span>'
        . '<span class="github-card-title-wrap">'
        . '<span class="github-card-title-row"><span class="github-card-title">' . $name . '</span><span class="github-card-badge github-card-badge-repo">Repo</span></span>'
        . '<span class="github-card-owner">@' . $owner . '</span>'
        . '</span>'
        . '</span>'
        . '<span class="github-card-desc">' . $desc . '</span>'
        . '<span class="github-card-meta">'
        . '<span class="meta-item"><span class="github-card-star">&#9733;</span>' . $stars . '</span>'
        . '<span class="meta-item github-card-language">'
        . '<span class="github-card-language-dot" style="--lang-color: ' . $languageColor . ';"></span>'
        . $languageLabel
        . '</span>'
        . '</span>'
        . '</span>'
        . $mediaHtml
        . '</span>'
        . '</a>';
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

    $content = preg_replace_callback('/\[github\s+url="([^"]+)"\s*\]/i', function ($matches) {
        return ps_github_render_card($matches[1]);
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
        'no-zoom',
        'friends-card-avatar',
        'github-card-media-img',
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
