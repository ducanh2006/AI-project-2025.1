# Sử dụng Python 3.12-slim (phiên bản nhẹ)
FROM python:3.12-slim

# Thiết lập thư mục làm việc bên trong container
WORKDIR /app

# Copy file requirements.txt vào thư mục làm việc
# Đây là bước quan trọng giúp Docker có thể cache layer này
COPY requirements.txt .

# Cài đặt tất cả các thư viện từ requirements.txt
# --no-cache-dir giúp giảm kích thước cuối cùng của image
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code còn lại vào container
# Bao gồm cả main.py
COPY . .

# Mở port 3000
EXPOSE 3000

# Lệnh chạy server Uvicorn
# main:app trỏ đến ứng dụng FastAPI trong main.py
# host 0.0.0.0 cho phép container truy cập được từ bên ngoài
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]