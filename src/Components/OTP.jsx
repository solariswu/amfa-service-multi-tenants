import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { Button, Spinner } from 'reactstrap';

import { apiUrl, applicationUrl } from '/const.js';
import InfoMsg from './InfoMsg';
import { getApti } from './utils';
import { useFeConfigs } from '../DataProviders/FeConfigProvider';
import { OTPDialog } from './OTPDialog';
import { useTranslation } from 'react-i18next';

export const OTP = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const config = useFeConfigs();

  const [msg, setMsg] = useState({ msg: '', type: '' });

  const [isLoading, setLoading] = useState(false);
  const [otp, setOtp] = useState({ type: '', code: '', addr: '', stage: 1 });
  const [data, setData] = useState(null);
  const [showOTP, setShowOTP] = useState(false);
  const [otpInFly, setOtpInFly] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogOtp, setDialogOtp] = useState('');
  const toggle = () => setDialogOpen(!dialogOpen)
  const [apti, setApti] = useState(null);
  const { t } = useTranslation();

  const useFocus = () => {
    const htmlElRef = useRef(null)
    const setFocus = () => { htmlElRef.current && htmlElRef.current.focus() }

    return [htmlElRef, setFocus]
  }
  const [inputRef, setInputFocus] = useFocus()

  useEffect(() => {
    if (otpInFly && otpInFly !== '') {
      setInputFocus()
    }
  }, [otpInFly])


  const setInfoMsg = (msg) => {
    setMsg({ msg, type: 'info' });
  }

  const setErrorMsg = (msg) => {
    setMsg({ msg, type: 'error' });
  }

  useEffect(() => {

    const getUserOtpOptions = async () => {
      // get the data from the api
      const params = {
        email: location.state?.email,
        rememberDevice: false,
        authParam: window.getAuthParam(),
        phase: 'getUserOtpOptions'
      };

      setLoading(true);
      try {
        const response = await fetch(`${apiUrl}/amfa`, {
          method: 'POST',
          body: JSON.stringify(params),
          credentials: 'include',
        });
        // convert the data to json
        // console.log('getUserOtpOptions response', response);
        const json = await response.json();
        // console.log('getotpconfig json', json);
        setLoading(false);

        if (!response.ok) {
          localStorage.setItem('OTPErrorMsg', json.message);
          // window.history.go(-4);
          window.location.assign(`${applicationUrl}?err=${json.message}`);
          return;
        }

        setData(json);
        if (config?.update_profile_force_mobile_token_first_if_registered &&
          json.mobileToken) {
          sendOtp('t');
          setOtpInFly('t');
          setOtp({ ...otp, type: 't' });
          setApti(getApti());
        }
        setShowOTP(true);
        // console.log('get otpoptions response: ', json);
      } catch (error) {
        console.error(error);
        setLoading(false);
        setErrorMsg('Error fetching data from the server');
        return;
      }
    }

    if (!location.state) {
      navigate('/selfservice');
      return;
    }
    else {
      setShowOTP(false);
      setOtp({ type: '', code: '', addr: '', stage: 1 });
      setLoading(false);
      setData(null);
      setErrorMsg('');

      window.history.pushState('fake-route', document.title, window.location.href);

      window.addEventListener('popstate', () => console.log('back pressed in MFA'));

      if (location.state?.type === 'passwordreset' || location.state?.type === 'otpmethods') {
        // call the function
        getUserOtpOptions();
      }
      else {
        // if the type is not passwordreset or updateotp, then we need to navigate to the home page
        navigate('/');
        return;
      }
      return () => {
        window.removeEventListener('popstate', () => console.log('back pressed in MFA'));
        // If we left without using the back button, aka by using a button on the page, we need to clear out that fake history event
        if (window.history.state === 'fake-route') {
          window.history.back();
        }
        setShowOTP(false);
      };
    }

  }, [location.state, navigate]);

  const authParam = window.getAuthParam();

  const email = location.state?.email;

  const amfaStepPrefix = location.state?.type === 'passwordreset' ? 'pwdreset' : 'selfservice';

  const setOTPCode = (e) => {
    setOtp({ ...otp, code: e.target?.value ? e.target.value : '' });
  }

  const confirmLogin = (e) => {
    if (e.key === "Enter") {
      verifyOtp(e);
    }
  }

  const sendOtp = async (otptype, e) => {
    if (e) e.preventDefault();
    // console.log('sendOtp, with type', otptype)

    // ignore resend for mobile otp
    if (otptype === otpInFly && otptype === 't') {
      return
    }

    if (otptype !== '' && (otptype === 't' || otptype === otpInFly)) {
      // mobile otp or resend otp
      await sendOtpConfirmed(otptype)
    }
    else {
      // initiate send for non mobile otp
      setDialogOtp(otptype);
      setDialogOpen(true);
    }
  }

  const sendOtpConfirmed = async (otptype) => {
    // console.log('sending oto for otptype', otptype)
    setOtp({ ...otp, type: otptype });
    setDialogOtp('');

    let otpApti = apti;

    if (otptype !== otpInFly)
      otpApti = getApti();

    const sendOtpParams = {
      email,
      rememberDevice: false,
      authParam,
      apti: otpApti,
      otptype,
      phase: `${amfaStepPrefix}${otp.stage + 1}`,
      isResend: otptype === otpInFly,
    };

    setLoading(true);
    setErrorMsg('');
    try {
      const result = await fetch(`${apiUrl}/amfa`, {
        method: 'POST',
        body: JSON.stringify(sendOtpParams),
        credentials: 'include',
      });

      // console.log('result', result);

      const resultMsg = await result.json();
      // console.log('resultMsg:', resultMsg);
      // console.log('otptype:', otptype);

      switch (result.status) {
        case 202:
          if (resultMsg.message) {
            if (otptype !== 't') {
              // mobile TOTP no need to display sent message
              setInfoMsg(resultMsg.message);
            }
            setTimeout(() => {
              setInfoMsg('');
            }, 8000);
            setOtpInFly(otptype);
            setApti(otpApti);
          }
          else {
            navigate('/selfservice', {
              state: {
                selfservicemsg: 'Unknown OTP send error, please contact help desk.'
              }
            })
            return;
          }
          break;
        case 401:
          navigate('/selfservice', {
            state: {
              selfservicemsg: resultMsg.message ? resultMsg.message :
                'Unknown OTP send error, please contact help desk.'
            }
          })
          return;
        default:
          let msg = 'Unknown error, please contact help desk.';
          if (resultMsg) {
            msg = resultMsg.message ? resultMsg.message : resultMsg.name ? resultMsg.name : JSON.stringify(resultMsg);
          }
          navigate('/selfservice', {
            state: {
              selfservicemsg: msg
            }
          })
          return;;
      }
      setLoading(false);
    }
    catch (err) {
      console.error('error in Dual OTP', err);
      setErrorMsg('Dual OTP error, please contact help desk.');
      setLoading(false);
    }
  }

  const verifyOtp = async (e) => {

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
      rememberDevice: false,
      authParam,
      apti,
      otptype: otp.type,
      otpcode: otp.code,
      state: '',
      redirectUri: '',
      phase: `${amfaStepPrefix}verify${otp.stage + 1}`,
    };

    // console.log('verify otp params:', verifyOtpParams);

    setLoading(true);
    setOtp({ ...otp, code: '', addr: '' });
    setErrorMsg('');
    try {
      const result = await fetch(`${apiUrl}/amfa`, {
        method: 'POST',
        body: JSON.stringify(verifyOtpParams),
        credentials: 'include',
      });

      // console.log('verify otp result:', result);
      // console.log('otp state:', otp);
      switch (result.status) {
        case 200:
          const response = await result.json();
          // console.log('otp response:', response);
          if (otp.stage === 1) {
            setOtp({ ...otp, type: '', code: '', addr: '', stage: otp.stage + 1 });

            let idx = data?.otpOptions.findIndex(option => option === otp.type);
            // console.log('idx:', idx);
            // console.log('count:', OTPMethodsCount);

            if (idx > -1 && OTPMethodsCount > 1) {
              data.otpOptions.splice(idx, 1);

              if ((otp.type === 's' || otp.type === 'v') &&
                data.phoneNumber && data.phoneNumber.length > 0 && data.phoneNumber === data.vPhoneNumber) {
                const duplicate = otp.type === 's' ? 'v' : 's';
                idx = data.otpOptions.findIndex(option => option === duplicate);
                data.otpOptions.splice(idx, 1);
              }
            }
            else {
              if (OTPMethodsCount === 1) {
                navigate(`/${location.state.type}`, {
                  state: {
                    email,
                    apti,
                    uuid: response.uuid,
                    validated: true,
                    otpData: data,
                    backable: false,
                    from: 'otp',
                  }
                });
                // console.log ('count === 1, location.state:', location.state);
              }
              else {
                // could not find the verified OTP method in the array, unexpected
                localStorage.setItem('OTPErrorMsg', 'Dual OTP verification error, please contact help desk.');
                // window.history.go(-4);
                window.location.assign(`${applicationUrl}?amfa=relogin`);
              }
            }
            setLoading(false);
            setOtpInFly('');
            return;
          }
          // console.log('otp state:', otp);
          // console.log('response:', response);
          if (otp.stage === 2 && response.uuid && response.uuid.length > 0) {
            navigate(`/${location.state.type}`, {
              state: {
                email,
                apti,
                uuid: response.uuid,
                validated: true,
                otpData: data,
                backable: false,
                from: 'otp',
              }
            })
          }
          else {
            // unexpected
            navigate('/selfservice', {
              state: {
                selfservicemsg: 'Dual OTP verification error, please contact help desk.'
              }
            })
          }
          return;
        case 401:
          const resultMsg = await result.json();

          navigate('/selfservice', {
            state: {
              selfservicemsg: resultMsg.message ? resultMsg.message : 'Unknown error, please contact help desk.'
            }
          })
          return;
        case 403:
          const resMsg = await result.json();
          if (resMsg) {
            setErrorMsg(resMsg.message ? resMsg.message : resMsg.name ? resMsg.name : JSON.stringify(resMsg));
            setOTPCode('');
          }
          else {
            navigate('/selfservice', {
              state: {
                selfservicemsg: 'Unknown error, please contact help desk.'
              }
            });
            return;
          }
          break;
        case 203:
        default:
          const res = await result.json();
          let msg = 'Unknown error, please contact help desk.'
          if (res) {
            msg = res.message ? res.message : res.name ? res.name : JSON.stringify(res);
          }

          navigate('/selfservice', {
            state: {
              selfservicemsg: msg
            }
          });
      }
      setLoading(false);
    }
    catch (err) {
      setLoading(false);
      console.error('error in otp password reset/selfservice', err);
      setErrorMsg('OTP verify error, please contact help desk.');
      setOTPCode('');
    }
  }

  let OTPMethodsCount = 1;

  if (showOTP && data?.otpOptions) {
    data.otpOptions.forEach((option) => {
      switch (option) {
        case 'ae':
          if (data.aemail)
            OTPMethodsCount++;
          break;
        case 's':
          if (data.phoneNumber)
            OTPMethodsCount++;
          break;
        case 'v':
          if (data.vPhoneNumber && data.vPhoneNumber !== data.phoneNumber)
            OTPMethodsCount++;
          break;
        case 't':
          if (data.mobileToken)
            OTPMethodsCount++;
          break;
        default:
          break;
      }
    })
  }

  const OTPElement = ({ otptype }) => {
    const maskedEmail = `${email[0]}xxx@${email[email.lastIndexOf('@') + 1]}xx.${email.substring((email.lastIndexOf('.') + 1))}`;
    const table = {
      e: {
        title: 'Email',
        content: maskedEmail,
      },
      ae: {
        title: 'Alt-Email',
        content: data?.aemail ? `${data.aemail}` : null,
      },
      s: {
        title: 'SMS',
        content: data?.phoneNumber ? `${data.phoneNumber}` : null,
      },
      v: {
        title: 'Voice',
        content: data?.vPhoneNumber ? `${data.vPhoneNumber}` : null,
      },
      t: {
        title: 'Mobile TOTP',
        content: data?.mobileToken ? `${config?.branding.mobile_token_svc_name ? config.branding.mobile_token_svc_name : 'amfa'}\n${maskedEmail}` : null,
      },
    };

    return (table[otptype]?.content &&
      <div className='row'>
        <div className='col-5 mt-2 text-left'>
          {table[otptype].title}:
        </div>
        <div className='col mt-2 text-left'>
          <span
            className={(otpInFly === 't') ? '' : 'link-customizable'}
            onClick={(e) => {
              if (otpInFly !== 't') sendOtp(otptype, e)}}
          >
            {table[otptype].content}
          </span>
          {
            otpInFly === '' && otptype === 't' &&
            <div style={{ fontSize: '0.7em', fontStyle: 'italic' }}>
              {data?.mobileToken}
            </div>
          }
          {
            otpInFly === otptype &&
            <div style={{ fontSize: '0.7em', fontStyle: 'italic' }}>
              {otptype === 't' ? data?.mobileToken : '(resend code)'}
            </div>
          }
        </div>
      </div>
    )
  }

  const OTPPageTitle = ({ type, typeExtra }) =>
    <>
      <span><h4>
        {
          typeExtra === 'RESET_REQUIRED' || typeExtra === 'PASSWORD_EXPIRED' ?
            t('force_password_reset_page_header') :
            type === 'passwordreset' ?
              t('password_reset_page_header') :
              t('update_profile_app_main_page_header')
        }
      </h4> </span>
      {typeExtra === 'PASSWORD_EXPIRED' && 'Your password is expired'}
    </>

  const SubjectMessage = ({ otpInFly, OTPMethodsCount, currentStage }) => {
    if (otpInFly === '') {
      if (OTPMethodsCount === 1 && currentStage !== 2) {
        // with mobile TOTP, OTPMethodsCount would be one when there is another MFA other than mobile TOTP
        return (<>Access requires a verification.<br /> Click your ID below to receive a one time verification code</>)
      }
      return (currentStage === 2 ? t('update_profile_app_verify2_message') : t('update_profile_app_verify1_message'))
    }

    if (otpInFly === 't') {
      return (<>Please enter your mobile authenticator one-time code below and click Verify.</>)
    }

    return t('update_profile_app_verify_retreive_message')
  }

  return (
    <>
      <OTPDialog
        username={location.state?.email}
        otptype={dialogOtp}
        sendOtpConfirmed={sendOtpConfirmed}
        open={dialogOpen}
        toggle={toggle}
      />
      <OTPPageTitle type={location.state?.type} typeExtra={location.state?.typeExtra} />
      <div style={{ height: "0.2em" }} />
      <hr className='hr-customizable' />
      <div>
        <span style={{ lineHeight: '1rem', color: 'grey' }} >
          {
            showOTP ?
              <SubjectMessage OTPMethodsCount={OTPMethodsCount} otpInFly={otpInFly} currentStage={otp.stage} /> :
              <Spinner color="primary" >{''}</Spinner>
          }
        </span>
      </div>
      <hr className='hr-customizable' />
      {showOTP &&
        data?.otpOptions.map((option) => ((otpInFly === '' || otpInFly === option) && <OTPElement otptype={option} />))}
      <br />
      <div>
        {otpInFly !== '' &&
          <>
            <input
              name="otpcode" id="otpcode" type="tel"
              className="form-control inputField-customizable"
              placeholder={otpInFly === 't' ? "######" : "####"}
              style={{
                width: '42%', margin: 'auto 10px',
                display: 'inline', height: '40px', textAlign: 'justify'
              }}
              autoCapitalize="none"
              autoFocus
              required
              aria-label="otp code"
              value={otp.code}
              onChange={setOTPCode}
              onKeyUp={e => confirmLogin(e)}
              disabled={isLoading || otpInFly === ''}
              ref={inputRef}
            />
            <Button
              name='verifyotp'
              type='submit'
              className='btn btn-primary submitButton-customizable'
              style={{ width: '42%', margin: 'auto 10px', display: 'inline', height: '40px' }}
              disabled={isLoading || otpInFly === ''}
              onClick={verifyOtp}
            >
              {isLoading ? showOTP ? 'Sending...' : 'Checking...' : 'Verify'}
            </Button>
          </>
        }
        {!isLoading && showOTP &&
          (((config?.update_profile_force_mobile_token_first_if_registered && data?.mobileToken && otpInFly === 't') ||
            (OTPMethodsCount === 1) || otpInFly === '') ?
            <Button name="back" type="submit" className="btn btn-secondary submitButton-customizable-back"
              onClick={() => window.location.assign(applicationUrl)}
            >
              Back to Login
            </Button>
            :
            <Button name='changeotp' type="submit" className="btn btn-secondary submitButton-customizable-back"
              onClick={() => setOtpInFly('')}
            >
              Try another Channel
            </Button>)
        }
      </div>
      <br />
      {showOTP && <InfoMsg isLoading={isLoading} msg={msg} />}
    </>
  );
}