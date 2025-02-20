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

# 复制 package.json 和 yarn.lock
COPY package.json yarn.lock ./

# 安装依赖
RUN yarn install

# 复制所有源代码
COPY . .

# 构建前端
RUN yarn build

# 暴露端口（根据您的express服务端口调整）
EXPOSE 4000

# 启动命令
CMD ["yarn", "server"]
```

Github 仓库中的新建 5 个 Repository secrets

- SERVER_HOST：服务器 ip
- SERVER_USERNAME：服务器登录用户名，一般 root
- SERVER_SSH_KEY：服务器上生成的私钥
- ALIYUN_DOCKER_USERNAME：阿里云 Docker 用户名
- ALIYUN_DOCKER_PASSWORD：阿里云 Docker 密码

腾讯防火墙需要开放 4000 端口
