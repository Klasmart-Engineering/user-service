#!/usr/bin/env bash
set -xe
export AWS_PROFILE=hydrogen_cn-north-1

aws ecr get-login-password --region cn-north-1 | sudo docker login --username AWS --password-stdin 503677224658.dkr.ecr.cn-north-1.amazonaws.com.cn
sudo docker build -t 503677224658.dkr.ecr.cn-north-1.amazonaws.com.cn/kidsloop-wukong-user:latest .
sudo docker push 503677224658.dkr.ecr.cn-north-1.amazonaws.com.cn/kidsloop-wukong-user:latest

aws ecs update-service --service arn:aws-cn:ecs:cn-north-1:503677224658:service/kidsloop-wukong/kidsloop-wukong-user --force-new-deployment --cluster kidsloop-wukong --region cn-north-1
