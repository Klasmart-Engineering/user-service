#!/bin/bash
set -x
awslocal s3 mb s3://kidsloop-alpha-account-asset-objects --endpoint http://localhost:4566
set +x
