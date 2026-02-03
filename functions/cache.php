<?php
if (!defined('__TYPECHO_ROOT_DIR__'))
    exit;

// ==================== Cache Layer ====================
// L1: request memory cache
// L2: file cache under cache/

function isCacheEnabled()
{
    return !defined('PS_CACHE_DISABLED') || PS_CACHE_DISABLED === false;
}

function getCacheDir($group = 'theme')
{
    return dirname(__DIR__) . '/cache/' . $group;
}

function getCachePath($key, $group = 'theme')
{
    return getCacheDir($group) . '/' . md5($key) . '.json';
}

function &getCacheMemoryStore()
{
    static $memory = [];
    return $memory;
}

function getCacheMemory($group, $key, &$found = null)
{
    $memory = &getCacheMemoryStore();
    $cacheKey = $group . '|' . $key;
    if (array_key_exists($cacheKey, $memory)) {
        $found = true;
        return $memory[$cacheKey];
    }
    $found = false;
    return null;
}

function setCacheMemory($group, $key, $payload)
{
    $memory = &getCacheMemoryStore();
    $cacheKey = $group . '|' . $key;
    $memory[$cacheKey] = $payload;
}

function getCache($key, $ttl, $group = 'theme')
{
    $found = false;
    $memory = getCacheMemory($group, $key, $found);
    if ($found) {
        return $memory;
    }

    if (!isCacheEnabled()) {
        return null;
    }

    $path = getCachePath($key, $group);
    if (!is_file($path)) {
        return null;
    }

    $content = @file_get_contents($path);
    if ($content === false) {
        return null;
    }

    $cache = json_decode($content, true);
    if (!is_array($cache) || !array_key_exists('data', $cache)) {
        return null;
    }

    $cache['fresh'] = isset($cache['fetched_at']) && (time() - (int)$cache['fetched_at'] < $ttl);
    setCacheMemory($group, $key, $cache);
    return $cache;
}

function setCache($key, $data, $group = 'theme', array $meta = [])
{
    if (!isCacheEnabled()) {
        return;
    }

    $dir = getCacheDir($group);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    $payload = array_merge(
        [
            'fetched_at' => time(),
            'data' => $data
        ],
        $meta
    );

    @file_put_contents(
        getCachePath($key, $group),
        json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );

    $memoryPayload = $payload;
    $memoryPayload['fresh'] = true;
    setCacheMemory($group, $key, $memoryPayload);
}

// GitHub file cache (ETag + TTL)
function getGithubCache($key, $ttl)
{
    return getCache($key, $ttl, 'github');
}

function setGithubCache($key, $data, $etag = null)
{
    setCache($key, $data, 'github', ['etag' => $etag]);
}
