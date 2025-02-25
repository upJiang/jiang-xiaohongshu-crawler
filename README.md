可以让用户体验的方案：

- 在局域网运行 server 代码，暴露给地址根端口号给大家，将前端代码指向这个地址

- 直接下载这个 nw 打包的产物，打开小红书爬虫程序

- 让用户自己运行这里的整套代码，代码可以从 github 拉取

puppteer + express + 前端项目 的方式部署到服务器后，服务器无法让用户自己打开浏览器操作，也就无法登录，或者让用户填登录信息太过于麻烦。

所以使用 nw.js 打包成桌面应用，用户可以自己打开桌面应用操作，并且可以自己登录。

项目结构时：

主体是个前端项目，nw-project 是桌面应用，里面还有 express 的服务端代码

- 桌面应用主要实现打开已经部署到服务器的前端页面

- 前端页面是跟本地的桌面应用交互，这样才能够让用户去登录，去操作浏览器

- 前端页面与服务层交互都是通过 locathost:4000 进行交互

开发调试只需要执行：yarn dev

打包桌面应用：cd nw-project && yarn nw:build-win，之前可以清除掉 server 里面的 chrome-data 文件夹，减小体积

前端页面代码，也就是项目主体，只要提交了就会自动 ci/cd 到服务器

部署过程：

[添加阿里云镜像](https://cr.console.aliyun.com/cn-shenzhen/instance/namespaces)
创建命名空间后，创建该命名空间下的镜像，选择 github，绑定当前项目

新增 .github/workflows/deploy.yml 文件，并添加以下内容：

```yaml
name: Deploy to Alibaba Cloud

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Alibaba Cloud Container Registry
        run: |
          echo "${{ secrets.ALIYUN_DOCKER_PASSWORD }}" | docker login --username ${{ secrets.ALIYUN_DOCKER_USERNAME }} --password-stdin registry.cn-shenzhen.aliyuncs.com

      - name: Build Docker image
        run: docker build -t registry.cn-shenzhen.aliyuncs.com/jiang-xiaohongshu/jiang-xiaohongshu-crawler:latest .

      - name: Push Docker image
        run: docker push registry.cn-shenzhen.aliyuncs.com/jiang-xiaohongshu/jiang-xiaohongshu-crawler:latest

  deploy:
    runs-on: ubuntu-latest
    needs: build

    steps:
      - name: SSH to server and deploy
        uses: appleboy/ssh-action@v0.1.6
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USERNAME }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            docker login --username ${{ secrets.ALIYUN_DOCKER_USERNAME }} --password ${{ secrets.ALIYUN_DOCKER_PASSWORD }} registry.cn-shenzhen.aliyuncs.com
            docker pull registry.cn-shenzhen.aliyuncs.com/jiang-xiaohongshu/jiang-xiaohongshu-crawler:latest
            docker ps -q --filter "name=jiang-xiaohongshu-crawler" | grep -q . && docker stop jiang-xiaohongshu-crawler || echo "Container jiang-xiaohongshu-crawler is not running"
            docker ps -a -q --filter "name=jiang-xiaohongshu-crawler" | grep -q . && docker rm jiang-xiaohongshu-crawler || echo "Container jiang-xiaohongshu-crawler does not exist"
            docker run -d --name jiang-xiaohongshu-crawler -p 4000:4000 registry.cn-shenzhen.aliyuncs.com/jiang-xiaohongshu/jiang-xiaohongshu-crawler:latest
```

在项目根目录下新增 Dockerfile 文件，并添加以下内容：

```dockerfile
# 使用 Node.js 作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 先只复制构建必需的文件
COPY package.json yarn.lock ./

# 安装依赖并全局安装 serve
RUN yarn install --network-timeout 100000 && \
    yarn global add serve && \
    yarn cache clean

# 复制所有源代码（放在依赖安装后，这样源码改变才会触发新的构建）
COPY . .

# 删除旧的 dist 目录（如果存在），然后重新构建
RUN rm -rf dist && \
    yarn build

# 暴露端口
EXPOSE 4000

# 使用 serve 启动静态文件服务
CMD ["serve", "-s", "dist", "-l", "4000"]
```

Github 仓库中的新建 5 个 Repository secrets

- SERVER_HOST：服务器 ip
- SERVER_USERNAME：服务器登录用户名，一般 root
- SERVER_SSH_KEY：
  - 在本地生成 ssh 密钥对
    ```bash
    ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
    ```
  - 将私钥添加到 Github 仓库的 Repository secrets 中，命名为 SERVER_SSH_KEY
  - 将公钥添加到服务器的 ~/.ssh/authorized_keys 文件中
    ```bash
    echo "前面生成的公钥内容.pub" >> ~/.ssh/authorized_keys
    ```
- ALIYUN_DOCKER_USERNAME：阿里云 Docker 用户名
- ALIYUN_DOCKER_PASSWORD：阿里云 Docker 密码

腾讯防火墙需要开放 4000 端口

在 nginx 配置文件 /www/server/nginx/conf/nginx.conf 中添加配置

```bash
server {
    listen 443 ssl;  # 启用 SSL 并监听 443 端口
    server_name junfeng530.xyz;  # 你的域名

    ssl_certificate /www/server/panel/vhost/cert/junfeng530.xyz/fullchain.pem;  # 替换为你的证书路径
    ssl_certificate_key /www/server/panel/vhost/cert/junfeng530.xyz/privkey.pem;  # 替换为你的私钥路径

    location /xiaohongshu/ {
        proxy_pass http://121.4.86.16:4000/;  # 代理到 Docker 容器所在的 3000 端口
        proxy_set_header Host $host;  # 保持 Host 头部
        proxy_set_header X-Real-IP $remote_addr;  # 获取真实 IP
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;  # 传递代理链 IP
        proxy_set_header X-Forwarded-Proto $scheme;  # 传递协议

        # 处理 URL 重写，将 /api 前缀移除
        rewrite ^/api/(.*)$ /$1 break;
    }
}
```

重启 nginx

```bash
/etc/init.d/nginx restart
```

## 如何添加到白名单

1. Windows Defender:
   - 打开 Windows 安全中心
   - 点击"病毒和威胁防护"
   - 在"病毒和威胁防护设置"下点击"管理设置"
   - 在"排除项"下添加应用路径
