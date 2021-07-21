#!/bin/bash
./wait-for-it.sh -s --timeout=60 "localstack1:4566" &&
while curl -s http://localstack1:4566/health | grep -v "\"initScripts\": \"initialized\""; do
    printf 'localstack1 not up\n'
    sleep 10s
done && npm run start