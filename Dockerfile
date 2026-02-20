FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
#make sure ot have docker installed
#docker build -t testapp .
#docker run -p 3000:3000 testapp