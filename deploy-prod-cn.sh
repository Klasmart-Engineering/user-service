#!/usr/bin/env bash
set -xe
export AWS_PROFILE=hydrogen_cn-north-1

aws ecr get-login-password --region cn-north-1 | sudo docker login --username AWS --password-stdin 503677224658.dkr.ecr.cn-north-1.amazonaws.com.cn
sudo docker build -t kidsloop-prod-user .
sudo docker tag kidsloop-prod-user:latest 503677224658.dkr.ecr.cn-north-1.amazonaws.com.cn/kidsloop-prod-user:latest
sudo docker push 503677224658.dkr.ecr.cn-north-1.amazonaws.com.cn/kidsloop-prod-user:latest

aws ecs update-service --service arn:aws-cn:ecs:cn-north-1:503677224658:service/kidsloop-prod/kidsloop-prod-user --force-new-deployment --cluster kidsloop-prod --region cn-north-1
