import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { amfaSteps } from "./utils/amfaSteps.mjs";
import { fetchConfig } from './utils/fetchConfig.mjs';
import { checkSessionId } from './utils/checkSessionId.mjs';
import { deleteTotp, registotp } from './utils/totp/registOtp.mjs';
import { asmDeleteUser } from './utils/asmDeleteUser.mjs';
import { notifyProfileChange } from './utils/mailer.mjs';
import { deletePwdHashByUser } from './utils/passwordhash.mjs';
import { headers, responseWithRequestId } from './utils/amfaUtils.mjs';
import { adminGetSecrets, adminSetSmtp } from './utils/admingetsecrets.mjs';
import { validateEmail, validateTOTP, validateOTP, validatePhoneNumber } from './utils/inputValidate.mjs';
import { getProviderId } from './utils/totp/getKms.mjs';

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION, });

const C_OTP_TYPES = ['e', 'ae', 's', 'v', 't'];

const validateInputParams = (payload) => {
  if (payload.phase === 'admingetsecretinfo' || payload.phase === 'adminupdatesmtp') {
    // no email info need to check
    return (payload.tenantid)
  }
  if (!payload.email || validateEmail(payload.email)) return false;
  // check required params here
  switch (payload.phase) {
    case 'adminchecklicense':
      return (payload.email);
    case 'admindeletetotp':
    case 'admindeleteuser':
    case 'adminupdateuser':
      return (payload.email);
    case 'username':
      return (payload.email && payload.apti && payload.authParam);
    case 'password':
      return (payload.email && payload.password &&
        payload.apti && payload.authParam);
    case 'sendotp':
    case 'pwdreset2':
    case 'pwdreset3':
    case 'selfservice2':
    case 'selfservice3':
    case 'updateProfileSendOTP':
    case 'emailverificationSendOTP':
      return (payload.email && payload.otptype &&
        payload.apti && payload.authParam);
    case 'verifyotp':
    case 'pwdresetverify2':
    case 'pwdresetverify3':
    case 'selfserviceverify2':
    case 'selfserviceverify3':
      if (!C_OTP_TYPES.includes(payload.otptype)) return false;
      if (payload.otptype === 't' && validateTOTP(payload.otpcode)) return false;
      if (payload.otptype !== 't' && validateOTP(payload.otpcode)) return false;
      return (payload.email && payload.otpcode && payload.otptype &&
        payload.apti && payload.authParam);
    case 'emailverificationverifyotp':
      if (!C_OTP_TYPES.includes(payload.otptype)) return false;
      if (payload.otptype === 't' && validateTOTP(payload.otpcode)) return false;
      if (payload.otptype !== 't' && validateOTP(payload.otpcode)) return false;
      return (payload.email && payload.otpcode && payload.otptype &&
        payload.apti && payload.authParam && payload.attributes && payload.password);
    case 'updateProfile':
      if (!payload.otptype || !C_OTP_TYPES.includes(payload.otptype)) return false;
      if (payload.otptype === 't' && validateTOTP(payload.otpcode)) return false;
      if (payload.otptype !== 't' && validateOTP(payload.otpcode)) return false;
      if (payload.otptype === 'ae' && validateEmail(payload.newProfile)) return false;
      if ((payload.otptype === 's' || payload.otptype === 'v') && validatePhoneNumber(payload.newProfile)) return false;
      return (payload.email && payload.otpcode && payload.otptype &&
        payload.apti && payload.authParam && payload.uuid);
    case 'getOtpOptions':
    case 'getUserOtpOptions':
      return (payload.email && payload.authParam);
    case 'removeProfile':
      return (payload.email && payload.authParam && payload.profile && payload.otptype && C_OTP_TYPES.includes(payload.otptype));
    case 'registotp':
      return (payload.email && payload.uuid && payload.secretCode && payload.secretCode.length === 16 &&
        !validateTOTP(payload.sixDigits) && payload.tokenLabel && payload.tokenLabel.length <= 25);
    case 'confirmOTPAddress':
      return (payload.email && payload.authParam && payload.otpaddr && payload.otptype && C_OTP_TYPES.includes(payload.otptype))
    default:
      break;
  }

  console.log('Phase not found.', payload);

  return false;
};

const getIPFromHeader = (fwdfor) => {
  const IPs = fwdfor.split(',');
  return IPs[0];
}

// lambda for rest api
export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const requestId = Math.random().toString(36).substring(2, 16) + Math.random().toString(36).substring(2, 16);
  console.log('amfa requestid: ', requestId);

  let error = '';

  try {
    const payload = JSON.parse(event.body);

    console.log('payload', payload);

    if (payload && validateInputParams(payload)) {
      const amfaBrandings = await fetchConfig('amfaBrandings', dynamodb);
      const amfaPolicies = await fetchConfig('amfaPolicies', dynamodb);
      const amfaConfigs = await fetchConfig('amfaConfigs', dynamodb);

      switch (payload.phase) {
        case 'adminchecklicense':
          if (amfaConfigs.asmurl && amfaPolicies['default']) {
            console.log('check license, posting to', `${amfaConfigs.asmurl}/checkLic.kv?l=${amfaPolicies['default'].policy_name}&u=${payload.email}`)
            const checkRes = await fetch(`${amfaConfigs.asmurl}/checkLic.kv?l=${amfaPolicies['default'].policy_name}&u=${payload.email}`, {
              method: "POST"
            });
            console.log('check license result', checkRes);
            let data = {}
            try {
              data = await checkRes.json();
            }
            catch (err) {
              console.error('check license result error', err, ' checkRes', checkRes)
            }
            return responseWithRequestId(data?.code, 'OK', requestId);
          }
          else {
            return responseWithRequestId(422, error, requestId);
          }
        case 'admindeletetotp':
          return await deleteTotp(headers, payload.email, amfaConfigs,
            requestId, client, true, dynamodb, amfaBrandings.email_logo_url, amfaBrandings.service_name, true);
        case 'admindeleteuser':
          {
            console.log('asm delete user payload', payload);
            const provider_id = await getProviderId();
            const results = await Promise.allSettled([
              asmDeleteUser(headers, payload.email, amfaConfigs, requestId, amfaPolicies, payload.admin),
              deleteTotp(headers, payload.email, amfaConfigs,
                requestId, client, false, dynamodb, amfaBrandings.email_logo_url, amfaBrandings.service_name, true, provider_id),
              deletePwdHashByUser(payload.email, dynamodb, amfaConfigs),
            ])
            console.log('admin delete user promises result:', results);
          }
          return responseWithRequestId(200, 'OKay', requestId)
        case 'adminupdateuser':
          console.log('admin update user - otptypes', payload.otptype, ' newProfileValue')
          await notifyProfileChange(payload.email,
            payload.otptype, payload.newProfileValue,
            amfaBrandings.email_logo_url, amfaBrandings.service_name, true);
          return;
        case 'adminupdatesmtp':
          console.log('admin update smtp', payload);
          const updateSmtpResult = await adminSetSmtp(payload);
          if (updateSmtpResult) {
            return responseWithRequestId(200, 'OK', requestId)
          }
          return responseWithRequestId(404, payload.tenantid, requestId);
        case 'admingetsecretinfo':
          console.log('admin get secret of tenants', payload.tenantid);
          const result = await adminGetSecrets(payload.tenantid);
          if (result) {
            return responseWithRequestId(200, result, requestId)
          }
          return responseWithRequestId(404, payload.tenantid, requestId);
        case 'registotp':
          const isValidUuid = await checkSessionId(payload, payload.uuid, dynamodb);
          if (isValidUuid) {
            const provider_id = await getProviderId();
            return await registotp(headers, payload, amfaConfigs,
              requestId, amfaBrandings.email_logo_url, amfaBrandings.service_naem, provider_id,
              client, dynamodb);
          }
          break;
        case 'removeProfile':
          if (payload.otptype === 't') {
            console.log('removeProfile check uuid');
            const isValidUuid = await checkSessionId(payload, payload.uuid, dynamodb);
            console.log('isValidUuid', isValidUuid);
            if (isValidUuid) {
              const provider_id = await getProviderId();

              return await deleteTotp(
                headers,
                payload.email,
                amfaConfigs,
                requestId,
                client,
                true,
                dynamodb,
                amfaBrandings.email_logo_url,
                amfaBrandings.service_name,
                false,
                provider_id
              );
            }
          }
          break;
        default:
          break;
      }

      // santise and format the input data 
      payload.uIP = getIPFromHeader(event.headers['X-Forwarded-For'].trim());;
      payload.email = payload.email?.trim()?.toLowerCase();
      payload.origin = `${process.env.TENANT_ID}.${process.env.DOMAIN_NAME}`;
      payload.otptype = payload.otptype?.toLowerCase();
      payload.requestTimeEpoch = event.requestContext.requestTimeEpoch;
      payload.newProfile = payload.newProfile ? payload.newProfile.toLowerCase() : '';
      payload.profile = payload.profile ? payload.profile.toLowerCase() : '';
      payload.cookies = event.headers['Cookie'];

      console.log('oneEvent', payload);

      switch (payload.phase) {
        case 'username':
          const res = await client.send(new ListUsersCommand({
            UserPoolId: process.env.USERPOOL_ID,
            Filter: `email = "${payload.email}"`,
          }));

          console.log('phase username ListUser Result ', res);

          if (res && res.Users && res.Users.length > 0) {
            const stepOneResponse = await amfaSteps(payload, headers, client,
              payload.phase, amfaBrandings, amfaPolicies, amfaConfigs, dynamodb);
            return stepOneResponse;
          }
          else {
            // login request, but no such user found
            // allow the UI proceed further to avoid username enumeration attack.
            return responseWithRequestId(202, 'Your identity requires password login.', requestId);
          }
        default:
          const stepResponse = await amfaSteps(payload, headers, client, payload.phase,
            amfaBrandings, amfaPolicies, amfaConfigs, dynamodb);
          return stepResponse;
      }
    } else {
      error = 'incoming params error.';
      return responseWithRequestId(422, error, requestId);
    }
  } catch (err) {
    console.error('error details:', err);
    return responseWithRequestId(
      err.statusCode ? err.statusCode : 511,
      'input param parse error',
      requestId
    );
  }

};
