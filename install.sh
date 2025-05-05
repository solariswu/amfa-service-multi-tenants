#!/bin/bash

RED='\033[0;31m'
BOLD="\033[1m"
YELLOW="\033[38;5;11m"
NC='\033[0m' # No Color

APERSONAIDP_REPO_NAME=aPersona-Identity-for-AWS-End-User-Services
APERSONAADM_REPO_NAME=aPersona-Identity-for-AWS-Admin-Portal

amfaName=$(jq -rc '.name' $APERSONAIDP_REPO_NAME/package.json)
amfaVersion=$(jq -rc '.version' $APERSONAIDP_REPO_NAME/package.json)

adPortalName=$(jq -rc '.name' $APERSONAADM_REPO_NAME/package.json)
adPortalVersion=$(jq -rc '.version' $APERSONAADM_REPO_NAME/package.json)

echo_time() {
    command echo $(date) "$@"
}

echo ""
echo "-----------------------------------"
echo "aPersona Identity Manager Installer"
echo "-----------------------------------"
echo_time "This script will install aPersona Identity Manager on your AWS account."
echo ""
echo "aPersona Identity Manager - "$amfaName" - v"$amfaVersion
echo "aPersona admin Portal - "$adPortalName" - v"$adPortalVersion
echo ""
echo ""

while true; do
    read -p "It may take between 30 to 45 min to complete. $(echo -e $BOLD$YELLOW)Continue$(echo -e $NC)? (y/n)" responseins
    if [[ "$responseins" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        break
    fi
    if [[ "$responseins" =~ ^([nN][oO]|[nN])$ ]]; then
        exit 1
    fi
    echo "Please answer y or n."
done

echo ""
echo ""
echo "$(<./$APERSONAIDP_REPO_NAME/aPersona_ASM-and-aPersona_Identity_Mgr_Ts_Cs.txt)"

echo ""

while true; do
    read -p "Please review and agree to the above $(echo -e $BOLD$YELLOW)aPersona Identity Manager Terms and Conditions$(echo -e $NC)? (y/n)" responsetc
    if [[ "$responsetc" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        break
    fi
    if [[ "$responsetc" =~ ^([nN][oO]|[nN])$ ]]; then
        exit 1
    fi
    echo "Please answer y or n."
done

unset TENANT_ID && unset ROOT_DOMAIN_NAME && unset ROOT_HOSTED_ZONE_ID && unset SP_PORTAL_URL && unset EXTRA_APP_URL && unset RECAPTCHA_KEY && unset RECAPTCHA_SECRET

source ./config.sh

if [ -z "$ASM_PORTAL_URL" ]; then
    echo "ASM_PORTAL_URL is not set, please set ASM_PORTAL_URL in config.sh"
    exit 1
fi

if [ -z "$ASM_SERVICE_URL" ]; then
    echo "ASM_SERVICE_URL is not set, please set ASM_SERVICE_URL in config.sh"
    exit 1
fi

if [ -z "$TENANT_ID" ]; then
    echo "TENANT_ID is not set, please set TENANT_ID in config.sh"
    exit 1
fi

if [ -z "$ROOT_DOMAIN_NAME" ]; then
    echo "ROOT_DOMAIN_NAME is not set, please set ROOT_DOMAIN_NAME in config.sh"
    exit 1
fi

if [ -z "$ROOT_HOSTED_ZONE_ID" ]; then
    echo "ROOT_HOSTED_ZONE_ID is not set, please set ROOT_HOSTED_ZONE_ID in config.sh"
    exit 1
fi

if [ -z "$ASM_INSTAL_KEY" ]; then
    echo "ASM_INSTAL_KEY is not set, please set ASM_INSTAL_KEY in config.sh"
    exit 1
fi

if [ -z "$SMTP_HOST" ]; then
    echo "SMTP_HOST is not set, please set SMTP_HOST in config.sh"
    exit 1
fi

if [ -z "$SMTP_USER" ]; then
    echo "SMTP_USER is not set, please set SMTP_USER in config.sh"
    exit 1
fi

if [ -z "$SMTP_PASS" ]; then
    echo "SMTP_PASS is not set, please set SMTP_PASS in config.sh"
    exit 1
fi

if [ -z "$SMTP_SECURE" ]; then
    export SMTP_SECURE="false"
fi

if [ -z "$SMTP_PORT" ]; then
    echo "SMTP_PORT is not set, use default value 587"
    export SMTP_PORT=587
fi

if [ -z "$ASM_SALT" ]; then
    echo "ASM_SALT is not set, please set ASM_SALT in config.sh"
    exit 1
fi

if [ -z "$ADMIN_EMAIL" ]; then
    echo "ADMIN_EMAIL is not set, please set ADMIN_EMAIL in config.sh"
    exit 1
fi

if [ -z "$TENANT_NAME" ]; then
    echo "TENANT_NAME is not set, please set TENANT_NAME in config.sh"
    exit 1
fi

if [[ -z "$INSTALLER_EMAIL" || "$INSTALLER_EMAIL" = 'null' || "$INSTALLER_EMAIL" = '' ]]; then
    echo "INSTALLER_EMAIL is not set, using ADMIN_EMAIL as INSTALLER_EMAIL"
    export INSTALLER_EMAIL=$ADMIN_EMAIL
fi

if aws sts get-caller-identity >/dev/null; then
    DOMAINNAME=$(aws route53 get-hosted-zone --id $ROOT_HOSTED_ZONE_ID | jq -r .HostedZone.Name)
    if [ "$DOMAINNAME" != "$ROOT_DOMAIN_NAME""." ]; then
        echo "ROOT_DOMAIN_NAME and ROOT_HOSTED_ZONE_ID does not match"
        exit 1
    fi

    APERSONAIDP_REPO_NAME=aPersona-Identity-for-AWS-End-User-Services
    APERSONAADM_REPO_NAME=aPersona-Identity-for-AWS-Admin-Portal

    source ~/.bashrc
    NODE_OPTIONS=--max-old-space-size=8192

    echo "install application dependency libs"
    cd $APERSONAIDP_REPO_NAME
    npm install >/dev/null 2>&1

    export SP_PORTAL_URL="https://login."$TENANT_ID"."$ROOT_DOMAIN_NAME

    #get region and account by EC2 info
    TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
    EC2_AVAIL_ZONE=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone)
    export CDK_DEPLOY_REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region)
    export CDK_DEPLOY_ACCOUNT=$(aws sts get-caller-identity | jq -r .Account)

    # if [[ -z "$TENANT_NAME" || "$TENANT_NAME" = "null" ]]; then
    #     echo "TENANT_NAME is not set, using TENANT_ID.ROOT_DOMAIN_NAME as TENANT_NAME"
    #     TENANT_NAME=$(jq -rn --arg x "$TENANT_ID.$ROOT_DOMAIN_NAME" '$x|@uri')
    # fi

    TENANT_NAME=$(jq -rn --arg x "$TENANT_NAME" '$x|@uri')

    registRes=$(aws secretsmanager get-secret-value --region $CDK_DEPLOY_REGION --secret-id "apersona/$TENANT_ID/install" 2>/dev/null | jq -r .SecretString | jq -r -c .registRes)
    echo_time "amfa install params fetched from previous record: "$registRes
    if [[ -z "$registRes" || "$registRes" = "null" ]]; then
        ## never installed
        ## register to ASM portal
        registRes=$(curl -X POST -F "newTenantName=$TENANT_NAME" -F "awsAccountId=$CDK_DEPLOY_ACCOUNT" -F "newTenantAdminEmail=$ADMIN_EMAIL" -F "asmSecretKey=$ASM_INSTAL_KEY" -F "awsUserPoolFqdn=$ROOT_DOMAIN_NAME" -F "awsRegion=$CDK_DEPLOY_REGION" -F "asmTenantInstallerEmail=$INSTALLER_EMAIL" "$ASM_PORTAL_URL/newTenantAssignmentWithDefaults.ap")
        echo "No previous install params found. New amfa register result retrieved: "$registRes

        ## get provider id
        export ASM_PROVIDER_ID=$(echo $registRes | jq -r .asmClientId)
        if [[ -z "$ASM_PROVIDER_ID" || "$ASM_PROVIDER_ID" = "null" ]]; then
            ## assignment error
            echo_time "ASM portal newTenant API error, no provider_id, please check your install key and admin email value and contact Apersona for support"
            exit 1
        fi

        ## assignment success, store install params in secretsmanager
        aws secretsmanager create-secret --region $CDK_DEPLOY_REGION --name "apersona/$TENANT_ID/install" --secret-string "{\"registRes\":$registRes}" >/dev/null 2>&1
        echo "install params saved"
    fi

    ## fetch install params
    export ASM_PROVIDER_ID=$(echo $registRes | jq -r .asmClientId)
    export MOBILE_TOKEN_KEY=$(echo $registRes | jq -r .mobileTokenKey)
    export MOBILE_TOKEN_SALT=$(echo $registRes | jq -r .mobileTokenSalt)
    export TENANT_AUTH_TOKEN=$(echo $registRes | jq -r .asmClientSecretKey)
    export ASM_POLICIES=$(echo $registRes | jq -r .apiKeys)

    if [[ -z "$ASM_PROVIDER_ID" || "$ASM_PROVIDER_ID" = "null" || -z "$MOBILE_TOKEN_SALT" || "$MOBILE_TOKEN_SALT" = "null" || -z "$MOBILE_TOKEN_KEY" || "$MOBILE_TOKEN_KEY" = "null" ]]; then
        echo_time "ASM assignment error, please check your install key and admin email value and contact Apersona for support"
        exit 1
    fi

    if ! aws iam get-role --role-name CrossAccountDnsDelegationRole-DO-NOT-DELETE >/dev/null 2>&1; then
        rm -rf delegationRole.json
        echo "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"AWS\":\"arn:aws:iam::$CDK_DEPLOY_ACCOUNT:root\"},\"Action\":\"sts:AssumeRole\"}]}" >>delegationRole.json

        aws iam create-role --role-name CrossAccountDnsDelegationRole-DO-NOT-DELETE --assume-role-policy-document file://delegationRole.json
        aws iam create-policy --policy-name dns-delegation-policy --policy-document file://delegationPolicy.json
        aws iam attach-role-policy --role-name CrossAccountDnsDelegationRole-DO-NOT-DELETE --policy-arn "arn:aws:iam::$CDK_DEPLOY_ACCOUNT:policy/dns-delegation-policy"
    fi

    ## echo "generate AMFA front end config file"

    rm -rf build/const.js
    echo "export const clientName = '$TENANT_ID'" >>build/const.js
    echo "export const region = '$CDK_DEPLOY_REGION'" >>build/const.js
    echo "export const applicationUrl = '$SP_PORTAL_URL'" >>build/const.js
    echo "export const extraAppUrl = '$EXTRA_APP_URL'" >>build/const.js
    echo "export const apiUrl = 'https:///api.$TENANT_ID.$ROOT_DOMAIN_NAME'" >>build/const.js
    echo "export const recaptcha_key = '$RECAPTCHA_KEY'" >>build/const.js

    echo ""
    echo "**********************************"
    echo "Start building...please wait ..."
    npm run cdk-build

    #check DNS domain

    #bootstrap CDK account and region
    # set -e

    export CDK_NEW_BOOTSTRAP=1
    export IS_BOOTSTRAP=1
    echo "*************************************************************************************"
    echo "Now starting deployment of APERSONA AWS IdP"

    while true; do
        read -p "Confirm to deploy AMFA on Account $(echo -e $BOLD$YELLOW$CDK_DEPLOY_ACCOUNT$NC) in Region $(echo -e $BOLD$YELLOW$CDK_DEPLOY_REGION$NC)? (y/n)" response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            break
        fi
        if [[ "$response" =~ ^([nN][oO]|[nN])$ ]]; then
            unset NODE_OPTIONS
            exit 1
        fi
        echo "Please answer y or n."
    done

    echo "*************************************************************************************"
    npx cdk bootstrap aws://$CDK_DEPLOY_ACCOUNT/us-east-1
    npx cdk bootstrap aws://$CDK_DEPLOY_ACCOUNT/$CDK_DEPLOY_REGION || (unset IS_BOOTSTRAP && unset CDK_NEW_BOOTSTRAP)
    unset IS_BOOTSTRAP && unset CDK_NEW_BOOTSTRAP

    aws s3api head-object --bucket "${CDK_DEPLOY_ACCOUNT}-amfa-${TENANT_ID}-login" --key branding.json || NOT_EXIST=true
    if [ ! $NOT_EXIST ]; then
        echo "branding file exists, copy it"
        aws s3 cp s3://$CDK_DEPLOY_ACCOUNT-amfa-$TENANT_ID-login/branding.json ./spportal/dist/ 2>/dev/null
    fi

    npx cdk deploy "$@" --require-approval never --all --outputs-file ../apersona_idp_deploy_outputs.json

    ENDUSER_USERPOOL_ID=$(jq -r 'to_entries|.[]|select (.key=="AmfaStack")|.value|.AmfaUserPoolId' ../apersona_idp_deploy_outputs.json)
    ENDUSER_HOSTEDUI_URL=$(jq -r 'to_entries|.[]|select (.key=="AmfaStack")|.value|.AmfaOauthDomain' ../apersona_idp_deploy_outputs.json)

    mobileTokenApiClientId=$(jq -rc '.AmfaStack.AmfamobileTokenApiClientId' ../apersona_idp_deploy_outputs.json)
    mobileTokenApiClientSecret=$(jq -rc '.AmfaStack.AmfamobileTokenApiClientSecret' ../apersona_idp_deploy_outputs.json)
    mobileTokenAuthEndpointUri=$(jq -rc '.AmfaStack.AmfamobileTokenAuthEndpointUri' ../apersona_idp_deploy_outputs.json)
    mobileTokenApiEndpointUri=$(jq -rc '.AmfaStack.AmfamobileTokenApiEndpointUri' ../apersona_idp_deploy_outputs.json)

    mobileTokenAuthEndpointUri=$(jq -rn --arg x "$mobileTokenAuthEndpointUri" '$x|@uri')
    mobileTokenApiEndpointUri=$(jq -rn --arg x "$mobileTokenApiEndpointUri" '$x|@uri')

    installParam=$(aws secretsmanager get-secret-value --region $CDK_DEPLOY_REGION --secret-id "apersona/$TENANT_ID/install" | jq -r .SecretString | jq -r -c .registRes)
    asmClientSecretKey=$(echo $installParam | jq -r .asmClientSecretKey)

    echo_time "update asm tenant mobile token details"
    ## echo "debug - : curl -X POST \"$ASM_PORTAL_URL/updateAsmClientMobileTokenDetails.ap\" -H \"Content-Type:application/json\" -d \"{\\\"mobileTokenApiClientId\\\":\\\"$mobileTokenApiClientId\\\",\\\"mobileTokenApiClientSecret\\\":\\\"$mobileTokenApiClientSecret\\\",\\\"mobileTokenAuthEndpointUri\\\":\\\"$mobileTokenAuthEndpointUri\\\",\\\"asmClientSecretKey\\\":\\\"$asmClientSecretKey\\\",\\\"mobileTokenApiEndpointUri\\\":\\\"$mobileTokenApiEndpointUri\\\",\\\"asmClientId\\\":$ASM_PROVIDER_ID}\""

    passSecretRes=$(curl -X POST "$ASM_PORTAL_URL/updateAsmClientMobileTokenDetails.ap" -H "Content-Type:application/json" -d "{\"mobileTokenApiClientId\":\"$mobileTokenApiClientId\",\"mobileTokenApiClientSecret\":\"$mobileTokenApiClientSecret\",\"mobileTokenAuthEndpointUri\":\"$mobileTokenAuthEndpointUri\",\"asmClientSecretKey\":\"$asmClientSecretKey\",\"mobileTokenApiEndpointUri\":\"$mobileTokenApiEndpointUri\",\"asmClientId\":$ASM_PROVIDER_ID}" 2>/dev/null)
    updateMobSecStatsCode=$(echo $passSecretRes | jq -r .code)
    if [ "$updateMobSecStatsCode" != "200" ]; then
        echo_time "update mobile token details error - "$passSecretRes
        exit 1
    else
        echo "update mobile token details success"
    fi

    cd ..
    cd $APERSONAADM_REPO_NAME

    export ADMINPORTAL_DOMAIN_NAME="adminportal.""$ROOT_DOMAIN_NAME"
    ADMINPORTAL_HOSTED_ZONE_ID=$(aws route53 list-hosted-zones | jq .HostedZones | jq 'map(select(.Name=="'$ADMINPORTAL_DOMAIN_NAME'."))' | jq -r '.[0]'.Id)
    if [ -z "$ADMINPORTAL_HOSTED_ZONE_ID" ] || [ "$ADMINPORTAL_HOSTED_ZONE_ID" = "null" ]; then
        echo "Creating hosted zone for $ADMINPORTAL_DOMAIN_NAME"
        ADMINPORTAL_HOSTED_ZONE_ID=$(aws route53 create-hosted-zone --name $ADMINPORTAL_DOMAIN_NAME --caller-reference $RANDOM | jq .HostedZone.Id)
        ADMINPORTAL_HOSTED_ZONE_ID=${ADMINPORTAL_HOSTED_ZONE_ID%?}
        NAME_SERVERS=$(aws route53 get-hosted-zone --id $ADMINPORTAL_HOSTED_ZONE_ID | jq .DelegationSet.NameServers)

        $(rm -rf ns_record.json)

        echo " {                         " >>ns_record.json
        echo "  \"Changes\": [{          " >>ns_record.json
        echo "  \"Action\": \"CREATE\",  " >>ns_record.json
        echo "  \"ResourceRecordSet\": { " >>ns_record.json
        echo "  \"Name\": \"$ADMINPORTAL_DOMAIN_NAME\", " >>ns_record.json
        echo "  \"Type\": \"NS\",        " >>ns_record.json
        echo "  \"TTL\": 300,            " >>ns_record.json
        echo "  \"ResourceRecords\": [   " >>ns_record.json

        count=0
        for NAME_SERVER in $NAME_SERVERS; do
            if [ $count = 1 ] || [ $count = 2 ] || [ $count = 3 ]; then
                echo "  { \"Value\": ${NAME_SERVER%?}}, " >>ns_record.json
            fi
            if [ $count = 4 ]; then
                echo "  { \"Value\": $NAME_SERVER} " >>ns_record.json
            fi
            ((count++))
        done

        echo "                       ]   " >>ns_record.json
        echo "  }}]                      " >>ns_record.json
        echo " }                         " >>ns_record.json

        RESULT=$(aws route53 change-resource-record-sets --hosted-zone-id $ROOT_HOSTED_ZONE_ID --change-batch file://ns_record.json)
        $(rm -rf ns_record.json)
    else
        ADMINPORTAL_DOMAIN_ID2=$(aws route53 list-hosted-zones | jq .HostedZones | jq 'map(select(.Name=="'$ADMINPORTAL_DOMAIN_NAME'."))' | jq -r '.[1]'.Id)
        if [ -z "$ADMINPORTAL_DOMAIN_ID2" ] || [ "$ADMINPORTAL_DOMAIN_ID2" = "null" ]; then
            echo "Hosted zone for $ADMINPORTAL_DOMAIN_NAME already exists"
        else
            echo "More than one Hosted zone for $ADMINPORTAL_DOMAIN_NAME are found. Correct this first then re-execute the install script"
        fi
    fi

    export ADMINPORTAL_HOSTED_ZONE_ID=${ADMINPORTAL_HOSTED_ZONE_ID#*zone/}
    echo "Admin Portal Hosted Zone ID is $ADMINPORTAL_HOSTED_ZONE_ID"

    npm install --legacy-peer-deps >/dev/null 2>&1
    # npm run build
    npm run cdk-build

    export SPPORTAL_DISTRIBUTION_ID=$(jq -r 'to_entries|.[]|select (.key=="AmfaStack")|.value|.AmfaSPPortalDistributionId' ../apersona_idp_deploy_outputs.json)
    export ADMINPORTAL_DISTRIBUTION_ID=$(jq -r 'to_entries|.[]|select (.key=="AmfaStack")|.value|.AmfaAdminPortalDistributionId' ../apersona_idp_deploy_outputs.json)

    npx cdk deploy "$@" --require-approval never --all --outputs-file ../apersona_idp_mgt_deploy_outputs.json

    # update admin frontend config with the deployed userpool id and appclient
    ADMINPORTAL_USERPOOL_ID=$(jq -r 'to_entries|.[]|select (.key=="SSO-CUPStack")|.value|.AdminPortalUserPoolId' ../apersona_idp_mgt_deploy_outputs.json)
    ADMINPORTAL_CLIENT_ID=$(jq 'to_entries|.[]|select (.key=="SSO-CUPStack")|.value|.AdminPortalAppClientId' ../apersona_idp_mgt_deploy_outputs.json)
    ADMINPORTAL_HOSTEDUI_URL=$(jq 'to_entries|.[]|select (.key=="SSO-CUPStack")|.value|.AdminLoginHostedUIURL' ../apersona_idp_mgt_deploy_outputs.json)

    if [ -z "$ADMINPORTAL_USERPOOL_ID" ] || [ -z "$ADMINPORTAL_CLIENT_ID" ] || [ -z "$ADMINPORTAL_HOSTEDUI_URL" ]; then
        echo "Admin Portal deployment failed"
        echo "Some resources are not generated"
    else
        rm -rf dist/amfaext.js
        echo "export const AdminPortalUserPoolId=\""$ADMINPORTAL_USERPOOL_ID"\"" >>dist/amfaext.js
        echo "export const AdminPortalClientId="$ADMINPORTAL_CLIENT_ID >>dist/amfaext.js
        echo "export const AdminHostedUIURL="$ADMINPORTAL_HOSTEDUI_URL >>dist/amfaext.js
        echo "export const SPPortalUrl='$SP_PORTAL_URL'" >>dist/amfaext.js
        echo "export const ProjectRegion='$CDK_DEPLOY_REGION'" >>dist/amfaext.js
        echo "export const AdminPortalDomainName='$ADMINPORTAL_DOMAIN_NAME'" >>dist/amfaext.js
        # deploy admin portal stack again
        # npm run build

        aws s3 rm s3://$CDK_DEPLOY_ACCOUNT-$CDK_DEPLOY_REGION-adminportal-amfa-web/amfaext.js
        aws s3 cp dist/amfaext.js s3://$CDK_DEPLOY_ACCOUNT-$CDK_DEPLOY_REGION-adminportal-amfa-web/amfaext.js

        aws cloudfront create-invalidation --distribution-id $ADMINPORTAL_DISTRIBUTION_ID --paths /amfaext.js >/dev/null 2>&1

        aws cognito-idp admin-create-user --username $ADMIN_EMAIL --user-attributes Name=email,Value=$ADMIN_EMAIL Name=email_verified,Value=true --desired-delivery-mediums EMAIL --user-pool-id $ADMINPORTAL_USERPOOL_ID >/dev/null 2>&1
    fi

    cd ..
    cd $APERSONAIDP_REPO_NAME

    ## generate spportal aws config file, redeploy again
    ENDUSER_CLIENT_ID=$(jq -r 'to_entries|.[]|select (.key=="SSO-CUPStack")|.value|.SpPortalAppClientID' ../apersona_idp_mgt_deploy_outputs.json)

    if [ -z "$ENDUSER_USERPOOL_ID" ] || [ -z "$ENDUSER_CLIENT_ID" ] || [ -z "$ENDUSER_HOSTEDUI_URL" ]; then
        echo "Get apersona AWS AMFA/AdminPortal deployment info failure"
        echo "End user SP Portal might have issue"
    else
        echo "generate SP front end config file"
        rm -rf spportal/dist/amfaext.js

        echo "export const AmfaServiceDomain='"$TENANT_ID"."$ROOT_DOMAIN_NAME"';" >>spportal/dist/amfaext.js
        echo "export const AdminAPIUrl='https://api.adminportal."$ROOT_DOMAIN_NAME"';" >>spportal/dist/amfaext.js
        echo "export const ProjectRegion='"$CDK_DEPLOY_REGION"';" >>spportal/dist/amfaext.js
        echo "export const EndUserPoolId='"$ENDUSER_USERPOOL_ID"';" >>spportal/dist/amfaext.js
        echo "export const EndUserAppClientId='"$ENDUSER_CLIENT_ID"';" >>spportal/dist/amfaext.js
        echo "export const OAuthDomainName='"$ENDUSER_HOSTEDUI_URL"';" >>spportal/dist/amfaext.js

        aws s3 rm s3://$CDK_DEPLOY_ACCOUNT-amfa-$TENANT_ID-login/amfaext.js
        aws s3 cp spportal/dist/amfaext.js s3://$CDK_DEPLOY_ACCOUNT-amfa-$TENANT_ID-login/amfaext.js

        aws cloudfront create-invalidation --distribution-id $SPPORTAL_DISTRIBUTION_ID --paths /amfaext.js >/dev/null 2>&1

    fi
    unset NODE_OPTIONS

    echo "Deploy finished"
    echo "***************"

else
    echo -e "${RED} You must execute this script from an EC2 instance which have an Admin Role attached${NC}"
fi
