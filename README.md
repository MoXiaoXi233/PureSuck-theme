![Banner](https://s2.loli.net/2024/08/05/M4FTuyI2b7aU3Ag.png)
#PureSuck-Theme
PureSuck，干净，纯洁，淡雅朴素的typecho主题。  
![Static Badge](https://img.shields.io/badge/RELEASE-1.1.0-blue)
![Static Badge](https://img.shields.io/badge/LICENSE-MIT-green)
![Static Badge](https://img.shields.io/badge/AUTHOR-MoXiify-pink)  
由于是第一次正经意义上的做一个项目，加上本人属于极度的小白，作为学习的帮手，全程高度依赖 ChatGPT 4o，本次开发差不多用时10天，遇到问题欢迎反馈解决。  
感谢你的使用！
## 外观
可以前往[希记](note.moxiify.cn)查看演示效果  
主题本身有四种强调色可以选择，同时内置几种多彩的小组件（会不断补充，欢迎issues）  
![整体样式](https://s2.loli.net/2024/08/05/NZItCKfVaFMxXHA.png)  
![细节样式](https://s2.loli.net/2024/08/05/1JWB6G3gqlEV7pR.png)
##特性
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
### 功能与组件
设置大图时需要在自定义字段中新建一个img，随后在内容输入图片的链接，效果正如本文那样啦~  
初始有三种组件，引用条，彩色信息窗和友链卡片，使用格式如下
#### 引用条
```
<div ALERT-TYPE="red">墨希墨希，123456，QWERTY，！@#￥%……</div>
<div ALERT-TYPE="yellow">墨希墨希，123456，QWERTY，！@#￥%……</div>
<div ALERT-TYPE="blue">墨希墨希，123456，QWERTY，！@#￥%…….</div>
<div ALERT-TYPE="green">墨希墨希，123456，QWERTY，！@#￥%……</div>
<div ALERT-TYPE="pink">墨希墨希，123456，QWERTY，！@#￥%……</div>
```
五种颜色可选，在 ALERT-TYPE 中填写，效果图可以看上面合集，普通的灰色样式用自带的blockquote即可
#### 彩色信息窗
```
<div WINDOW-TYPE="red" TITLE:"测试测试">墨希墨希，123456，QWERTY，！@#￥%……这是一段比较长的文本，因为这是一个比较长的窗口，所以我要测试。墨希墨希，123456，QWERTY，！@#￥%……这是一段比较长的文本，因为这是一个比较长的窗口，所以我要测试。</div>
```
同样五色可选，WINDOW1-TYPE 处填写五种颜色之一，在 TIILE 处填写标题，注意内部如果要换行请用`<br>`标签
#### 友链卡片
```
<div FRIEND-NAME="好友名字" ICO="头像链接" URL="跳转地址" >好友的描述信息</div>
```
不可选择颜色，默认跟着主题强调色走的（在主题设置里切换），描述信息如果要换行请用`<br>`标签
## 引用库
[4](https://github.com/michalsnik/aos)  
[medium-zoom](https://github.com/francoischalifour/medium-zoom)  
[OWO.JS](https://github.com/DIYgod/OwO)  
[HighLight.JS](https://github.com/highlightjs/highlight.js)
## License
使用 MIT 协议开源，欢迎更多人参与/二次开发！  
感谢，每一个使用本主题的朋友们！
