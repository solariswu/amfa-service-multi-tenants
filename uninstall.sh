##!/bin/bash
unset TENANT_ID && unset ROOT_DOMAIN_NAME && unset ROOT_HOSTED_ZONE_ID && unset SP_PORTAL_URL && unset EXTRA_APP_URL && unset RECAPTCHA_KEY && unset RECAPTCHA_SECRET

source ./config.sh

if [ -z "$TENANT_ID" ]; then
    echo "TENANT_ID is not set, please set TENANT_ID in config.sh"
    exit 1
fi

if [ -z "$ASM_PORTAL_URL" ]; then
    echo "ASM_PORTAL_URL is not set, please set ASM_PORTAL_URL in config.sh"
    exit 1
fi

if [ -z "$ROOT_DOMAIN_NAME" ]; then
    echo "ROOT_DOMAIN_NAME is not set, please set ROOT_DOMAIN_NAME in config.sh"
    exit 1
fi

if [ -z "$ADMIN_EMAIL" ]; then
    echo "ADMIN_EMAIL is not set, please set ADMIN_EMAIL in config.sh"
    exit 1
fi

if [[ -z "$INSTALLER_EMAIL" || "$INSTALLER_EMAIL" = 'null' || "$INSTALLER_EMAIL" = '' ]]; then
    echo "INSTALLER_EMAIL is not set, using ADMIN_EMAIL as INSTALLER_EMAIL"
    export INSTALLER_EMAIL=$ADMIN_EMAIL
fi

if aws sts get-caller-identity >/dev/null; then

    source ~/.bashrc
    NODE_OPTIONS=--max-old-space-size=8192

    echo_time() {
        command echo $(date) "$@"
    }

    #get region and account by EC2 info
    TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
    EC2_AVAIL_ZONE=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone)
    export CDK_DEPLOY_REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region)
    export CDK_DEPLOY_ACCOUNT=$(aws sts get-caller-identity | jq -r .Account)

    #define colors
    RED='\033[0;31m'
    BOLD="\033[1m"
    YELLOW="\033[38;5;11m"
    NC='\033[0m' # No Color

    echo "-------------------------------------"
    echo "aPersona Identity Manager Uninstaller"
    echo "-------------------------------------"
    echo "aPersona Identity Services may take between 45 min to 1 hr 30 min to complete."
    echo ""

    while true; do
        read -p "Confirm to uninstall AMFA on Account $(echo -e $BOLD$YELLOW$CDK_DEPLOY_ACCOUNT$NC) in Region $(echo -e $BOLD$YELLOW$CDK_DEPLOY_REGION$NC)? (y/n)" response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            break
        elif [[ "$response" =~ ^([nN][oO]|[nN])$ ]]; then
            unset NODE_OPTIONS
            exit 0
        else
            echo "Please enter y or n"
        fi
    done

    spin[0]="-"
    spin[1]="\\"
    spin[2]="|"
    spin[3]="/"

    ADMINPORTAL_DOMAIN_NAME="adminportal.""$ROOT_DOMAIN_NAME"

    #check whether SSO-CUPStack exists
    if aws cloudformation describe-stacks --stack-name SSO-CUPStack >/dev/null 2>&1; then

        aws s3 rm s3://$CDK_DEPLOY_ACCOUNT-$CDK_DEPLOY_REGION-adminportal-amfa-web --recursive >/dev/null 2>&1
        aws s3 rm s3://$CDK_DEPLOY_ACCOUNT-$CDK_DEPLOY_REGION-adminportal-importusersjobs --recursive >/dev/null 2>&1
        aws cloudformation delete-stack --stack-name SSO-CUPStack >/dev/null 2>&1

        echo "[deleting admin portal stack]"
        StackStatus=''
        i=0
        while [[ "$StackStatus" != 'DELETE_COMPLETE' && "$StackStatus" != 'DELETE_FAILED' ]]; do
            if [ $i == 0 ]; then
                StackStatus=$(aws cloudformation list-stacks 2>/dev/null | jq .StackSummaries | jq 'map(select(.StackName=="'SSO-CUPStack'"))' | jq -r ".[0]".StackStatus)
                echo -ne "\r$StackStatus ${spin[$i]}"
            fi
            echo -ne "\b${spin[$i]}"
            sleep 0.3
            i=$((i + 1))
            i=$((i % 4))
        done
        if [[ "$StackStatus" == 'DELETE_FAILED' || -z "$StackStatus" ]]; then
            echo -e "AdminPortal service uninstall \b${RED} failed${NC}"
            exit 1
        else
            echo "succ: AdminPortal service uninstalled"
        fi
    else
        echo "warning: AdminPortal service not found"
    fi

    if aws cloudformation describe-stacks --stack-name APICertificateStack >/dev/null 2>&1; then

        aws cloudformation delete-stack --stack-name APICertificateStack >/dev/null 2>&1

        echo "[deleting AdminPortal API cert stack]"
        StackStatus=''
        i=0
        while [[ "$StackStatus" != 'DELETE_COMPLETE' && "$StackStatus" != 'DELETE_FAILED' ]]; do
            if [ $i == 0 ]; then
                StackStatus=$(aws cloudformation list-stacks 2>/dev/null | jq .StackSummaries | jq 'map(select(.StackName=="'APICertificateStack'"))' | jq -r ".[0]".StackStatus)
                echo -ne "\r$StackStatus ${spin[$i]}"
            fi
            echo -ne "\b${spin[$i]}"
            sleep 0.3
            i=$((i + 1))
            i=$((i % 4))
        done
        if [[ "$StackStatus" == 'DELETE_FAILED' || -z "$StackStatus" ]]; then
            echo -e "AdminPortal API cert stack uninstall \b${RED} failed${NC}"
            exit 1
        else
            echo "succ: AdminPortal API cert stack uninstalled"
        fi
    else
        echo "warning: AdminPortal API cert stack not found"
    fi

    if aws cloudformation describe-stacks --region us-east-1 --stack-name CertStack222 >/dev/null 2>&1; then

        aws cloudformation delete-stack --region us-east-1 --stack-name CertStack222 >/dev/null 2>&1

        echo "[deleting AdminPortal FE cert stack]"
        StackStatus=''
        i=0
        while [[ "$StackStatus" != 'DELETE_COMPLETE' && "$StackStatus" != 'DELETE_FAILED' ]]; do
            if [ $i == 0 ]; then
                StackStatus=$(aws cloudformation list-stacks --region us-east-1 2>/dev/null | jq .StackSummaries | jq 'map(select(.StackName=="'CertStack222'"))' | jq -r ".[0]".StackStatus)
                echo -ne "\r$StackStatus ${spin[$i]}"
            fi
            echo -ne "\b${spin[$i]}"
            sleep 0.3
            i=$((i + 1))
            i=$((i % 4))
        done
        if [[ "$StackStatus" == 'DELETE_FAILED' || -z "$StackStatus" ]]; then
            echo -e "AdminPortal FE cert stack uninstall \b${RED} failed${NC}"
            exit 1
        else
            echo "succ: AdminPortal FE cert uninstalled"
        fi
    else
        echo "warning: AdminPortal FE cert not found"
    fi

    #check whether AMFAStack exists
    if aws cloudformation describe-stacks --stack-name AmfaStack >/dev/null 2>&1; then
        aws s3 rm s3://$CDK_DEPLOY_ACCOUNT-amfa-$TENANT_ID-amfa --recursive >/dev/null 2>&1
        aws s3 rm s3://$CDK_DEPLOY_ACCOUNT-amfa-$TENANT_ID-login --recursive >/dev/null 2>&1
        aws cloudformation delete-stack --stack-name AmfaStack >/dev/null 2>&1
        echo -n "[deleting AMFA stack]"
        StackStatus=''
        i=0
        while [[ "$StackStatus" != 'DELETE_COMPLETE' && "$StackStatus" != 'DELETE_FAILED' ]]; do
            if [ $i == 0 ]; then
                StackStatus=$(aws cloudformation list-stacks 2>/dev/null | jq .StackSummaries | jq 'map(select(.StackName=="'AmfaStack'"))' | jq -r ".[0]".StackStatus)
                echo -ne "\r$StackStatus ${spin[$i]}"
            fi
            echo -ne "\b${spin[$i]}"
            sleep 0.3
            i=$((i + 1))
            i=$((i % 4))
        done
        if [[ "$StackStatus" == 'DELETE_FAILED' || -z "$StackStatus" ]]; then
            echo -e "AMFA service uninstall \b${RED} failed${NC}"
            exit 1
        else
            echo "succ: AMFA service uninstalled"
        fi
    else
        echo "warning: AMFA service not found"
    fi

    ## userpool deleted, remove saml proxy backend file
    samlproxyClientId=$(jq -rc '."SSO-CUPStack".SAMLProxyAppClientID' apersona_idp_mgt_deploy_outputs.json)
    samlproxyClientSecret=$(jq -rc '."SSO-CUPStack".SAMLProxyAppClientSecret' apersona_idp_mgt_deploy_outputs.json)
    deleteSamlProxyRes=$(curl -X DELETE "https://api.samlproxy.apersona-id.com/samlproxy/$TENANT_ID" -d "{\"uninstall\":\"True\", \"clientId\":\"$samlproxyClientId\", \"clientSecret\":\"$samlproxyClientSecret\"}" 2>/dev/null)

    if aws cloudformation describe-stacks --region us-east-1 --stack-name CertificateStack >/dev/null 2>&1; then

        aws cloudformation delete-stack --region us-east-1 --stack-name CertificateStack >/dev/null 2>&1

        echo "[deleting AMFA cert stack]"
        StackStatus=''
        i=0
        while [[ "$StackStatus" != 'DELETE_COMPLETE' && "$StackStatus" != 'DELETE_FAILED' ]]; do
            if [ $i == 0 ]; then
                StackStatus=$(aws cloudformation list-stacks --region us-east-1 2>/dev/null | jq .StackSummaries | jq 'map(select(.StackName=="'CertificateStack'"))' | jq -r ".[0]".StackStatus)
                echo -ne "\r$StackStatus ${spin[$i]}"
            fi
            echo -ne "\b${spin[$i]}"
            sleep 0.3
            i=$((i + 1))
            i=$((i % 4))
        done
        if [[ "$StackStatus" == 'DELETE_FAILED' || -z "$StackStatus" ]]; then
            echo -e "AMFA cert stack uninstall \b${RED} failed${NC}"
            exit 1
        else
            echo "succ: AMFA cert Stack uninstalled"
        fi
    else
        echo "warning: AMFA cert Stack not found"
    fi

    ## delete dynamodb tables for re-install
    echo "deleting db amfa config table"
    aws dynamodb delete-table --table-name amfa-$CDK_DEPLOY_ACCOUNT-$CDK_DEPLOY_REGION-configtable >/dev/null 2>&1
    ## shall be deleted only when all tenants deleted in multi-tenants, good for single tenant now.
    echo "deleting db amfa tenant table"
    aws dynamodb delete-table --table-name amfa-$CDK_DEPLOY_ACCOUNT-$CDK_DEPLOY_REGION-tenanttable >/dev/null 2>&1

    ## get totptoken and passwordhash table name in cdk output json and delete them here.
    totptokenTable=$(jq -rc '."AmfaStack".AmfaTotpTokenTable' apersona_idp_deploy_outputs.json)
    echo "deleting db totp token table"
    aws dynamodb delete-table --table-name $totptokenTable >/dev/null 2>&1

    pwdHashTable=$(jq -rc '."AmfaStack".AmfaPwdHashTable' apersona_idp_deploy_outputs.json)
    echo "deleting db pwd history hash table"
    aws dynamodb delete-table --table-name $pwdHashTable >/dev/null 2>&1

    ## delete subdomain DNS record here
    echo "removing adminportal domain from DNS"
    HOSTED_ZONE_IDs=$(aws route53 list-hosted-zones | jq .HostedZones | jq 'map(select(.Name=="'$ADMINPORTAL_DOMAIN_NAME'."))' | jq -r '.[]'.Id)
    for HOSTED_ZONE_ID in $HOSTED_ZONE_IDs; do
        HOSTED_ZONE_ID=${HOSTED_ZONE_ID#*zone/}
        batches=$(aws route53 list-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID | jq --compact-output '[.ResourceRecordSets[] | select((.Type == "A") or (.Type == "CNAME")) | {Action: "DELETE", ResourceRecordSet: {Name: .Name, Type: .Type, TTL: .TTL, ResourceRecords: .ResourceRecords}}] | _nwise(1) | {Changes: .}')
        for batch in $batches; do
            aws route53 change-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID --change-batch "$batch" >/dev/null 2>&1
        done
        aws route53 delete-hosted-zone --id $HOSTED_ZONE_ID >/dev/null 2>&1
    done

    echo "removing tenant subdomains from DNS"
    HOSTED_ZONE_IDs=$(aws route53 list-hosted-zones | jq .HostedZones | jq 'map(select(.Name=="'$TENANT_ID.$ROOT_DOMAIN_NAME'."))' | jq -r '.[]'.Id)
    for HOSTED_ZONE_ID in $HOSTED_ZONE_IDs; do
        HOSTED_ZONE_ID=${HOSTED_ZONE_ID#*zone/}
        batches=$(aws route53 list-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID | jq --compact-output '[.ResourceRecordSets[] | select((.Type == "A") or (.Type == "CNAME")) | {Action: "DELETE", ResourceRecordSet: {Name: .Name, Type: .Type, TTL: .TTL, ResourceRecords: .ResourceRecords}}] | _nwise(1) | {Changes: .}')
        for batch in $batches; do
            aws route53 change-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID --change-batch "$batch" >/dev/null 2>&1
        done
        aws route53 delete-hosted-zone --id $HOSTED_ZONE_ID >/dev/null 2>&1
    done

    echo "removing subdomains NS delegation from DNS"
    HOSTED_ZONE_IDs=$(aws route53 list-hosted-zones | jq .HostedZones | jq 'map(select(.Name=="'$ROOT_DOMAIN_NAME'."))' | jq -r '.[]'.Id)
    for HOSTED_ZONE_ID in $HOSTED_ZONE_IDs; do
        HOSTED_ZONE_ID=${HOSTED_ZONE_ID#*zone/}
        batches=$(aws route53 list-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID | jq --compact-output '[.ResourceRecordSets[] | select((.Type == "NS") and (.Name == "'adminportal.$ROOT_DOMAIN_NAME'.")) | {Action: "DELETE", ResourceRecordSet: {Name: .Name, Type: .Type, TTL: .TTL, ResourceRecords: .ResourceRecords}}] | _nwise(1) | {Changes: .}')
        for batch in $batches; do
            aws route53 change-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID --change-batch "$batch" >/dev/null 2>&1
        done
    done

    ## delete registration from asm
    echo_time "deleting registration from asm"
    installSecret=$(aws secretsmanager get-secret-value --secret-id apersona/$TENANT_ID/install)
    ASM_PROVIDER_ID=$(echo $installSecret | jq -rc '.SecretString' | jq -rc '.registRes' | jq -rc '.asmClientId')
    asmClientSecretKey=$(echo $installSecret | jq -rc '.SecretString' | jq -rc '.registRes' | jq -rc '.asmClientSecretKey')
    asmSecretKey=$(echo $installSecret | jq -rc '.SecretString' | jq -rc '.registRes' | jq -rc '.asmSecretKeyNew')
    ## debug
    #echo_time "curl -X POST \"$ASM_PORTAL_URL/deleteAsmClient.ap?requestedBy=$INSTALLER_EMAIL&asmSecretKey=$asmSecretKey&asmClientSecretKey=$asmClientSecretKey&asmClientId=$ASM_PROVIDER_ID\" -H \"Accept:application/json\""
    passSecretRes=$(curl -X POST "$ASM_PORTAL_URL/deleteAsmClient.ap?requestedBy=$INSTALLER_EMAIL&asmSecretKey=$asmSecretKey&asmClientSecretKey=$asmClientSecretKey&asmClientId=$ASM_PROVIDER_ID" -H "Accept:application/json")
    #echo "asm portal delete tenant result: "$passSecretRes

    ## delete secrets for re-install
    echo_time "deleting secrets"
    aws secretsmanager delete-secret --secret-id apersona/$TENANT_ID/asm --force-delete-without-recovery >/dev/null 2>&1
    aws secretsmanager delete-secret --secret-id apersona/$TENANT_ID/smtp --force-delete-without-recovery >/dev/null 2>&1
    aws secretsmanager delete-secret --secret-id apersona/$TENANT_ID/secret --force-delete-without-recovery >/dev/null 2>&1
    aws secretsmanager delete-secret --secret-id apersona/$TENANT_ID/install --force-delete-without-recovery >/dev/null 2>&1

    ## clean cross region exporter parameters
    echo_time "deleting installer cross region parameters"
    Params=$(aws ssm describe-parameters --parameter-filters "Key=Name,Option=Contains,Values=/AmfaStack/" --region $CDK_DEPLOY_REGION | jq .Parameters | jq .[].Name)
    for param_name in $Params; do
        aws ssm delete-parameter --name $param_name --region $CDK_DEPLOY_REGION >/dev/null 2>&1
    done
    Params=$(aws ssm describe-parameters --parameter-filters "Key=Name,Option=Contains,Values=/SSO-CUPStack/" --region $CDK_DEPLOY_REGION | jq .Parameters | jq .[].Name)
    for param_name in $Params; do
        aws ssm delete-parameter --name $param_name --region $CDK_DEPLOY_REGION >/dev/null 2>&1
    done

    ## get userpool ids first
    userpoolId=$(jq -rc '."AmfaStack".AmfaUserPoolId' apersona_idp_deploy_outputs.json)
    adminuserpoolId=$(jq -rc '."SSO-CUPStack".AdminPortalUserPoolId' apersona_idp_mgt_deploy_outputs.json)

    ## clear local files
    echo "clearing local files"
    rm -rf *.json *.txt *.sh aPersona-Identity-for-AWS-End-User-Services aPersona-Identity-for-AWS-Admin-Portal

    unset NODE_OPTIONS

    echo "*************************************************************************************"
    echo "uninstall finished"
    echo "***************"

    echo "Note: End User UserPool("$userpoolId") and Admin Userpool("$adminuserpoolId") are not deleted, please delete it manually in the console if needs."
else
    echo -e "${RED} You must execute this script from an EC2 instance which have an Admin Role attached${NC}"
fi

unset TENANT_ID && unset ROOT_DOMAIN_NAME && unset ROOT_HOSTED_ZONE_ID && unset SP_PORTAL_URL && unset EXTRA_APP_URL && unset RECAPTCHA_KEY && unset RECAPTCHA_SECRET
