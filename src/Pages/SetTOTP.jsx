import {useState, useEffect, useRef} from 'react';
import {useNavigate, useLocation} from 'react-router-dom';

import {Button, Spinner} from 'reactstrap';
import {apiUrl, applicationUrl} from '/const.js';
import {useFeConfigs} from '../DataProviders/FeConfigProvider';

import QRCode from 'qrcode';

const CONTENT = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const config = useFeConfigs();

  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoading, setLoading] = useState(false);
  const [hasQr, setHasQr] = useState(false);
  const [isQrLoading, setQrLoading] = useState(true);
  const [isUpdateDone, setUpdateDone] = useState(false);

  const [sixDigits, setSixDigits] = useState('');
  const [tokenLabel, setTokenLabel] = useState('');
  const [secretCode, setSecretCode] = useState('');

  const canvasRef = useRef();

  useEffect(() => {
    if (!location.state || !location.state.validated || !location.state.email) {
      navigate('/selfservice', {
        state: {
          selfservicemsg: null,
        },
      });
    }

    const randomCode = window.otplib.authenticator.generateSecret();

    setSecretCode(randomCode);
  }, [location.state, navigate]);

  const email = location.state?.email;
  const uuid = location.state?.uuid;

  const confirmLabel = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  const validateSixDigits = () => {
    if (!sixDigits || sixDigits.length !== 6) {
      setErrorMsg('Please enter 6 digits');
      return false;
    }

    return true;
  };

  const validateTokenLabel = async () => {
    if (!tokenLabel || tokenLabel.length < 1) {
      setErrorMsg('Please enter a label');
      return false;
    }

    if (tokenLabel && tokenLabel.length > 25) {
      setErrorMsg('Please enter a label');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateSixDigits && validateTokenLabel) {
      const options = {
        method: 'POST',
        body: JSON.stringify({
          email,
          uuid,
          secretCode,
          sixDigits,
          tokenLabel,
          phase: 'registotp',
        }),
      };

      setLoading(true);
      setErrorMsg('');
      try {
        const res = await fetch(`${apiUrl}/amfa`, options);
        // console.log('res', res);

        switch (res.status) {
          case 200:
            localStorage.setItem('OTPErrorMsg', '');
            setUpdateDone(true);
            break;
          default:
            const data = await res.json();
            let errMsg = 'Invalid Token, please try again.';
            if (data.message === 'NotAuthorizedException') {
              errMsg = 'Invalid credentials.';
            }
            setErrorMsg(errMsg);
            break;
        }
      } catch (err) {
        // console.log(err);
        setErrorMsg(
          'TOTP Set Failed. Please try again. If the problem persists, please contact help desk.'
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const genQRCode = (secretCode) => {
    // const totpUri = "otpauth://totp/MFA:" +  + "?secret=" + secretCode + "&issuer=amfa";
    const totpUri = window.otplib.authenticator.keyuri(
      location.state.email,
      config?.branding.mobile_token_svc_name,
      secretCode
    );

    const current = canvasRef.current;
    const size = 128;
    const errorCorrectionLevel = 'M';

    QRCode.toCanvas(
      current,
      totpUri || ' ',
      {
        width: `${size}px`,
        margin: 0,
        errorCorrectionLevel,
      },
      () => {
        // fix again the CSS because lib changes it –_–
        current.style.width = `${size}px`;
        current.style.height = `${size}px`;
        if (!hasQr) {
          setHasQr(true);
          setTimeout(() => {
            setQrLoading(false);
          }, 10);
        }
      }
      // (error) => error && console.error(error)
    );
  };

  const UpdateDone = () => {
    return (
      <div>
        <span className='idpDescription-customizable'>
          {' '}
          Your Mobile TOTP has been set up successfully.{' '}
        </span>
        <br />
        <Button
          name='confirm'
          type='submit'
          className='btn btn-primary submitButton-customizable'
          variant='success'
          onClick={
            {applicationUrl}
              ? () => window.location.assign(applicationUrl) // window.history.go(-3) :
              : () => window.close()
          }
        >
          {applicationUrl ? 'Return to the Login Page' : 'Close this window'}
        </Button>
        <Button
          name='back'
          type='submit'
          className='btn btn-secondary submitButton-customizable-back'
          variant='outline-success'
          onClick={() =>
            navigate('/otpmethods', {
              state: {
                email,
                uuid: location.state ? location.state.uuid : '',
                validated: true,
                msg: {msg: '', type: ''},
              },
            })
          }
        >
          {'Return to Update Profile'}
        </Button>
      </div>
    );
  };

  if (!config) {
    <div>
      <span>
        <h4>Set Mobile TOTP</h4>
      </span>
      <hr className='hr-customizable' />
      return <Spinner />
    </div>;
  }

  if (canvasRef.current && secretCode !== '' && !hasQr) {
    genQRCode(secretCode);
  }

  return (
    <div>
      <span>
        <h4>Set Mobile TOTP</h4>
      </span>
      <hr className='hr-customizable' />
      {isUpdateDone ? (
        <UpdateDone />
      ) : secretCode && secretCode.length > 0 ? (
        <div style={{textAlign: 'left'}}>
          <span className='idpDescription-customizable'>
            Open your Authorizator to Update it:
          </span>
          <div>1. Scan the code or enter the code. </div>
          <div>
            Your code:
            <span style={{color: '#2e6da4'}}>
              {' '}
              {secretCode.slice(0, 4)} {secretCode.slice(4, 8)}{' '}
              {secretCode.slice(8, 12)} {secretCode.slice(12, 16)}
            </span>
          </div>
          {/* used the following one to enforce screen update */}
          <div style={{textAlign: 'center', margin: '10px auto'}}>
            <canvas
              ref={canvasRef}
              style={{
                display: isQrLoading ? 'none' : 'block',
                margin: '0 auto',
              }}
            />
            {
              isQrLoading && (
                // <div className="modal-body" style={{ textAlign: 'center' }}>
                <Spinner color='primary' style={{margin: '1em auto'}}>
                  {''}
                </Spinner>
              )
              // </div>
            }
          </div>
          <div>2. Token Label. ex. iPhone X</div>
          <div className='input-group'>
            <input
              id='tokenlabel'
              name='tokenLabel'
              type='text'
              className='form-control inputField-customizable'
              style={{height: '40px'}}
              placeholder='Token Label'
              required
              value={tokenLabel}
              onChange={(e) => setTokenLabel(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>
          <div style={{marginTop: '15px'}}>3. Enter 6 digit result...</div>
          <div className='input-group'>
            <input
              id='totpResult'
              name='totpresult'
              type='text'
              className='form-control inputField-customizable'
              style={{height: '40px'}}
              placeholder='6 digit result'
              required
              value={sixDigits}
              onChange={(e) => setSixDigits(e.target.value)}
              disabled={isLoading}
              onKeyUp={(e) => confirmLabel(e)}
            />
          </div>
          <Button
            name='update'
            type='submit'
            className='btn btn-primary submitButton-customizable'
            variant='success'
            disabled={isLoading}
            onClick={!isLoading ? handleSubmit : null}
          >
            {isLoading ? 'Sending...' : 'Update'}
          </Button>
          {location.state && location.state.backable && (
            <Button
              name='back'
              type='submit'
              className='btn btn-secondary submitButton-customizable-back'
              variant='outline-success'
              disabled={isLoading}
              onClick={() =>
                navigate('/otpmethods', {
                  state: {
                    email,
                    uuid: location.state ? location.state.uuid : '',
                    validated: true,
                  },
                })
              }
              style={{marginTop: '10px'}}
            >
              {'Return to Update Profile'}
            </Button>
          )}
        </div>
      ) : null}
      {isLoading || !config ? (
        <span className='errorMessage-customizable'>
          <Spinner color='primary'>{''}</Spinner>
        </span>
      ) : (
        errorMsg && (
          <div>
            <br />
            <span className='errorMessage-customizable'>{errorMsg}</span>
          </div>
        )
      )}
    </div>
  );
};

const SetTOTP = () => {
  return <CONTENT />;
};
export default SetTOTP;
