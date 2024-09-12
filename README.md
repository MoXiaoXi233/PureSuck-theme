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
![PureSuck](https://s2.loli.net/2024/09/12/D8pVAM5QkwJzdjO.png)
## TODO
- [ ] 添加更多小组件  
- [ ] 完善 CSS 样式
- [ ] 评论区界面重做
- [ ] 优化代码，修复 BUG
- [ ] 统一设计语言:(
## 特性
代码高亮   
细微动效设计  
**界面简约干净**  
有一定自定义空间  
**阅读体验良好**  
TOC目录树  
头图功能  
**流畅！**  
内置几个小组件  
~~作者人比较好，愿意陪你瞎扯~~  
更多细节欢迎自行体验~  
### 安装与设置
在 [Releases][3] 下载 zip 源码，解压后移动到 Typecho 主题目录。（文件夹名应该为PureSuck）  
主题设置页面位置：Typecho 后台->控制台->外观->设置外观，里面有如何设置的描述
**无法发评论请关掉评论区开启反垃圾保护！！！**
[CommentNotifier](https://github.com/jrotty/CommentNotifier)回调函数名：parseOwOcodes
### 功能与组件
设置大图时需要在自定义字段中新建一个img，随后在内容输入图片的链接，效果正如本文那样啦~  
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
## 引用库
[aos](https://github.com/michalsnik/aos)  
[medium-zoom](https://github.com/francoischalifour/medium-zoom)  
[OWO.JS](https://github.com/DIYgod/OwO)  
[HighLight.JS](https://github.com/highlightjs/highlight.js)
## License
使用 MIT 协议开源，欢迎更多人参与/二次开发！  
感谢，每一个使用本主题的朋友们！
