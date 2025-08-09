![Banner](https://s2.loli.net/2024/08/05/M4FTuyI2b7aU3Ag.png)
# PureSuck-Theme
![Static Badge](https://img.shields.io/github/v/release/MoXiaoXi233/PureSuck-theme)
![Static Badge](https://img.shields.io/badge/LICENSE-MIT-green)
![Static Badge](https://img.shields.io/badge/AUTHOR-MoXiify-pink)  
PureSuck，干净，纯洁，淡雅朴素的typecho主题。  
由于是第一次正经意义上的做一个项目，遇到问题欢迎反馈解决。  
另外主题样式和基调还在不断迭代中，可能会遇到版本更新后样式发生变化的情况  
感谢你的使用！
## 外观
可以前往[希记](https://note.moxiify.cn)查看最新版演示效果  
主题本身有四种强调色可以选择，同时内置几种多彩的小组件（欢迎issues提交建议）  
![PureSuck](https://s2.loli.net/2025/07/13/BvewG6DAnUrF7Pi.png)
## TODO
- [x] Pjax
- [ ] 重新设计组件
- [ ] 精简代码，优化性能
- [ ] 统一设计语言
## 特性
- 代码高亮   
- 细微动效设计  
- **界面简约干净**  
- 有一定自定义空间  
- **阅读体验良好**  
- TOC目录树  
- 头图功能  
- **流畅！**  
- 内置几个小组件  
- ~~作者人比较好，愿意陪你瞎扯~~

更多细节欢迎自行体验~  
### 安装与设置
在 [Releases](https://github.com/MoXiaoXi233/PureSuck-theme/releases) 下载 zip 源码，解压后移动到 Typecho 主题目录。
请确保主题文件夹名应该为 PureSuck ，否则会造成样式或者功能缺失！
主题设置页面位置：Typecho 后台->控制台->外观->设置外观，里面有如何设置的描述  
[CommentNotifier](https://github.com/jrotty/CommentNotifier)回调函数名：parseOwOcodes
#### 建议的工作
- 开启 Typecho 设置内评论区的 Markdown 功能 
- 允许使用的HTML标签和属性内填写
```
<blockquote><pre><code><strong><em><h5><h6><a href title><table><thead><tr><th><tbody><td>
<ol><ul><li>
```
根据你自己的需要删改，你想要允许引用效果就要加上`<blockquote>`，你想要代码就要加上`<pre><code>`等等
- 搭配字体 「霞骛文楷」 使用
- 遇到问题联系作者

### 功能与组件
归档页面：后台新建一个页面，右边选择归档即可
内置一些组件，使用短代码进行解析，使用格式如下
#### 引用条
```
[alert type="red"]这是一个红色警告。[/alert]
[alert type="yellow"]这是一个黄色警告。[/alert]
[alert type="blue"]这是一个蓝色警告。[/alert]
[alert type="green"]这是一个绿色警告。[/alert]
[alert type="pink"]这是一个粉色警告。[/alert]
```
五种颜色可选，在 type 中填写，效果图可以看上面合集，普通的灰色样式用自带的 blockquote 即可
#### 彩色信息窗
```
[window type="red" title="信息窗口"]这是一个信息窗口。[/window]
[window type="yellow" title="警告窗口"]这是一个信息窗口。<br>这是一个信息窗口的第二行。[/window]
```
同样五色可选，type 处填写五种颜色之一，在 title 处填写标题，注意内部如果要换行请用`<br>`标签
#### 友链卡片
```
[friend-card name="好友" ico="avatar.jpg" url="http://example.com"]这是好友的描述。[/friend-card]
```
不可选择颜色，默认跟着主题强调色走的（在主题设置里切换），描述信息如果要换行请用`<br>`标签，描述信息尽量简短避免影响样式
#### 折叠内容
```
[collapsible-panel title="折叠面板标题"]这是面板的内容。[/collapsible-panel]
```
没有颜色选，灰色，用来折叠比较长的内容
#### Tabs选项组
```
[tabs]
[tab title="我的博客信息"]这是我的博客信息内容。[/tab]
[tab title="交流群"]这是交流群内容。[/tab]
[tab title="申请友链"]这有其他内容。[/tab]
[tab title="关于我们"]这是关于我们的内容。[/tab]
[/tabs]
```
按道理来说可以简单嵌套，简单测试了一下没什么问题
#### 时间线
```
[timeline]
[timeline-event date="2023-01-01" title="Event 1"]Description of Event 1.[/timeline-event]
[timeline-event date="2023-02-01" title="Event 2"]Description of Event 2.[/timeline-event]
[/timeline]
```
在[timeline]中添加子[timeline-event]一直加下去就行，应该没什么大问题
#### 视频卡片
目前只做了b站的
```
[bilibili-card bvid="BV1KJ411C7SB"]
```
像这样就可以插入一个视频卡片啦！其实就是官方那个 iframe 内嵌代码，更方便更简洁了一点而已，默认不自动播放
### *开发中的功能组件
#### 瀑布流图片
```
[PicGrid]
![图片.jpg][1]
[/PicGrid]
```
用 Typecho 默认的插入图片方式即可，用[PicGrid]标签包裹即可完成一个瀑布流的照片展示，适合多张图片展示的场景
#### MoxDesign
作为 JS 脚本在页面中自行开发使用  
需要使用的时候请确保在 DOMContentLoaded 之后调用  
MoxDesign Notification通知，默认出现在右下角
```
MoxNotification({
    title: "Persistent Notification",
    message: "This notification won't auto-close.",
    duration: 0, //设置为 0 则需要手动关闭，单位毫秒
});
```
MoxDesign Toast弹窗，等同切换颜色时的提醒
```
MoxToast({
    message: "This is a toast message",
    duration: 3000,
    position: "bottom", // 可以是 "top" 或 "bottom"
    backgroundColor: "var(--card2-color)",
    textColor: "var(--text-color)",
    borderColor: "var(--border-color)", // 使用CSS变量或默认值
});
```
开发中····
## 引用库
[aos](https://github.com/michalsnik/aos)  
[medium-zoom](https://github.com/francoischalifour/medium-zoom)  
[OWO.JS](https://github.com/DIYgod/OwO)  
[HighLight.JS](https://github.com/highlightjs/highlight.js)  
[Pjax](https://github.com/MoOx/pjax)  
[Pace](https://github.com/CodeByZach/pace)
## License
使用 MIT 协议开源，欢迎更多人参与/二次开发！  
感谢，每一个使用本主题的朋友们！
