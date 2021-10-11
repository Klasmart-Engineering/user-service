#!/bin/bash

# this script should calculate the 3 out of 4 key metrics of Software Delivery
# https://thenewstack.io/4-ways-to-measure-your-software-delivery-performance/


TIMESTAMP="1994-11-05T13:15:30Z"
# BITBUCKET_COMMIT="0554acd2c02745a5e963b728346c7f1cc3512fca"
AUTHOR="$(git show -s --format='%ae' $BITBUCKET_COMMIT)"

echo "author: $AUTHOR"

generate_post_data()
{
  cat <<EOF
  {
    "deployment": {
      "revision": "REVISION",
      "description": "Added a deployments resource to the v2 API",
      "commit_hash": "$BITBUCKET_COMMIT",
      "user": "$AUTHOR"
    } 
  }
EOF
}

curl -X POST "https://api.eu.newrelic.com/v2/applications/$NEWRELIC_APP_ID/deployments.json" \
     -H "Api-Key:$NEWRELIC_API_KEY" \
     -i \
     -H "Content-Type: application/json" \
     -d "$(generate_post_data)"
