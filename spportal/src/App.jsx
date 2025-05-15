import Favicon from "react-favicon";

import { Admin, Resource, houseLightTheme } from "react-admin";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "ra-language-english";

import authProvider from "./Component/authProvider";
import { dataProvider } from "./Component/dataProvider";
import LoginPage from "./Component/LoginPage";
import serviceproviders from "./serviceproviders";
import { AmfaLayout } from "./AmfaLayout";
import { useFeConfigs } from "./configs/FeConfigProvider";
import { BrowserRouter } from "react-router-dom";


const messages = {
  en: englishMessages,
};

const i18nProvider = polyglotI18nProvider((locale) => messages[locale], "en", {
  allowMissing: true,
});

export const App = () => {
  const branding = useFeConfigs();

  if (branding) {
    document.title = branding.app_title_msg;

    const userTheme = {
      ...houseLightTheme,
      sidebar: {
        width: 0, // The default value is 240
        closedwWidth: 0,
      },
      components: {
        ...houseLightTheme.components,
        RaAppBar: {
          styleOverrides: {
            root: {
              "& .RaAppBar-toolbar": {
                color: branding.app_title_icon_color,
                backgroundImage: `linear-gradient(310deg, ${branding.app_bar_end_color}, ${branding.app_bar_start_color})`,
              },
            },
          },
        },
      },
    };

    return (
      <>
        <Favicon url={branding.fav_icon_url} />
        <BrowserRouter>
          <Admin
            theme={userTheme}
            disableTelemetry
            authProvider={authProvider}
            dataProvider={dataProvider}
            loginPage={LoginPage}
            layout={AmfaLayout}
            locale="en" // Add this...
            i18nProvider={i18nProvider}
            requireAuth={true}
          >
            <Resource name="serviceproviders" {...serviceproviders} />
          </Admin>
        </BrowserRouter>
        <div
          style={{
            position: "fixed",
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 100,
            padding: 6,
            backgroundColor: "white",
            textAlign: "center",
            color: "grey",
            fontSize: "11px",
          }}
        >
          Copyright &copy; 2025 aPersona Inc. v1.1.0{" "}
          <a href={branding.app_privacy_url} target="_blank" rel="noreferrer">Privacy Policy</a>
          {" and "}
          <a href={branding.app_terms_url} target="_blank" rel="noreferrer">Terms of Service</a>
          {" apply"}
        </div>
      </>
    )
  }
  else {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }
};
