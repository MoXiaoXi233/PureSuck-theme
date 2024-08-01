<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>

<script>function tg_c(id,nc){var e=document.getElementById(id);var c=e.className;if(!c){e.className=nc}else{var classArr=c.split(' ');var exist=false;for(var i=0;i<classArr.length;i++){if(classArr[i]===nc){classArr.splice(i,1);e.className=Array.prototype.join.call(classArr," ");exist=true;break}}if(!exist){classArr.push(nc);e.className=Array.prototype.join.call(classArr," ")}}}</script>
<?php function threadedComments($comments, $options) {
    $cl = $comments->levels > 0 ? 'c_c' : 'c_p';
    $author = $comments->url ? '<a href="' . $comments->url . '"'.'" target="_blank"' . ' rel="external">' . $comments->author . '</a>' : $comments->author;
?>
<li id="li-<?php $comments->theId();?>" class="<?php echo $cl;?>">
	<div id="<?php $comments->theId(); ?>">
		<?php $a = 'https://gravatar.loli.net/avatar/' . md5(strtolower($comments->mail)) . '?s=80&r=X&d=mm';?>
		<img class="avatarcc" src="<?php echo $a ?>" alt="<?php echo $comments->author; ?>" />
		<div class="cp">
<?php $comments->content(); ?>
			<div class="cm">
				<span class="ca">
					<?php echo $author ?>
				</span>
				<?php $comments->date(); ?>
				<span class="cr">
					<?php $comments->reply(); ?>
				</span>
			</div>
		</div>
	</div>
	<?php if ($comments->children){ ?>
	<div class="children">
		<?php $comments->threadedComments($options); ?>
	</div>
	<?php } ?>
</li>
<?php } ?>
<div id="comments" class="cf">
	<?php $this->comments()->to($comments); ?>
	<?php if ($comments->have()): ?>
	<h4>
		<?php $this->commentsNum(_t('暂无评论'), _t('仅有 1 条评论'), _t('已有 %d 条评论')); ?>
	</h4>
	<?php $comments->listComments(); ?>
	<?php $comments->pageNav('&laquo;', '&raquo;'); ?>
	<?php endif; ?>
	<div id="<?php $this->respondId(); ?>" class="respond">
		<div class="ccr">
			<?php $comments->cancelReply(); ?>
		</div>
		<h4 class="response">发表新评论</h4>
		<form method="post" action="<?php $this->commentUrl() ?>" id="cf" role="form">
			<?php if($this->user->hasLogin()): ?>
			<span>已登入<a href="<?php $this->options->profileUrl(); ?>">
					<?php $this->user->screenName(); ?>
				</a>. <a href="<?php $this->options->logoutUrl(); ?>" title="Logout">退出 &raquo;</a>
			</span>
			<?php else: ?>
			<?php if($this->remember('author',true) != "" && $this->remember('mail',true) != "") : ?>
			<span>欢迎
				<?php $this->remember('author'); ?>回来 | <small style="cursor: pointer;" onclick="tg_c('ainfo','hinfo');">修改资料</small>
			</span>
			<div id="ainfo" class="ainfo hinfo">
				<?php else : ?>
				<div class="ainfo">
					<?php endif ; ?>
					<div class="tbox">
						<input type="text" name="author" id="author" class="ci" placeholder="您的昵称" value="<?php $this->remember('author'); ?>" required>
						<input type="email" name="mail" id="mail" class="ci" placeholder="邮箱地址" value="<?php $this->remember('mail'); ?>" <?php if ($this->options->commentsRequireMail): ?> required
						<?php endif; ?>>
						<input type="url" name="url" id="url" class="ci" placeholder="您的网站" value="<?php $this->remember('url'); ?>" <?php if ($this->options->commentsRequireURL): ?> required
						<?php endif; ?>>
					</div>
				</div>
				<?php endif; ?>
									<a href="javascript: void(0);"class="btn btn-sm btn-primary OwO-logo" rel="external nofollow"><i class="mdi mdi-emoticon-wink-outline"></i></a>
<div class="OwO"></div>
				<div class="tbox">
					<textarea name="text" id="textarea" class="ci OwO-textarea" onkeydown="if(event.ctrlKey&&event.keyCode==13){document.getElementById('submit').click();return false};" placeholder="请在这里输入您的评论内容" required><?php $this->remember('text',false); ?></textarea>
				</div>
				<button type="submit" class="submit" id="submit">提交评论</button>
		</form>
	</div>
</div>

	<!-- CSS引入 -->
    <link rel="stylesheet" href="<?= $this->options->themeUrl('css/OwO.min.css'); ?>">
    <script src="<?php $this->options->themeUrl('/js/OwO.min.js'); ?>"></script>
    <script>
        var OwO_demo = new OwO({
            logo: 'OωO表情',
            container: document.getElementsByClassName('OwO')[0],
            target: document.getElementsByClassName('OwO-textarea')[0],
            api: '/usr/themes/PureSuck/js/OwO.json',
            position: 'down',
            width: '100%',
            maxHeight: '260px'
        });
    </script>