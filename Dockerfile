FROM node:latest

RUN groupadd -r node && useradd -m -r -g -s /bin/bash node node
USER node

WORKDIR /home/node/app

COPY package.json .
COPY package-lock.json .

COPY . .

EXPOSE 1225

ENTRYPOINT ["./entrypoint.sh"]