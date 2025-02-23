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
EXPOSE 4001

# 使用 serve 启动静态文件服务
CMD ["serve", "-s", "dist", "-l", "4001"]

