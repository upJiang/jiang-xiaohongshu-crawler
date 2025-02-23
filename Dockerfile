# 使用 Node.js 作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 先只复制构建必需的文件
COPY package.json yarn.lock ./

# 安装依赖并全局安装 serve
RUN yarn install --network-timeout 100000 && \
    yarn cache clean

# 复制所有源代码（放在依赖安装后，这样源码改变才会触发新的构建）
COPY . .

# 分别处理主项目和 nw-project 的构建
RUN yarn install --network-timeout 100000 && \
    yarn cache clean && \
    yarn build

# 单独处理 nw-project
WORKDIR /app/nw-project
COPY nw-project/package.json nw-project/yarn.lock ./
RUN yarn install --network-timeout 100000 && \
    yarn cache clean

COPY nw-project .

# 暴露端口（根据您的express服务端口调整）
EXPOSE 4000

# 启动命令
CMD ["yarn", "server"]


