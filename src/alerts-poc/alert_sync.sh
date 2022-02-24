#!/bin/bash
echo "This script synchronises local User Service alert policy and condition definitions with those defined in New Relic"
echo "You will need NR_API_KEY set with the User Service API key in env vars"
read -p "Do you wish to perform the sync (y/n)?" choice
if [[ $choice =~ ^(y| ) ]] || [[ -z $choice ]]; then
    npm run alert-sync
fi