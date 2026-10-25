# 部署到 GitHub Pages：照抄即可

本目录已初始化成 git 仓库，首次提交已完成，分支已设为 `main`。
下面 5 步做完，就能用手机直接访问网址。

---

## 第 1 步：在 GitHub 上建仓库

1. 浏览器打开 https://github.com/new
2. **Repository name** 填：`worktime-app`
3. 选 **Public**（公开）
4. **不要勾选** Add a README file / Add .gitignore / Choose a license
   （勾了会和本地文件冲突，push 时报错）
5. 点 **Create repository**

建好后页面会显示仓库地址，形如：
```
https://github.com/jiangguochang/worktime-app.git
```

---

## 第 2 步：创建 Personal Access Token（只需要一次）

GitHub 已经不允许用登录密码 push，必须用 token。

1. 打开 https://github.com/settings/tokens?type=beta
2. 点 **Generate new token**
3. Token name 填 `worktime-deploy`
4. Expiration 选 30 天（够用，过期可再建）
5. **Repository access** 选 `Only select repositories` → 选中刚建的 `worktime-app`
6. **Permissions** → Repository permissions → 找到 **Contents**，改成 **Read and write**
7. 点 **Generate token**，复制那串 `github_pat_...`

> token 只显示一次，先粘到记事本。不要发到聊天里，也不要提交进仓库。

---

## 第 3 步：推送到 GitHub

在本目录打开终端（PowerShell 或 CMD），执行：

```bash
cd C:\Users\Administrator\.roy\agent-workspaces\worktime-app

git remote add origin https://github.com/jiangguochang/worktime-app.git
git push -u origin main
```

弹出登录时：
- Username 填 `jiangguochang`
- Password **粘贴第 2 步的 token**（不是 GitHub 登录密码）

成功会看到 `branch 'main' set up to track 'origin/main'`。

---

## 第 4 步：开启 Pages

1. 打开仓库页面 → **Settings**（顶部齿轮）
2. 左侧菜单往下找 **Pages**
3. **Source** 选 `Deploy from a branch`
4. **Branch** 选 `main`，目录选 `/ (root)`
5. 点 **Save**
6. 等 1~2 分钟，刷新页面，顶部会出现绿色提示：
   `Your site is live at https://jiangguochang.github.io/worktime-app/`

---

## 第 5 步：装到 iPhone

1. iPhone 用 **Safari** 打开 `https://jiangguochang.github.io/worktime-app/`
2. 点底部「分享」→「添加到主屏幕」
3. 以后从桌面图标打开，全屏运行

**从此不需要电脑开机。**

---

## 以后改了代码怎么更新

```bash
cd C:\Users\Administrator\.roy\agent-workspaces\worktime-app
git add -A
git commit -m "改了什么"
git push
```

推送后 Pages 会自动重新发布，等 1 分钟左右。手机上的 App 下次打开就是新版；
如果没变，在 Safari 里下拉刷新一次（Service Worker 是网络优先，会自动取最新文件）。

---

## 常见问题

**Q：push 报 `remote origin already exists`**
```bash
git remote set-url origin https://github.com/jiangguochang/worktime-app.git
```

**Q：push 报 `Authentication failed`**
token 过期或权限不足。重新生成一个，确保 Contents 是 Read and write。

**Q：Pages 打开是 404**
- 确认 Settings → Pages 里显示的是 `main` 和 `/ (root)`
- 刚开启要等 1~2 分钟
- 地址必须是 `https://jiangguochang.github.io/worktime-app/`（末尾带斜杠）

**Q：手机上打开是旧版本**
Safari 下拉刷新。如果还不行，说明 Service Worker 缓存了，正常等待或
在「设置 → Safari → 高级 → 网站数据」里删掉该站点再重开。

**Q：工时数据会上传到 GitHub 吗**
不会。数据只存在手机的浏览器本地。GitHub 上只有程序代码。

**Q：换手机数据怎么办**
先在旧手机「统计 → 导出备份（JSON）」，把文件传到新手机，
再在新手机点「从备份恢复」。
