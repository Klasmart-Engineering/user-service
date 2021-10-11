#!/bin/bash

# this script should calculate the 3 out of 4 key metrics of Software Delivery
# https://thenewstack.io/4-ways-to-measure-your-software-delivery-performance/


TIMESTAMP="mytimestamp"
AUTHOR="authors name"

echo "https://api.eu.newrelic.com/v2/applications/$NEWRELIC_APP_ID/deployments.json"
echo "Api-Key:$NEWRELIC_API_KEY"

curl -X POST "https://api.eu.newrelic.com/v2/applications/$NEWRELIC_APP_ID/deployments.json" \
     -H "Api-Key:$NEWRELIC_API_KEY" \
     -i \
     -H "Content-Type: application/json" \
     -d \
'{
  "deployment": {
    "revision": "REVISION",
    "description": "Added a deployments resource to the v2 API",
    "user": "'+$AUTHOR+'",
    "timestamp": "'+$TIMESTAMP+'"
  }
}'
