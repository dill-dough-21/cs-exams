#!/bin/bash

if [ -z "$1" ]; then
  echo "Error: You must provide a PR number."
  echo "Usage: ./merge_pr.sh <PR_NUMBER>"
  exit 1
fi

PR_ID=$1
BRANCH_NAME="pr-$PR_ID"

echo "Fetching PR #$PR_ID..."
git fetch origin pull/$PR_ID/head:$BRANCH_NAME

echo "Merging changes..."
git merge --squash $BRANCH_NAME

echo "Committing as Anonymous Admin..."
git commit --no-edit -m "Merge contribution from PR #$PR_ID"

echo "Pushing to main..."
git push origin main

echo "Cleaning up..."
git branch -D $BRANCH_NAME

echo "Done! PR #$PR_ID merged anonymously."