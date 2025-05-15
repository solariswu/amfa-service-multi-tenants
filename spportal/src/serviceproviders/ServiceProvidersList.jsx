import * as React from "react";
import PropTypes from "prop-types";

import {
  LoadingIndicator,
  // Button,
  useGetIdentity,
  useGetList,
  useGetOne,
  useUpdate,
  useNotify,
} from "react-admin";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";

import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { useFeConfigs } from "../configs/FeConfigProvider";

const ContainerLoading = () => (
  <Container maxWidth="lg" sx={{ mt: 4 }}>
    <Typography component="h1" variant="h4" align="center">
      Service Providers
    </Typography>
    <Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
      <LoadingIndicator />
    </Box>
  </Container>
);

const MyContent = ({ data, identity }) => {
  const [removedSp, setRemovedSp] = React.useState(null);
  const [originalList, setOriginalList] = React.useState(null);
  const [update, { isLoading: isSaving }] = useUpdate(
    "usercustomsps",
    { id: identity.email, data: removedSp, previousData: originalList },
    {
      onSuccess: () => {
        setOriginalList(removedSp);
        notify("Preference saved successfully!", { type: "success" });
      },
      onError: (error) => {
        notify(error, { type: "error" });
      },
    }
  );
  const notify = useNotify();
  const branding = useFeConfigs();

  const { data: userdata, isLoading } = useGetOne("usercustomsps", {
    id: identity.email,
  });

  if (isLoading) {
    return <ContainerLoading />;
  }

  if (!removedSp) {
    let fetchedList = userdata ? userdata?.userCustomSps.sort() : [];

    const allSps = data.map((el) => el.id);
    const list = fetchedList.filter((el) => allSps.includes(el));
    // console.log ('ygwu list', list)
    setOriginalList(list);
    setRemovedSp(list);
  }

  const removeOneSp = (sp) => {
    setRemovedSp((removedSp) => {
      const list = removedSp.filter((el) => el !== sp.id);
      list.push(sp.id);
      if (JSON.stringify(list).length >= 2048) {
        list.pop();
        notify(`Reaches limit, can't remove this`, { type: "warning" });
      }
      list.sort();
      return list;
    });
  };

  const addOneSp = (id) => {
    setRemovedSp((removedSp) => {
      const list = removedSp.filter((el) => el !== id);
      return list;
    });
  };

  const AddServiceProvider = () => {
    const [anchorEl, setAnchorEl] = React.useState(null);
    const open = Boolean(anchorEl);
    const handleClick = (event) => {
      setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
      setAnchorEl(null);
    };

    return (
      <React.Fragment>
        <IconButton
          aria-controls={open ? "basic-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          sx={{ width: 310, maxWidth: "100%", height: "80%" }}
          size="small"
          onClick={handleClick}
        >
          <AddIcon />
        </IconButton>
        <Menu
          id="basic-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          MenuListProps={{
            "aria-labelledby": "basic-button",
          }}
          sx={{ width: 310, maxWidth: "100%" }}
        >
          {removedSp &&
            removedSp.map((id) => {
              const item = data.filter((it) => it.id === id);
              if (item.length === 0) return null;
              return (
                <MenuItem
                  key={id}
                  onClick={() => {
                    setAnchorEl(null);
                    addOneSp(id);
                  }}
                  sx={{ width: 310, maxWidth: "100%" }}
                >
                  <img
                    src={
                      item[0].logoUrl?.length
                        ? item[0].logoUrl
                        : `./${item[0].type}.png`
                    }
                    alt="app_icon"
                    style={{ width: "24px", marginRight: "8px" }}
                  />{" "}
                  {item[0].name.toUpperCase()}
                </MenuItem>
              );
            })}
        </Menu>
      </React.Fragment>
    );
  };

  const ServiceDropDown = ({ data }) => {
    const [anchorEl, setAnchorEl] = React.useState(null);

    const open = Boolean(anchorEl);
    const handleClick = (event) => {
      setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
      setAnchorEl(null);
    };

    const handleOpenService = () =>
      data?.serviceUrl
        ? window.open(data.serviceUrl, "_blank", "noreferrer")
        : null;

    ServiceDropDown.propTypes = {
      data: PropTypes.object.isRequired,
    };

    return (
      <Paper
        sx={{
          width: 320,
          maxWidth: "100%",
          alignItems: "center",
          display: "flex",
        }}
      >
        <Button
          id="basic-button"
          aria-controls={open ? "basic-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          sx={{ width: 310, maxWidth: "100%" }}
          endIcon={<CloseIcon onClick={() => removeOneSp(data)} />}
        >
          <div
            onClick={
              data?.serviceProviders?.length ? handleClick : handleOpenService
            }
            style={{ width: "100%", padding: "auto" }}
          >
            <Typography>
              <img
                src={data.logoUrl?.length ? data.logoUrl : `./${data.type}.png`}
                alt="app_icon"
                style={{
                  width: "20px",
                  marginBottom: "-3px",
                  marginRight: "5px",
                }}
              />{" "}
              {data.name}
            </Typography>
          </div>
        </Button>
        {data?.type === "oidc" && (
          <Menu
            id="basic-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            MenuListProps={{
              "aria-labelledby": "basic-button",
            }}
            sx={{ width: 310, maxWidth: "100%" }}
          >
            {data?.serviceProviders &&
              data.serviceProviders.map((el) => (
                <MenuItem
                  key={el.sploginurl + el.spname}
                  onClick={() => {
                    setAnchorEl(null);
                    window.open(el.sploginurl);
                  }}
                  sx={{ width: 310, maxWidth: "100%" }}
                >
                  <img
                    src={data?.logoUrl?.length ? data.logoUrl : "./astro.png"}
                    alt="app_icon"
                    style={{ width: "24px", marginRight: "8px" }}
                  />{" "}
                  {el.spname}
                </MenuItem>
              ))}
          </Menu>
        )}
      </Paper>
    );
  };

  const handleClick = (e) => {
    e.preventDefault(); // necessary to prevent default SaveButton submit logic
    update();
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography component="h1" variant="h4" align="center">
        {branding && branding.portal_title_msg}
      </Typography>
      <Typography component="h6" variant="body2" align="center">
        {branding && branding.portal_description_msg}
      </Typography>
      <Box sx={{ mt: 5 }}>
        <Grid container spacing={2}>
          {data &&
            data.map((item) =>
              removedSp?.filter((el) => el === item.id).length ? null : (
                <Grid size={{ xs: 12, sm: 6, md:6, lg:4 }} key={item.id}>
                  <ServiceDropDown data={item} key={item.id} />
                </Grid>
              )
            )}
          {removedSp?.length > 0 && (
            <Grid size={{ xs: 12, sm: 6, md:6, lg:4 }} key="newSp">
              <AddServiceProvider />
            </Grid>
          )}
        </Grid>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
        <Button
          label="Save"
          onClick={handleClick}
          type="button"
          sx={{ pl: 5, pr: 5, pt: 1, pb: 1 }}
          variant="contained"
          disabled={
            isSaving ||
            !originalList ||
            !removedSp ||
            (originalList.length === removedSp.length &&
              (originalList.length === 0 ||
                (originalList[0] === removedSp[0] &&
                  originalList[originalList.length - 1] ===
                    removedSp[removedSp.length - 1])))
          }
        >
          Save
        </Button>
      </Box>
    </Container>
  );
};

export const ServiceProvidersList = () => {
  const { data, isLoading } = useGetList("serviceproviders", {
    pagination: { page: 1, perPage: 60 },
  });
  const { data: identity, isLoading: identityLoading } = useGetIdentity();

  if (isLoading || identityLoading) return <ContainerLoading />;

  return <MyContent data={data} identity={identity} />;
};
