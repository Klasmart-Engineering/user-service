#!/bin/bash
echo "You have your branch ready to be released"
read -p "Continue (y/n)?" choice
if [[ $choice =~ ^(y| ) ]] || [[ -z $choice ]]; then
    npm run release
    git push origin $(git branch --show-current)
    git push --tags
fi
