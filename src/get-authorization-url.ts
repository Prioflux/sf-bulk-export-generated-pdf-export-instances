import dotenv from "dotenv";
dotenv.config();

const redirectUri = "urn:ietf:wg:oauth:2.0:oob";

const { SF_CLIENT_ID, SF_SCOPE } = process.env;

if (!SF_CLIENT_ID || !SF_SCOPE) {
  const missingVars: string[] = [];
  if (!SF_CLIENT_ID) missingVars.push("SF_CLIENT_ID");
  if (!SF_SCOPE) missingVars.push("SF_SCOPE");

  console.error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );

  throw new Error("Missing required environment variables");
}

// Create authorization URL
const authorizationUrl = `https://live.getsilverfin.com/oauth/authorize?client_id=${encodeURIComponent(
  SF_CLIENT_ID
)}&redirect_uri=${encodeURIComponent(
  redirectUri
)}&response_type=code&scope=${encodeURIComponent(SF_SCOPE)}`;

console.log("authorizationUrl");
console.log(authorizationUrl);
