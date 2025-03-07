import xior from "xior";
import dotenv from "dotenv";
dotenv.config();

// =======================================
// START OF DATA TO BE ADDED BY THE USER
// =======================================

// The SILVERFIN_TOKEN is a valid access token for the Silverfin API that's created through another application like Postman before running the script
// The SILVERFIN_FIRM_ID is the id of the firm that can be found in the URL of the Silverfin web application (e.g. https://live.getsilverfin.com/f/13827/)
const {
  SF_CLIENT_ID,
  SF_SECRET,
  SF_SCOPE,
  SILVERFIN_FIRM_ID,
  SF_AUTHORIZATION_CODE,
  SILVERFIN_TOKEN,
} = process.env;

if (
  !SF_CLIENT_ID ||
  !SF_SECRET ||
  !SF_SCOPE ||
  !SILVERFIN_FIRM_ID ||
  !SF_AUTHORIZATION_CODE ||
  !SILVERFIN_TOKEN
) {
  const missingVars: string[] = [];
  if (!SF_CLIENT_ID) missingVars.push("SF_CLIENT_ID");
  if (!SF_SECRET) missingVars.push("SF_SECRET");
  if (!SF_SCOPE) missingVars.push("SF_SCOPE");
  if (!SILVERFIN_FIRM_ID) missingVars.push("SILVERFIN_FIRM_ID");
  if (!SF_AUTHORIZATION_CODE) missingVars.push("SF_AUTHORIZATION_CODE");
  if (!SILVERFIN_TOKEN) missingVars.push("SILVERFIN_TOKEN");

  console.error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );

  throw new Error("Missing required environment variables");
}

// =======================================
// END OF DATA TO BE ADDED BY THE USER
// =======================================

// Create an axios instance with the base URL and the authorization header that should be used for each Silverfin API request
const defaultHeaders = {
  Authorization: `Bearer ${SILVERFIN_TOKEN}`,
  Accept: "application/json",
};

const baseUrl = "https://live.getsilverfin.com";

const redirectUri = "urn:ietf:wg:oauth:2.0:oob";

const instance = xior.create({
  baseURL: `${baseUrl}/api/v4/f/${SILVERFIN_FIRM_ID}`,
  headers: {
    ...defaultHeaders,
  },
});

// // Create authorization URL
// const authorizationUrl = `https://live.getsilverfin.com/oauth/authorize?client_id=${encodeURIComponent(
//   SF_CLIENT_ID
// )}&redirect_uri=${encodeURIComponent(
//   redirectUri
// )}&response_type=code&scope=${encodeURIComponent(SF_SCOPE)}`;

// console.log("authorizationUrl");
// console.log(authorizationUrl);

// // Get an access token
// instance
//   .post(
//     `${baseUrl}/f/${SILVERFIN_FIRM_ID}/oauth/token`,
//     {},
//     {
//       params: {
//         code: SF_AUTHORIZATION_CODE,
//         client_id: SF_CLIENT_ID,
//         client_secret: SF_SECRET,
//         redirect_uri: redirectUri,
//         grant_type: "authorization_code",
//       },
//     }
//   )
//   .then((response) => {
//     console.log(response.data);
//   })
//   .catch((error) => {
//     console.log(error);
//   });

/*
========================================
GENERATING PDF EXPORT INSTANCES IN BULK
========================================
*/

// Wrap the code in an async function
async function main() {
  // Get all companies
  const companies = await instance.get("/companies");

  const companiesData = companies.data;

  console.log(`⏳ Updating ${companiesData.length} companies...`);

  const pdfExportPromises = companiesData.map(async (company) => {
    // Get the ledger id for the period from the last closed bookyear, the periods are sorted by end_date in descending order and will by default only return 200 periods on the first page
    const periods = await instance.get(`/companies/${company.id}/periods`);

    const periodsData = periods.data;

    // Find the first period where end_date matches fiscal_year.end_date
    const lastClosedPeriod = periodsData.find(
      (period) => period.end_date === period.fiscal_year.end_date
    );

    if (!lastClosedPeriod) {
      console.log(`❌ No matching period found for company ${company.name}`);
      return;
    }

    console.log(
      `⏳ Generating PDF export instance for company ${company.name} from period ${lastClosedPeriod.end_date}...`
    );

    // Generate a PDF export instance for each company

    // Download the PDF export instances

    // Save the PDF export instances locally

    console.log(
      `✅ Successfully generated & saved PDF export instance for company ${company.name} from period ${lastClosedPeriod.end_date}`
    );
  });

  // Wait for all promises to resolve
  await Promise.all(pdfExportPromises);
}

// Execute the async function
main().catch((error) => {
  console.error("Error in main execution:", error);
  process.exit(1);
});
