import {useState, useEffect} from 'react';
import {useNavigate, useLocation} from 'react-router-dom';

import {Button} from 'reactstrap';

import {apiUrl, applicationUrl} from '/const.js';
import {useFeConfigs} from '../DataProviders/FeConfigProvider';
import InfoMsg from '../Components/InfoMsg';
import {useTranslation} from 'react-i18next';

const MFAContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const config = useFeConfigs();

  const [msg, setMsg] = useState({msg: '', type: ''});
  const [isLoading, setLoading] = useState(false);
  const [otp, setOtp] = useState({type: '', code: '', addr: ''});
  const [otpInFly, setOtpInFly] = useState('');

  const {t} = useTranslation();

  useEffect(() => {
    if (!location.state) {
      navigate('/');
      return;
    } else {
      window.history.pushState(
        'fake-route',
        document.title,
        window.location.href
      );

      window.addEventListener('popstate', () =>
        console.log('back pressed in MFA')
      );
      return () => {
        window.removeEventListener('popstate', () =>
          console.log('back pressed in MFA')
        );
        // If we left without using the back button, aka by using a button on the page, we need to clear out that fake history event
        if (window.history.state === 'fake-route') {
          window.history.back();
        }
      };
    }
  }, [location.state, navigate]);

  const authParam = window.getAuthParam();

  const email = location.state?.email;
  const uuid = location.state?.uuid;
  const rememberDevice = location.state?.rememberDevice;
  const apti = location.state?.apti;
  const state = location.state?.state;
  const redirectUri = location.state?.redirectUri;
  const aemail = location.state?.aemail;
  const phoneNumber = location.state?.phoneNumber;
  const vPhoneNumber = location.state?.vPhoneNumber;
  const mobileToken = location.state?.mobileToken;
  let otpOptions = location.state?.otpOptions;

  const setInfoMsg = (msg) => {
    setMsg({msg, type: 'info'});
  };

  const setErrorMsg = (msg) => {
    setMsg({msg, type: 'error'});
  };

  const setOTPCode = (e) => {
    e === ''
      ? setOtp({...otp, code: ''})
      : setOtp({...otp, code: e?.target?.value});
  };

  const confirmLogin = (e) => {
    if (e.key === 'Enter') {
      stepfour(e);
    }
  };

  const sendOtp = async (otptype) => {
    setOtp({...otp, type: otptype});

    const sendOtpParams = {
      email,
      rememberDevice,
      authParam,
      apti,
      otptype,
      state,
      redirectUri,
      phase: 'sendotp',
    };

    setLoading(true);
    setErrorMsg('');
    try {
      const result = await fetch(`${apiUrl}/amfa`, {
        method: 'POST',
        body: JSON.stringify(sendOtpParams),
        credentials: 'include',
      });

      switch (result.status) {
        case 202:
          const resultMsg = await result.json();
          if (resultMsg.message) {
            setInfoMsg(resultMsg.message);
            setTimeout(() => {
              setInfoMsg('');
            }, 8000);
            setOtpInFly(otptype);
          } else {
            setErrorMsg('Unknown OTP send error, please contact help desk.');
          }
          break;
        case 401:
          const resultMsg401 = await result.json();
          if (resultMsg401.message) {
            localStorage.setItem('OTPErrorMsg', resultMsg401.message);
            // window.history.go(-4);
            window.location.assign(
              `${applicationUrl}?err=${resultMsg401.message}`
            );
            return;
          } else {
            setErrorMsg('Unknown OTP send error, please contact help desk.');
          }
          break;
        default:
          const data = await result.json();
          if (data) {
            setErrorMsg(
              data.message
                ? data.message
                : data.name
                ? data.name
                : JSON.stringify(data)
            );
          } else {
            setErrorMsg('Unknown error, please contact help desk.');
          }
          break;
      }
      setLoading(false);
    } catch (err) {
      // console.error('error in OTP login', err);
      setErrorMsg('OTP login error, please contact help desk.');
      setLoading(false);
    }
  };

  const stepfour = async (e) => {
    if (!otp.code || otp.code.length < 1) {
      setErrorMsg('Please enter the verification code');
      return;
    }

    if (otp.type !== 't' && !/^\d{4,8}$/gm.test(otp.code)) {
      setErrorMsg('Please enter valid otp code');
      return;
    }

    if (otp.type === 't' && !/^\d{6}$/gm.test(otp.code)) {
      setErrorMsg('Please enter valid mobile token code');
      return;
    }

    const verifyOtpParams = {
      email,
      rememberDevice,
      authParam,
      apti,
      otptype: otp.type,
      otpcode: otp.code,
      state,
      redirectUri,
      phase: 'verifyotp',
    };

    // console.log('verify otp params:', verifyOtpParams);

    setLoading(true);
    setOtp({...otp, code: '', addr: ''});
    setErrorMsg('');
    try {
      const result = await fetch(`${apiUrl}/amfa`, {
        method: 'POST',
        body: JSON.stringify(verifyOtpParams),
        credentials: 'include',
      });

      switch (result.status) {
        case 200:
          const response = await result.json();
          // console.log('MFA login response', response);
          if (response.location) {
            window.location.assign(response.location);
            return;
          } else {
            setErrorMsg(
              'Unknown OTP verification system error, please contact help desk.'
            );
            setOtpInFly('');
          }
          break;
        case 401:
          // Send the user back to the login page with this error: "You took too long or entered your otp wrong too many times. Try your login again."
          const resultMsg = await result.json();
          if (resultMsg.message) {
            localStorage.setItem('OTPErrorMsg', resultMsg.message);
            // window.history.go(-4);
            window.location.assign(
              `${applicationUrl}?err=${resultMsg.message}`
            );
            return;
          } else {
            setErrorMsg(
              'Unknown OTP verification error, please contact help desk.'
            );
            setOTPCode('');
          }
          break;
        case 203:
        default:
          const data = await result.json();
          if (data) {
            setErrorMsg(
              data.message
                ? data.message
                : data.name
                ? data.name
                : JSON.stringify(data)
            );
          } else {
            setErrorMsg('Unknown error, please contact help desk.');
          }
          setOTPCode('');
          break;
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.error('error in password login', err);
      setErrorMsg('OTP login error, please contact help desk.');
      setOTPCode('');
    }
  };

  let OTPMethodsCount = 0;

  if (otpOptions) {
    otpOptions.forEach((option) => {
      switch (option) {
        case 'e':
          if (email) OTPMethodsCount++;
          break;
        case 'ae':
          if (aemail) OTPMethodsCount++;
          break;
        case 's':
          if (phoneNumber) OTPMethodsCount++;
          break;
        case 'v':
          if (vPhoneNumber && vPhoneNumber !== phoneNumber) OTPMethodsCount++;
          break;
        case 't':
          if (mobileToken) OTPMethodsCount++;
          break;
        default:
          break;
      }
    });
  }

  const OTPElement = ({otptype}) => {
    const maskedEmail = `${email[0]}xxx@${
      email[email.lastIndexOf('@') + 1]
    }xx.${email.substring(email.lastIndexOf('.') + 1)}`;

    const table = {
      e: {
        title: 'Email',
        content: maskedEmail,
      },
      ae: {
        title: 'Alt-Email',
        content: aemail ? aemail : null,
      },
      s: {
        title: 'SMS',
        content: phoneNumber ? phoneNumber : null,
      },
      v: {
        title: 'Voice',
        content: vPhoneNumber ? vPhoneNumber : null,
      },
      t: {
        title: 'Mobile TOTP',
        content: mobileToken
          ? `${
              config?.branding.mobile_token_svc_name
                ? config.branding.mobile_token_svc_name
                : 'amfa'
            }\n${maskedEmail}`
          : null,
      },
    };

    return (
      table[otptype].content && (
        <div className='row'>
          <div className='col-5 mt-2 text-left'>{table[otptype].title}:</div>
          <div className='col mt-2 text-left'>
            <span
              className={(otptype !== 't' || otpInFly !== otptype) ? 'link-customizable' : ''}
              onClick={() => {
                if (otptype !== 't' || otpInFly !== otptype) {
                  // only resend when it is not mobile OTP
                  sendOtp(otptype);
                }
              }}
            >
              {table[otptype].content}
            </span>
            {otpInFly === '' && otptype === 't' && (
              <div style={{fontSize: '0.7em', fontStyle: 'italic'}}>
                {mobileToken}
              </div>
            )}
            {otpInFly === otptype && (
              <div style={{fontSize: '0.7em', fontStyle: 'italic'}}>
                {otptype === 't' ? mobileToken : '(resend code)'}
              </div>
            )}
          </div>
        </div>
      )
    );
  };

  if (OTPMethodsCount === 0) {
    return (
      <div>
        <span>
          {' '}
          <h4>{t('login_app_verification_page_header')}</h4>{' '}
        </span>
        <hr className='hr-customizable' />
        <div>
          <span style={{lineHeight: '1rem', color: 'grey'}}>
            Your account does not have sufficient verification methods to log
            in. Please update your profile.
          </span>
          <hr className='hr-customizable' />
        </div>
        <div>
          <Button
            name='updateprofile'
            type='submit'
            className='btn btn-primary submitButton-customizable'
            onClick={() =>
              navigate('/otpmethods', {
                state: {
                  email,
                  uuid,
                  validated: true,
                  msg: {msg: '', type: ''},
                },
              })
            }
          >
            Update Profile
          </Button>
        </div>
      </div>
    );
  }

  const SubjectMessage = ({otpInFly, OTPMethodsCount}) => {
    if (otpInFly === '' || !otpInFly) {
      return OTPMethodsCount > 1
        ? t('login_app_verify_page_message')
        : t('login_app_verify_page_message2');
    }

    if (otpInFly === 't') {
      return (
        <>
          Please enter your mobile authenticator one-time code below and click
          Verify.
        </>
      );
    }

    return t('update_profile_app_verify_retreive_message');
  };

  return (
    <div>
      <span>
        {' '}
        <h4>{t('login_app_verification_page_header')}</h4>{' '}
      </span>
      <hr className='hr-customizable' />
      <div>
        <span style={{lineHeight: '1rem', color: 'grey'}}>
          <SubjectMessage
            otpInFly={otpInFly}
            OTPMethodsCount={OTPMethodsCount}
          />
        </span>
        <hr className='hr-customizable' />
      </div>
      {otpOptions.map(
        (option) =>
          (otpInFly === '' || otpInFly === option) && (
            <OTPElement otptype={option} />
          )
      )}
      <div style={{padding: '5px 0 0 0'}}>
        {otpInFly !== '' && (
          <>
            <input
              name='otpcode'
              id='otpcode'
              type='tel'
              className='form-control inputField-customizable'
              placeholder='####'
              style={{
                width: '40%',
                margin: 'auto 10px',
                display: 'inline',
                height: '40px',
              }}
              autoCapitalize='none'
              required
              aria-label='otp code'
              value={otp.code}
              onChange={setOTPCode}
              autoFocus
              onKeyUp={(e) => confirmLogin(e)}
              disabled={isLoading || otpInFly === ''}
            />
            <Button
              name='verifyotp'
              type='submit'
              className='btn btn-primary submitButton-customizable'
              style={{
                width: '40%',
                margin: 'auto 10px',
                display: 'inline',
                height: '40px',
              }}
              disabled={isLoading || otpInFly === ''}
              onClick={stepfour}
            >
              {isLoading ? 'Sending...' : 'Verify'}
            </Button>
          </>
        )}
        {!isLoading && otpInFly === ''}
        {!isLoading && (OTPMethodsCount <= 1 || otpInFly === '') && (
          <Button
            name='back'
            type='submit'
            className='btn btn-secondary submitButton-customizable-back'
            disabled={isLoading}
            onClick={() => window.location.assign(applicationUrl)}
          >
            Back to Login
          </Button>
        )}
        {!isLoading && otpInFly !== '' && OTPMethodsCount > 1 && (
          <Button
            name='changeotp'
            type='submit'
            className='btn btn-secondary submitButton-customizable-back'
            disabled={isLoading}
            onClick={() => setOtpInFly('')}
          >
            Try another Channel
          </Button>
        )}
      </div>
      <br />
      <InfoMsg isLoading={isLoading} msg={msg} />
    </div>
  );
};

const MFA = () => {
  return <MFAContent />;
};
export default MFA;
