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

# 删除旧的 dist 目录（如果存在），然后重新构建
RUN rm -rf dist && \
    yarn build && \
    cd nw-project && \
    yarn install --network-timeout 100000 && \
    yarn cache clean && \
    yarn build

# 设置工作目录到 nw-project 文件夹
WORKDIR /app/nw-project

# 暴露端口（根据您的express服务端口调整）
EXPOSE 4000

# 启动命令
CMD ["yarn", "server"]


