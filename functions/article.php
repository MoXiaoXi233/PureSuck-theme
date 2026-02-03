<?php
if (!defined('__TYPECHO_ROOT_DIR__'))
    exit;

// ==================== 模块索引 ====================
// 1) 文章字段与目录
// 2) GitHub 卡片
// 3) 文章卡片
// 4) 媒体与表格增强
// 5) OwO 表情





// ==================== 1) 文章字段与目录 ====================
// 包含：TOC 目录、文章字段

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
function generateToc($content)
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



// ==================== 2) GitHub 卡片 ====================
// 解析 GitHub 链接/输入
// GitHub 数据获取与渲染

function parseGithubRepo($input)
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

function parseGithubUser($input)
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

function parseGithubHeaders($headers)
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

function fetchGithubRepo($owner, $repo)
{
    $fullName = $owner . '/' . $repo;
    $cacheKey = 'repo:v2:' . $fullName;
    $ttl = 6 * 3600;
    $cache = getGithubCache($cacheKey, $ttl);

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
    $parsed = parseGithubHeaders(isset($http_response_header) ? $http_response_header : []);
    $status = $parsed['status'];
    $etag = $parsed['etag'] ?: ($cache['etag'] ?? null);

    if ($status === 304 && $cache) {
        setGithubCache($cacheKey, $cache['data'], $etag);
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
            setGithubCache($cacheKey, $payload, $etag);
            return ['data' => $payload, 'stale' => false];
        }
    }

    if ($cache && !empty($cache['data'])) {
        return ['data' => $cache['data'], 'stale' => true, 'error' => $status];
    }

    return ['error' => $status];
}

function fetchGithubUser($user)
{
    $key = 'user:v2:' . $user;
    $ttl = 6 * 3600;
    $cache = getGithubCache($key, $ttl);

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
    $parsed = parseGithubHeaders(isset($http_response_header) ? $http_response_header : []);
    $status = $parsed['status'];
    $etag = $parsed['etag'] ?: ($cache['etag'] ?? null);

    if ($status === 304 && $cache) {
        setGithubCache($key, $cache['data'], $etag);
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
            setGithubCache($key, $payload, $etag);
            return ['data' => $payload, 'stale' => false];
        }
    }

    if ($cache && !empty($cache['data'])) {
        return ['data' => $cache['data'], 'stale' => true, 'error' => $status];
    }

    return ['error' => $status];
}

function formatGithubStars($stars)
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

function getGithubLanguageColor($language)
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

function renderGithubError($message, $url = '')
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

function renderGithubCard($url)
{
    $userInfo = parseGithubUser($url);
    if ($userInfo) {
        $result = fetchGithubUser($userInfo['user']);
        if (empty($result['data'])) {
            if (isset($result['error']) && (int)$result['error'] === 404) {
                return renderGithubError('User not found.', $userInfo['url']);
            }
            if (isset($result['error']) && (int)$result['error'] === 403) {
                return renderGithubError('GitHub API rate limited.', $userInfo['url']);
            }
            return renderGithubError('Failed to fetch GitHub profile.', $userInfo['url']);
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
        $followers = formatGithubStars($data['followers'] ?? 0);
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
    $repoInfo = parseGithubRepo($url);
    if (!$repoInfo) {
        return renderGithubError('GitHub 地址解析失败，请检查链接格式。');
    }

    $result = fetchGithubRepo($repoInfo['owner'], $repoInfo['repo']);
    if (empty($result['data'])) {
        if (isset($result['error']) && (int)$result['error'] === 404) {
            return renderGithubError('仓库不存在或无权限访问。', $repoInfo['url']);
        }
        if (isset($result['error']) && (int)$result['error'] === 403) {
            return renderGithubError('GitHub API 访问受限，请稍后重试。', $repoInfo['url']);
        }
        return renderGithubError('GitHub 数据获取失败，请稍后重试。', $repoInfo['url']);
    }

    $data = $result['data'];
    $name = htmlspecialchars($data['name'] ?? $repoInfo['repo'], ENT_QUOTES, 'UTF-8');
    $owner = htmlspecialchars($data['owner'] ?? $repoInfo['owner'], ENT_QUOTES, 'UTF-8');
    $desc = trim((string)($data['description'] ?? ''));
    if ($desc === '') {
        $desc = '暂无项目描述';
    }
    $desc = htmlspecialchars($desc, ENT_QUOTES, 'UTF-8');
    $stars = formatGithubStars($data['stargazers_count'] ?? 0);
    $language = trim((string)($data['language'] ?? ''));
    $languageLabel = $language !== '' ? htmlspecialchars($language, ENT_QUOTES, 'UTF-8') : 'Unknown';
    $languageColor = getGithubLanguageColor($language);
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

// ==================== 3) 文章卡片 ====================
// 解析文章卡片输入与渲染

// 解析文章卡片输入
function parsePostcardIdentifier($input)
{
    $value = trim((string)$input);
    if ($value === '') {
        return null;
    }

    $value = htmlspecialchars_decode($value, ENT_QUOTES);
    $value = trim($value);

    return [
        'raw' => $value,
        'url' => $value
    ];
}

// 规范化输入为路由可识别路径
function normalizePostcardPath($value)
{
    $value = trim((string)$value);
    if ($value === '') {
        return '';
    }

    $path = $value;
    $host = null;

    static $options = null;
    static $siteHost = null;
    static $rootPath = null;
    static $localSet = ['localhost', '127.0.0.1'];

    if ($options === null) {
        $options = Typecho_Widget::widget('Widget_Options');
        $siteHost = parse_url($options->siteUrl, PHP_URL_HOST);
        $siteHost = $siteHost ? strtolower($siteHost) : '';
        $rootPath = parse_url($options->rootUrl, PHP_URL_PATH) ?? '';
        $rootPath = rtrim($rootPath, '/');
    }

    if (preg_match('~^(https?:)?//~i', $value)) {
        $parts = parse_url($value);
        $host = $parts['host'] ?? null;
        $path = $parts['path'] ?? '';
    } elseif (strpos($value, '/') !== false) {
        $first = strtok($value, '/');
        $rest = substr($value, strlen($first));
        $firstLower = strtolower($first);
        $hostCandidates = $localSet;
        if ($siteHost !== '') {
            $hostCandidates[] = $siteHost;
        }
        $firstNoPort = preg_replace('/:\d+$/', '', $firstLower);
        if (in_array($firstLower, $hostCandidates, true) || in_array($firstNoPort, $hostCandidates, true)) {
            $host = $firstLower;
            $path = $rest !== '' ? $rest : '/';
        }
    }

    if ($host && $siteHost) {
        $hostOnly = strtolower(preg_replace('/:\d+$/', '', $host));
        if ($hostOnly !== $siteHost) {
            if (!(in_array($hostOnly, $localSet, true) && in_array($siteHost, $localSet, true))) {
                return '';
            }
        }
    }

    $path = preg_replace('/[?#].*$/', '', (string)$path);
    $path = '/' . ltrim($path, '/');
    $path = rtrim($path, '/');
    if ($path === '') {
        $path = '/';
    }

    if ($rootPath !== '' && $rootPath !== '/') {
        if (strpos($path, $rootPath . '/') === 0) {
            $path = substr($path, strlen($rootPath));
            $path = '/' . ltrim($path, '/');
        } elseif ($path === $rootPath) {
            $path = '/';
        }
    }

    if (preg_match('#^/[^/]+\.php(?:/|$)#', $path, $match)) {
        $script = rtrim($match[0], '/');
        $path = substr($path, strlen($script));
        $path = $path === '' ? '/' : '/' . ltrim($path, '/');
    }

    return $path;
}

function buildPostcardWidgetFromResolved($resolved, $path)
{
    if ($resolved === null) {
        return null;
    }

    $widget = null;

    if (isset($resolved['routeKey'])) {
        $routeKey = $resolved['routeKey'];
        $params = isset($resolved['params']) && is_array($resolved['params']) ? $resolved['params'] : [];
        $alias = 'postcard_route_' . md5($routeKey . '|' . $path);
        $widget = Typecho_Widget::widget(
            'Widget_Archive@' . $alias,
            ['type' => $routeKey],
            $params,
            false
        );
    } elseif (isset($resolved['cid'])) {
        $alias = 'postcard_' . (int)$resolved['cid'];
        $widget = Typecho_Widget::widget(
            'Widget_Archive@' . $alias,
            ['type' => 'single'],
            ['cid' => (int)$resolved['cid']],
            false
        );
    } elseif (isset($resolved['slug'])) {
        $slug = (string)$resolved['slug'];
        $alias = 'postcard_' . md5($slug);
        $widget = Typecho_Widget::widget(
            'Widget_Archive@' . $alias,
            ['type' => 'single'],
            ['slug' => $slug],
            false
        );
    }

    if ($widget && $widget->have()) {
        if (method_exists($widget, 'is') && !$widget->is('single')) {
            return null;
        }
        return $widget;
    }

    return null;
}

// 将 URL/路径解析为文章组件
// 优先走路由表，不触发 Router::match
function fetchPostcardWidgetByUrl($url)
{
    static $routeCache = null;
    static $resolveCache = [];

    $path = normalizePostcardPath($url);
    if ($path === '') {
        return null;
    }

    $path = '/' . ltrim($path, '/');
    $path = urldecode($path);

    if (array_key_exists($path, $resolveCache)) {
        return buildPostcardWidgetFromResolved($resolveCache[$path], $path);
    }

    if ($routeCache === null) {
        $options = Typecho_Widget::widget('Widget_Options');
        $routingTable = $options->routingTable;
        $parsedRoutes = is_array($routingTable) && isset($routingTable[0]) ? $routingTable[0] : null;
        $routeCache = is_array($parsedRoutes) ? $parsedRoutes : false;
    }

    if ($routeCache === false) {
        $resolveCache[$path] = null;
        return null;
    }

    $resolved = null;

    foreach ($routeCache as $routeKey => $route) {
        if (empty($route['regx']) || empty($route['widget'])) {
            continue;
        }

        if (!preg_match($route['regx'], $path, $matches)) {
            continue;
        }

        if (stripos($route['widget'], 'Widget_Archive') !== 0) {
            continue;
        }

        $params = [];
        if (!empty($route['params'])) {
            unset($matches[0]);
            if (count($route['params']) != count($matches)) {
                continue;
            }
            $params = array_combine($route['params'], $matches);
            if ($params === false) {
                continue;
            }
        }

        $resolved = [
            'routeKey' => $routeKey,
            'params' => $params
        ];
        break;
    }

    if ($resolved === null) {
        $last = trim(basename(rtrim($path, '/')));
        if ($last !== '') {
            if (ctype_digit($last)) {
                $resolved = ['cid' => (int)$last];
            } else {
                $resolved = ['slug' => $last];
            }
        }
    }

    $resolveCache[$path] = $resolved;
    return buildPostcardWidgetFromResolved($resolved, $path);
}


// 摘要裁剪与净化
function trimPostcardText($text, $length = 90)
{
    $text = trim((string)$text);
    if ($text === '') {
        return '';
    }

    $text = html_entity_decode($text, ENT_QUOTES, 'UTF-8');
    $text = strip_tags($text);
    $text = preg_replace('/\s+/u', ' ', $text);
    $text = trim($text);

    if ($text === '') {
        return '';
    }

    if (class_exists('Typecho_Common')) {
        $text = Typecho_Common::subStr($text, 0, $length, '...');
    } elseif (function_exists('mb_substr')) {
        if (mb_strlen($text, 'UTF-8') > $length) {
            $text = mb_substr($text, 0, $length, 'UTF-8') . '...';
        }
    } elseif (strlen($text) > $length) {
        $text = substr($text, 0, $length) . '...';
    }

    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

function fetchPostcardWidget(array $identifier)
{
    $widget = null;

    if (!empty($identifier['url'])) {
        $widget = fetchPostcardWidgetByUrl($identifier['url']);
    }

    if ($widget && $widget->have()) {
        $widget->next();
        return $widget;
    }

    return null;
}

// 渲染文章卡片 HTML
function renderPostcard($input)
{
    static $renderCache = [];
    $cacheKey = trim((string)$input);
    if ($cacheKey !== '' && array_key_exists($cacheKey, $renderCache)) {
        return $renderCache[$cacheKey];
    }

    $identifier = parsePostcardIdentifier($input);
    if (!$identifier) {
        return '';
    }

    $widget = fetchPostcardWidget($identifier);
    if (!$widget) {
        $safeInput = htmlspecialchars($identifier['raw'] ?? '', ENT_QUOTES, 'UTF-8');
        $result = '<div class="ps-post-card ps-post-card-error" role="status">'
            . '<div class="ps-post-card-header">'
            . '<span class="ps-post-card-icon"><i class="icon icon-article"></i></span>'
            . '<div class="ps-post-card-title-wrap">'
            . '<div class="ps-post-card-title">Post</div>'
            . '<div class="ps-post-card-owner">Not Found</div>'
            . '</div>'
            . '</div>'
            . '<div class="ps-post-card-excerpt">Unable to locate the linked post.</div>'
            . ($safeInput !== '' ? '<span class="ps-post-card-meta"><span class="meta-item">' . $safeInput . '</span></span>' : '')
            . '</div>';
        if ($cacheKey !== '') {
            $renderCache[$cacheKey] = $result;
        }
        return $result;
    }

    $title = htmlspecialchars($widget->title, ENT_QUOTES, 'UTF-8');
    $permalink = htmlspecialchars($widget->permalink, ENT_QUOTES, 'UTF-8');

    $excerpt = '';
    if ($widget->hidden) {
        $excerpt = 'This post is protected.';
    } elseif (isset($widget->fields) && !empty($widget->fields->desc)) {
        $excerpt = trimPostcardText($widget->fields->desc, 90);
    } else {
        $excerpt = trimPostcardText($widget->plainExcerpt ?? $widget->excerpt ?? $widget->text, 90);
    }

    if ($excerpt === '') {
        $excerpt = 'No summary available.';
    }

    $dateText = '';
    if ($widget->date) {
        $dateText = $widget->date->format($widget->options->dateFormat ?? 'Y-m-d');
    }
    $dateText = htmlspecialchars((string)$dateText, ENT_QUOTES, 'UTF-8');

    $categoryText = '';
    if (!empty($widget->categories) && isset($widget->categories[0]['name'])) {
        $categoryText = htmlspecialchars($widget->categories[0]['name'], ENT_QUOTES, 'UTF-8');
    }

    $tagTexts = [];
    if (!empty($widget->tags) && is_array($widget->tags)) {
        foreach ($widget->tags as $tag) {
            if (isset($tag['name']) && $tag['name'] !== '') {
                $tagTexts[] = htmlspecialchars($tag['name'], ENT_QUOTES, 'UTF-8');
            }
            if (count($tagTexts) >= 2) {
                break;
            }
        }
    }

    $badgeText = $widget->hidden ? 'Protected' : 'Post';

    $metaItems = '';
    if ($dateText !== '') {
        $metaItems .= '<span class="meta-item"><i class="icon icon-clock"></i>' . $dateText . '</span>';
    }
    if ($categoryText !== '') {
        $metaItems .= '<span class="meta-item"><i class="icon icon-article"></i>' . $categoryText . '</span>';
    }
    if (!empty($tagTexts)) {
        $metaItems .= '<span class="meta-item"><i class="icon icon-hashtag"></i>' . implode(' / ', $tagTexts) . '</span>';
    }
    $metaHtml = $metaItems !== '' ? '<span class="ps-post-card-meta">' . $metaItems . '</span>' : '';

    $coverHtml = '';
    if (isset($widget->fields) && !empty($widget->fields->img)) {
        $coverUrl = htmlspecialchars($widget->fields->img, ENT_QUOTES, 'UTF-8');
        $coverHtml = '<span class="ps-post-card-cover">'
            . '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"'
            . ' data-lazy-src="' . $coverUrl . '" alt="' . $title . '"'
            . ' class="ps-post-card-cover-img no-zoom no-figcaption" loading="lazy" decoding="async">'
            . '</span>';
    }

    $result = '<a class="ps-post-card" href="' . $permalink . '">'
        . '<span class="ps-post-card-layout">'
        . '<span class="ps-post-card-body">'
        . '<span class="ps-post-card-header">'
        . '<span class="ps-post-card-icon"><i class="icon icon-article"></i></span>'
        . '<span class="ps-post-card-title-wrap">'
        . '<span class="ps-post-card-title-row">'
        . '<span class="ps-post-card-title">' . $title . '</span>'
        . '<span class="ps-post-card-badge">' . htmlspecialchars($badgeText, ENT_QUOTES, 'UTF-8') . '</span>'
        . '</span>'
        . '</span>'
        . '</span>'
        . '<span class="ps-post-card-excerpt">' . $excerpt . '</span>'
        . $metaHtml
        . '</span>'
        . $coverHtml
        . '</span>'
        . '</a>';

    if ($cacheKey !== '') {
        $renderCache[$cacheKey] = $result;
    }

    return $result;
}




// ==================== 4) 媒体与表格增强 ====================
// 图像、表格等内容增强

function addZoomableToImages($content)
{
    if (strpos($content, '<img') === false) {
        return $content;
    }

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

// 表格包裹滚动容器
function wrapTables($content)
{
    return preg_replace(
        '/<table\b[^>]*>.*?<\/table>/is',
        '<div class="table-scroll">$0</div>',
        $content
    );
}

// ==================== 5) OwO 表情 ====================
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
