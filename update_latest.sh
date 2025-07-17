#!/bin/bash

if ! [ -f ./config.sh ]; then
  echo "config.sh file does not exist."
  exit 1
else
  APERSONAIDP_REPO_NAME=amfa-service-multi-tenants
  APERSONAADM_REPO_NAME=amfa-admin-portal-multi-tenants
  INIT_DEPLOY_SCRIPT=https://raw.githubusercontent.com/solariswu/free-cdn-source/main/init_deploy.sh

  mv -- config.sh .amfa_config_bk && rm -rf -- "$APERSONAIDP_REPO_NAME/" "$APERSONAADM_REPO_NAME/" ./*.sh ./*.json ./*.txt && curl -o- "$INIT_DEPLOY_SCRIPT" | bash && cp -- .amfa_config_bk config.sh && ./"$APERSONAIDP_REPO_NAME/install.sh"
fi
