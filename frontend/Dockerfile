# Sử dụng Node.js (phiên bản nhẹ Alpine)
FROM node:20.17.0

# Thiết lập thư mục làm việc bên trong container
WORKDIR /app

# 1. Copy file package.json trước để tận dụng Docker Cache
# Nguồn: mini-google-maps/package.json (từ thư mục frontend/)
# Đích: /app/package.json
COPY mini-google-maps/package.json mini-google-maps/package-lock.json ./

# 2. Cài đặt dependencies
# Lệnh này sẽ chạy trong thư mục /app
RUN npm install

# 3. Copy toàn bộ source code còn lại của dự án React
# Nguồn: toàn bộ nội dung trong mini-google-maps/ (src, public, App.jsx,...)
# Đích: /app
# LƯU Ý: Dấu chấm cuối cùng đại diện cho WORKDIR (/app)
COPY mini-google-maps/. .

# Mở port 5173 (Port mặc định của Vite)
EXPOSE 5173

# Lệnh chạy server development
# --host là cần thiết để cho phép truy cập từ bên ngoài container
CMD ["npm", "run", "dev", "--", "--host"]