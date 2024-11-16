<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>

<?php if ($this->allow('comment')): ?>
    <script>
        function tg_c(id, nc) {
            var e = document.getElementById(id);
            var c = e.className;
            if (!c) {
                e.className = nc;
            } else {
                var classArr = c.split(' ');
                var exist = false;
                for (var i = 0; i < classArr.length; i++) {
                    if (classArr[i] === nc) {
                        classArr.splice(i, 1);
                        e.className = Array.prototype.join.call(classArr, " ");
                        exist = true;
                        break;
                    }
                }
                if (!exist) {
                    classArr.push(nc);
                    e.className = Array.prototype.join.call(classArr, " ");
                }
            }
        }
    </script>

    <?php
    function threadedComments($comments, $options)
    {
        $cl = $comments->levels > 0 ? 'c_c' : 'c_p';
        $isAdmin = $comments->authorId == 1; // 判断评论者是否是站长
        $author = $comments->url ? '<a href="' . $comments->url . '" target="_blank" rel="external nofollow">' . $comments->author . '</a>' : $comments->author;
    ?>
        <li id="li-<?php $comments->theId(); ?>" class="<?php echo $cl; ?>">
            <div id="<?php $comments->theId(); ?>">
                <?php $avatarUrl = 'https://cn.cravatar.com/avatar/' . md5(strtolower($comments->mail)) . '?s=128&d=mm'; ?>
                <img class="avatarcc" src="<?php echo $avatarUrl; ?>" loading="lazy" alt="评论头像" />
                <div class="cp">
                    <?php echo parseOwOcodes($comments->content); ?>
                    <div class="cm">
                        <span class="ca"><?php echo $author; ?></span>
                        <?php if ($isAdmin): ?>
                            <span class="badge">博主</span>
                        <?php endif; ?>
                        <?php $comments->date(); ?>
                        <span class="cr">
                            <?php $comments->reply(); ?>
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
        <?php if ($comments->have()): ?>
            <div class="comment-title">
                <?php $this->commentsNum(_t('暂无评论'), _t('仅有 1 条评论'), _t('已有 %d 条评论')); ?>
            </div>
            <?php $comments->listComments(); ?>
            <div class="page-navigator">
                <?php $comments->pageNav('上一页', '下一页', 10, '...', array('wrapTag' => 'ul', 'wrapClass' => 'pagination', 'itemTag' => 'li', 'currentClass' => 'active')); ?>
            </div>
        <?php endif; ?>
        <div id="<?php $this->respondId(); ?>" class="respond">
            <div class="ccr">
                <?php $comments->cancelReply(); ?>
            </div>
            <div id="<?php $this->respondId(); ?>" class="respond">
                <div class="ccr">
                    <?php $comments->cancelReply(); ?>
                </div>
                <div class="response comment-title icon-chat">发表新评论</div>
                <form method="post" action="<?php $this->commentUrl() ?>" id="cf">
                    <?php if ($this->user->hasLogin()): ?>
                        <span>亲爱的<a href="<?php $this->options->profileUrl(); ?>">
                                <?php $this->user->screenName(); ?>
                            </a>~ <a href="<?php $this->options->logoutUrl(); ?>" title="Logout">退出 &raquo;</a>
                        </span>
                    <?php else: ?>
                        <?php if ($this->remember('author', true) != "" && $this->remember('mail', true) != ""): ?>
                            <span>欢迎
                                <?php $this->remember('author'); ?> 回来~
                            </span>
                        <?php endif; ?>
                        <div class="ainfo">
                            <div class="tbox-container">
                                <div class="tbox">
                                    <input type="text" name="author" id="author" class="ci" placeholder="您的昵称" value="<?php $this->remember('author'); ?>" required="">
                                </div>
                                <div class="tbox">
                                    <input type="email" name="mail" id="mail" class="ci" placeholder="邮箱地址" value="<?php $this->remember('mail'); ?>" required="">
                                </div>
                                <div class="tbox">
                                    <input type="url" name="url" id="url" class="ci" placeholder="您的网站（选填）" value="<?php $this->remember('url'); ?>">
                                </div>
                            </div>
                        </div>
                    <?php endif; ?>
                    <div class="tbox">
                        <textarea name="text" id="textarea" class="ci OwO-textarea" onkeydown="if(event.ctrlKey&&event.keyCode==13){document.getElementById('submit').click();return false};" placeholder="请在这里输入您的评论内容" required><?php $this->remember('text', false); ?></textarea>
                        <div class="CtBoxBar">
                            <div class="left-bar">
                                <div class="OwO-bar">
                                    <div class="OwO"></div>
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
        <script src="<?php $this->options->themeUrl('/js/OwO.min.js'); ?>"></script>
        <script>
            function initializeCommentsOwO() {
                var OwO_demo = new OwO({
                    logo: 'OωO表情',
                    container: document.getElementsByClassName('OwO')[0],
                    target: document.getElementsByClassName('OwO-textarea')[0],
                    api: '/usr/themes/PureSuck/js/OwO.json',
                    position: 'up',
                    width: '100%',
                    maxHeight: '260px'
                });

                var owoButton = document.getElementById('owo-button');
                if (owoButton) {
                    owoButton.addEventListener('click', function(event) {
                        OwO_demo.toggle();
                    });
                }
            }

            initializeCommentsOwO()
        </script>
    <?php else: ?>
        <div>
            <h3><?php _e('评论已关闭'); ?></h3>
            <div>
            <?php endif; ?>