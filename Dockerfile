FROM node:latest

WORKDIR /home/node/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 1225
CMD ["npm", "start"]