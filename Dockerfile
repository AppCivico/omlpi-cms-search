FROM node:latest

WORKDIR /home/node/app

COPY . .

EXPOSE 1337

COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]