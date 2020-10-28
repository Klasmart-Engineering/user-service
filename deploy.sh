#!/usr/bin/env bash
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 494634321140.dkr.ecr.ap-northeast-2.amazonaws.com
docker build -t kidsloop-beta-user .
docker tag kidsloop-beta-user:latest 494634321140.dkr.ecr.ap-northeast-2.amazonaws.com/kidsloop-beta-user:latest
docker push 494634321140.dkr.ecr.ap-northeast-2.amazonaws.com/kidsloop-beta-user:latest
sleep 5
aws ecs update-service --service arn:aws:ecs:ap-northeast-2:494634321140:service/beta-hub/kidsloop-beta-user --force-new-deployment --cluster beta-hub