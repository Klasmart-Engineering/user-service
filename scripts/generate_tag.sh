#!/bin/bash
echo "You have updated the project package version and changelog"
read -p "Continue (y/n)?" choice
if [[ $choice =~ ^(y| ) ]] || [[ -z $choice ]]; then
    USER_SERVICE_VERSION=$(node -p "require('./package.json').version")
    export USER_SERVICE_TAG="v${USER_SERVICE_VERSION}"
    echo $USER_SERVICE_TAG
    git tag $USER_SERVICE_TAG
    git push origin --tags
fi
