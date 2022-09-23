#!/usr/bin/env bash

mkdir -p ~/.ssh

# Real origin URl is lost during the packaging process, so if your
# submodules are defined using relative urls in .gitmodules then
# you need to restore it with:
#
# git remote set-url origin git@github.com:example/repo.git
echo "github_ssh_key" $github_ssh_key
echo "GITHUB_SSH_KEY" $GITHUB_SSH_KEY
# restore private key from env variable and generate public key
echo "$github_ssh_key" | base64 -d > ~/.ssh/id_rsa
chmod 0600 ~/.ssh/id_rsa
# ssh-keygen -y -f ~/.ssh/id_rsa > ~/.ssh/id_rsa

git init
pwd
ls -la

# add your git provider to the list of known hosts
ssh-keyscan github.com >> ~/.ssh/known_hosts

git submodule update --init