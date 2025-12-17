# 使用官方 Node.js 18 Alpine 镜像（轻量且支持最新特性）
FROM node:18-alpine

# 设置时区为上海（可选，取消注释即可启用）
# RUN apk add --no-cache tzdata && \
#     cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
#     echo "Asia/Shanghai" > /etc/timezone

# 安装 HTTPS 证书（必要）
RUN apk add --no-cache ca-certificates

# 设置工作目录
WORKDIR /app

# 拷贝 package.json 和 package-lock.json（利用 Docker 缓存）
COPY package*.json ./

# 配置 npm 使用腾讯镜像源（加速依赖下载）
RUN npm config set registry https://mirrors.cloud.tencent.com/npm/

# 安装生产依赖（--production 跳过 devDependencies）
RUN npm install --production

# 拷贝项目源码
COPY . .

# 暴露端口（微信云托管会自动映射，但保留良好习惯）
EXPOSE 8080

# 启动应用
CMD ["npm", "start"]
