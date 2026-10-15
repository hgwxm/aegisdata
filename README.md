# 代码

这里是 AegisData 网站的**完整可运行代码**，从 `src/` 同步而来，只包含运行网站需要的东西，没有文档和素材。

## 目录

```
code/
├── index.html          访问控制台（首页）
├── audit.html          审计日志
├── rules.html          权限规则
├── about.html          系统说明
├── static/
│   ├── style.css       全站样式（设计令牌在文件顶部）
│   └── app.js          共享数据层 + 页面控制器 + hash 路由
└── 单文件版.html        上面所有内容合并成一个文件，双击即开
```

页面通过 `../static/style.css` 和 `../static/app.js` 引用样式与脚本，所以**`static/` 目录不能删、也不能改名**。

## 怎么运行

**方式一：单文件版（最简单）**
双击 `单文件版.html`，浏览器打开即用。它把四个页面、样式、脚本全部内联在一个文件里，没有任何外部依赖，断网也能跑，可以直接发给别人。

**方式二：多文件版（改代码时用）**
在 `code/` 的**上一级目录**（也就是 `aegisdata/`）启动本地服务：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000/code/index.html`。

不能直接双击 `index.html` 的原因：浏览器对本地文件的相对路径引用有限制，走一个本地服务最稳。

## 改代码的注意事项

这个 `code/` 目录是**构建产物**，由 `build-single.js` 自动同步。所以：

- 改样式或交互 → 改 `../src/static/` 里的 `style.css` / `app.js`
- 改页面结构 → 改 `../src/prototype/` 里的四个 html
- 改完在 `../` 下执行 `node build-single.js`，`code/` 会自动更新

直接在 `code/` 里改会被下次构建覆盖。

## 唯一的判定入口

`static/app.js` 里的 `resolve()` 是**唯一**做权限判定的函数，目前查的是前端预置的演示数据表 `DEMO_DECISIONS`。

接入后端时整段替换这个函数即可，页面层代码不需要改动：

```javascript
// 现在：查表
return DEMO_DECISIONS[role + '|' + fileId + '|' + action];

// 接入后：请求后端统一入口
const r = await fetch('/api/access', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_role: role, file_id: fileId, action: action })
});
return await r.json();   // { request_id, decision, reason, executed }
```

## 安全约束（不要破坏）

1. 未知角色、未知文件编号、未知操作类型**不得默认放行**。
2. 权限判定与文件操作**必须分离**。
3. `DENY` 与 `PENDING_APPROVAL` 必须在真实文件操作之前拦截。
4. `executed` 必须反映真实执行情况，不得写死。
5. 受保护文件不得放在网页静态路径下。