<?php if ($this->allow('comment')): ?>
    <?php $this->header('commentReply=1&description=0&keywords=0&generator=0&template=0&pingback=0&xmlrpc=0&wlw=0&rss2=0&rss1=0&antiSpam=0&atom'); ?>

    <?php
    function threadedComments($comments, $options)
    {
        $cl = $comments->levels > 0 ? 'c_c' : 'c_p';
        $isAdmin = $comments->authorId == 1;
        $author = $comments->url ? '<a href="' . $comments->url . '" target="_blank" rel="external nofollow">' . $comments->author . '</a>' : $comments->author;
        ?>
        <li id="li-<?php $comments->theId(); ?>" class="<?= $cl; ?>">
            <div id="<?php $comments->theId(); ?>">
                <?php $avatarUrl = 'https://cn.cravatar.com/avatar/' . md5(strtolower($comments->mail)) . '?s=128&d=mm'; ?>
                <img class="avatarcc" src="<?= $avatarUrl; ?>" loading="lazy" alt="评论头像" />
                <div class="cp">
                    <?php
                    $status = isset($comments->status) ? $comments->status : null;
                    // status 拿不到时，就尽量保守：不显示提示（避免误伤正常评论）
                    // 如果能拿到 status，并且不是 approved，就提示待审核/被屏蔽
                    if ($status && $status !== 'approved'):
                        ?>
                        <div class="cp-waiting">这条评论正在等待审核，审核通过后将对所有人可见。</div>
                    <?php endif; ?>

                    <?= parseOwOcodes($comments->content); ?>
                    <div class="cm">
                        <span class="ca"><?= $author; ?></span>
                        <?php if ($isAdmin): ?>
                            <span class="badge">博主</span>
                        <?php endif; ?>
                        <?php $comments->date(); ?>
                        <span class="cr">
                            <?php $comments->reply('回复'); ?>
                        </span>
                    </div>
                </div>
            </div>
            <?php if ($comments->children) { ?>
                <div class="children">
                    <?php $comments->threadedComments($options); ?>
                </div>
            <?php } ?>
        </li>
    <?php } ?>

    <div id="comments" class="cf">
        <?php $this->comments()->to($comments); ?>
        <!-- ★ 评论列表容器（可单独刷新） -->
        <div id="comments-list">
            <?php if ($comments->have()): ?>
                <h1 class="comment-title">
                    <?php $this->commentsNum(_t('暂无评论'), _t('仅有 1 条评论'), _t('已有 %d 条评论')); ?>
                </h1>
                <?php $comments->listComments(); ?>
                <div class="page-navigator">
                    <?php $comments->pageNav('上一页', '下一页', 10, '...', array('wrapTag' => 'ul', 'wrapClass' => 'pagination', 'itemTag' => 'li', 'currentClass' => 'active')); ?>
                </div>
            <?php endif; ?>
        </div>
        <!-- ★ 评论表单（不刷新，保持OwO实例） -->
        <div id="<?php $this->respondId(); ?>" class="respond">
            <div class="ccr">
                <?php $comments->cancelReply('取消'); ?>
            </div>
            <div class="response comment-title icon-chat">发表新评论</div>
            <form method="post" action="<?php $this->commentUrl() ?>" id="cf" no-pjax>
                <?php if ($this->user->hasLogin()): ?>
                    <span>亲爱的<a href="<?php $this->options->profileUrl(); ?>">
                            <?php $this->user->screenName(); ?>
                        </a>~ <a href="<?php $this->options->logoutUrl(); ?>" title="Logout">退出 &raquo;</a>
                    </span>
                <?php else: ?>
                    <?php if ($this->remember('author', true) != "" && $this->remember('mail', true) != ""): ?>
                        <span>欢迎回来，<?php $this->remember('author'); ?></span>
                    <?php endif; ?>
                    <div class="ainfo">
                        <div class="tbox-container">
                            <div class="tbox">
                                <input type="text" name="author" id="author" class="ci" placeholder="您的昵称"
                                    value="<?php $this->remember('author'); ?>" required="">
                            </div>
                            <div class="tbox">
                                <input type="email" name="mail" id="mail" class="ci" placeholder="邮箱地址"
                                    value="<?php $this->remember('mail'); ?>" required="">
                            </div>
                            <div class="tbox">
                                <input type="url" name="url" id="url" class="ci" placeholder="您的网站（选填）"
                                    value="<?php $this->remember('url'); ?>">
                            </div>
                        </div>
                    </div>
                <?php endif; ?>
                <div class="tbox">
                    <textarea name="text" id="textarea" class="ci OwO-textarea" placeholder="请在这里输入您的评论内容"
                        data-owo-id="comment-textarea-<?php $this->cid(); ?>" required><?php $this->remember('text'); ?></textarea>
                    <div class="CtBoxBar">
                        <div class="left-bar">
                            <div class="OwO-bar">
                                <div class="OwO" data-owo-id="comment-owo-<?php $this->cid(); ?>"></div>
                            </div>
                            <!-- 未来可以在这里添加更多内容 -->
                        </div>
                        <button type="submit" class="submit" id="submit">提交评论</button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <!-- CSS引入 -->
    <link rel="stylesheet" href="<?= $this->options->themeUrl('css/OwO.min.css'); ?>">

<?php else: ?>
    <div>
        <h3><?php _e('评论已关闭'); ?></h3>
        <div>
        <?php endif; ?>