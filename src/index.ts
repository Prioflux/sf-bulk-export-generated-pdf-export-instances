import xior from "xior";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
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

// The export pdf id is the id of the export style that will be used to generate the PDF export instances
// This id can be found in the URL of the export style in the Silverfin web application (e.g. https://live.getsilverfin.com/f/400047/export_configurations/100002477/edit_template_hash)
const exportPdfId = "100002477";

const folderName = "exports";

// Create the exports directory if it doesn't exist
if (!fs.existsSync(folderName)) {
  fs.mkdirSync(folderName);
  console.log(`Created directory: ${folderName}`);
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
  const totalCompanies = companiesData.length;
  let processedCompanies = 0;
  let totalPdfsGenerated = 0;

  // Track failures
  interface Failure {
    company: string;
    period: string;
    periodLabel: string;
    error: string;
  }

  const failures: Failure[] = [];

  console.log(`⏳ Processing ${totalCompanies} companies...`);

  const pdfExportPromises = companiesData.map(async (company, index) => {
    // Get the ledger id for the period from the last closed bookyear
    console.log(
      `⏳ [${index + 1}/${totalCompanies}] Processing company: ${company.name}`
    );

    const periods = await instance.get(
      `/companies/${company.id}/periods?per_page=200`
    );

    const periodsData = periods.data;

    // Find the last closed period (most recent fiscal year end)
    const lastClosedPeriod = periodsData.find(
      (period) => period.end_date === period.fiscal_year.end_date
    );

    if (!lastClosedPeriod) {
      console.log(`❌ No matching period found for company ${company.name}`);
      return;
    }

    // Find the second last closed period (previous fiscal year end)
    // Filter out the first match (lastClosedPeriod) and find the next match
    const secondLastClosedPeriod = periodsData.filter(
      (period) =>
        period.end_date === period.fiscal_year.end_date &&
        period.id !== lastClosedPeriod.id
    )[0];
    // Generate PDFs for both periods concurrently
    const pdfPromises: Promise<void>[] = [];

    // Add the most recent period to the promises
    pdfPromises.push(
      generateAndSavePdf(
        company,
        lastClosedPeriod,
        "laatst_afgesloten_boekjaar"
      )
    );

    // Add the second period to the promises if it exists
    if (secondLastClosedPeriod) {
      pdfPromises.push(
        generateAndSavePdf(
          company,
          secondLastClosedPeriod,
          "voorafgaande_boekjaar"
        )
      );
    }

    // Wait for all PDF generation to complete
    await Promise.all(pdfPromises);

    // Update progress after company is processed
    processedCompanies++;
    console.log(
      `✔️ [${processedCompanies}/${totalCompanies}] Completed company: ${company.name}`
    );
  });

  // Helper function to generate and save PDF
  async function generateAndSavePdf(company, period, periodLabel) {
    const pdfsInProgress = ++totalPdfsGenerated;
    console.log(
      `⏳ [${processedCompanies}/${totalCompanies}] [PDF ${pdfsInProgress}] Generating PDF for ${company.name}, period ${period.end_date} (${periodLabel})...`
    );

    try {
      const createdPdfExport = await instance.post(
        `/companies/${company.id}/periods/${period.id}/export_pdf_instances`,
        {
          title: `Full export - ${company.name} - ${period.end_date}`,
          export_pdf_id: exportPdfId,
        }
      );

      // Poll the PDF export instance until it's ready
      let pdfExportInstance;
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        attempts++;
        pdfExportInstance = await instance.get(
          `/companies/${company.id}/periods/${period.id}/export_pdf_instances/${createdPdfExport.data.id}`
        );

        if (pdfExportInstance.data.state === "created") {
          break;
        }

        if (pdfExportInstance.data.state === "error") {
          throw new Error(
            `❌ PDF generation failed for ${company.name}, period ${period.end_date}: ${pdfExportInstance.data.processing_error}`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (attempts >= maxAttempts) {
        throw new Error(
          `❌ PDF generation timed out after ${maxAttempts} polling attempts for ${company.name}`
        );
      }

      // Download and save locally the PDF export instances
      const pdfExportInstanceData = pdfExportInstance.data;

      // The property is download_url, not url
      const pdfExportInstanceUrl = pdfExportInstanceData.download_url;

      // Make sure we're using the full URL if it's a relative path
      const fullUrl = pdfExportInstanceUrl.startsWith("/")
        ? `${baseUrl}${pdfExportInstanceUrl}`
        : pdfExportInstanceUrl;

      // Set responseType to arraybuffer to get binary data
      const pdfExportInstanceResponse = await instance.get(fullUrl, {
        responseType: "arraybuffer",
      });

      // Generate a filename based on company name and period
      const sanitizedCompanyName = company.name
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const fileName = `full_export_${sanitizedCompanyName}_${period.end_date}_${periodLabel}.pdf`;
      const filePath = path.join(folderName, fileName);

      // Save the PDF file
      fs.writeFileSync(filePath, Buffer.from(pdfExportInstanceResponse.data));

      console.log(
        `✔️ [${processedCompanies}/${totalCompanies}] [PDF ${pdfsInProgress}] Saved PDF to: ${filePath}`
      );
    } catch (error) {
      console.error(
        `Error generating PDF for ${company.name}, period ${period.end_date}: ${error.message}`
      );
      // Record the failure
      failures.push({
        company: company.name,
        period: period.end_date,
        periodLabel,
        error: error.message,
      });
      // Continue with the next company rather than halting everything
      return;
    }
  }

  // Wait for all promises to resolve
  await Promise.all(pdfExportPromises);

  console.log(
    `✅ All processing complete: ${processedCompanies}/${totalCompanies} companies processed, ${totalPdfsGenerated} PDFs generated`
  );

  // Report on failures
  if (failures.length > 0) {
    console.log("\n❌ Failed PDF generations:");
    console.table(failures);
    console.log(`Total failures: ${failures.length}`);
  } else {
    console.log("🎉 All PDFs generated successfully!");
  }
}

// Execute the async function
main().catch((error) => {
  console.error("Error in main execution:", error);
  process.exit(1);
});
