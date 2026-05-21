# EdgeOne Pages 部署步骤

## 1. 推送到 Git 仓库

当前项目需要先推送到 GitHub 或 Gitee，EdgeOne Pages 才能按“导入仓库”的方式部署。

推荐仓库名：

```text
gluttonous-snake
```

## 2. 创建 EdgeOne Pages 项目

1. 打开 EdgeOne Pages 控制台。
2. 选择“新建项目”。
3. 选择“导入 Git 仓库”。
4. 授权 GitHub 或 Gitee。
5. 选择当前项目仓库。

构建配置：

```text
框架预设：Other / Static / 无框架
构建命令：留空
输出目录：/
根目录：/
```

## 3. 创建并绑定 KV

在 EdgeOne Pages 项目里创建 KV 命名空间，并绑定到当前项目。

变量名必须设置为：

```text
LEADERBOARD
```

排行榜函数会读取这个绑定名。

## 4. 重新部署

绑定 KV 后重新部署一次项目。

部署完成后检查：

```text
https://你的-edgeone-域名/
https://你的-edgeone-域名/api/leaderboard
```

`/api/leaderboard` 应返回：

```json
{
  "classic": [],
  "wrap": [],
  "rush": [],
  "feast": []
}
```

## 5. 当前项目接口

前端继续使用：

```text
/api/leaderboard
```

所以不需要修改 `game.js` 的排行榜地址。
