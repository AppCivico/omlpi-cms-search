#!/bin/bash
export USER=node

npm install
npx node-pg-migrate up
npm start
