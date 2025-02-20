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

# 创建一个专门的目录来存放静态文件
RUN mkdir -p /app/public

# 将构建后的 dist 目录移动到 public 目录下
RUN mv dist /app/public/

# 暴露端口（根据您的express服务端口调整）
EXPOSE 4000

# 启动命令
CMD ["yarn", "server"]

