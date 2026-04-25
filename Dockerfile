#AWS app runner 
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .

RUN npm run build

FROM python:3.12.6-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

COPY --from=frontend-build /app/frontend/build ./static

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
#docker build -t behaviorai:latest . 