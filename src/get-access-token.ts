import xior from "xior";
import dotenv from "dotenv";
dotenv.config();

const baseUrl = "https://live.getsilverfin.com";
const redirectUri = "urn:ietf:wg:oauth:2.0:oob";

const {
  SF_CLIENT_ID,
  SF_SECRET,
  SF_SCOPE,
  SILVERFIN_FIRM_ID,
  SF_AUTHORIZATION_CODE,
} = process.env;

if (
  !SF_CLIENT_ID ||
  !SF_SECRET ||
  !SF_SCOPE ||
  !SILVERFIN_FIRM_ID ||
  !SF_AUTHORIZATION_CODE
) {
  const missingVars: string[] = [];
  if (!SF_CLIENT_ID) missingVars.push("SF_CLIENT_ID");
  if (!SF_SECRET) missingVars.push("SF_SECRET");
  if (!SF_SCOPE) missingVars.push("SF_SCOPE");
  if (!SILVERFIN_FIRM_ID) missingVars.push("SILVERFIN_FIRM_ID");
  if (!SF_AUTHORIZATION_CODE) missingVars.push("SF_AUTHORIZATION_CODE");

  console.error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );

  throw new Error("Missing required environment variables");
}

// Get an access token
xior
  .post(
    `${baseUrl}/f/${SILVERFIN_FIRM_ID}/oauth/token`,
    {},
    {
      params: {
        code: SF_AUTHORIZATION_CODE,
        client_id: SF_CLIENT_ID,
        client_secret: SF_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      },
    }
  )
  .then((response) => {
    console.log(response.data);
  })
  .catch((error) => {
    console.log(error);
  });
