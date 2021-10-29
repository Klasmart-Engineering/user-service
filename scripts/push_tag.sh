#!/bin/bash
echo "You have updated the project package version and changelog"
read -p "Continue (y/n)?" choice
if [[ $choice =~ ^(y| ) ]] || [[ -z $choice ]]; then
    git push --tags
fi
