# 使用 Node.js 作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 yarn.lock
COPY package.json yarn.lock ./

# 安装依赖并全局安装 serve
RUN yarn install && yarn global add serve

# 复制所有源代码
COPY . .

# 构建前端
RUN yarn build

# 暴露端口
EXPOSE 4000

# 使用 serve 启动静态文件服务
CMD ["serve", "-s", "dist", "-l", "4000"]

