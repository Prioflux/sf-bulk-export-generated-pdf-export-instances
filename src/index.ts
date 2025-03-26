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
  EXPORT_PDF_ID,
} = process.env;

if (
  !SF_CLIENT_ID ||
  !SF_SECRET ||
  !SF_SCOPE ||
  !SILVERFIN_FIRM_ID ||
  !SF_AUTHORIZATION_CODE ||
  !SILVERFIN_TOKEN ||
  !EXPORT_PDF_ID
) {
  const missingVars: string[] = [];
  if (!SF_CLIENT_ID) missingVars.push("SF_CLIENT_ID");
  if (!SF_SECRET) missingVars.push("SF_SECRET");
  if (!SF_SCOPE) missingVars.push("SF_SCOPE");
  if (!SILVERFIN_FIRM_ID) missingVars.push("SILVERFIN_FIRM_ID");
  if (!SF_AUTHORIZATION_CODE) missingVars.push("SF_AUTHORIZATION_CODE");
  if (!SILVERFIN_TOKEN) missingVars.push("SILVERFIN_TOKEN");
  if (!EXPORT_PDF_ID) missingVars.push("EXPORT_PDF_ID");
  console.error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );

  throw new Error("Missing required environment variables");
}

// The export pdf id is the id of the export style that will be used to generate the PDF export instances
// This id can be found in the URL of the export style in the Silverfin web application (e.g. https://live.getsilverfin.com/f/400047/export_configurations/100002477/edit_template_hash)

const exportPdfId = process.env.EXPORT_PDF_ID;
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

const instance = xior.create({
  baseURL: `${baseUrl}/api/v4/f/${SILVERFIN_FIRM_ID}`,
  headers: {
    ...defaultHeaders,
  },
});

/*
========================================
GENERATING PDF EXPORT INSTANCES IN BULK
========================================
*/

// Define Failure interface at file scope, not inside main()
interface Failure {
  company: string;
  period: string;
  periodLabel: string;
  error: string;
}

// Wrap the code in an async function
async function main() {
  // Initialize variables for pagination
  let allCompaniesData: any[] = [];
  let currentPage = 1;
  const perPage = 200;
  let hasMorePages = true;

  // Create a single stats object that will be used for all batches
  const stats = {
    processedCompanies: 0,
    totalCompanies: 0,
    totalPdfsGenerated: 0,
    failures: [] as Failure[],
  };

  console.log("⏳ Fetching all companies in batches...");

  // Fetch all companies with pagination
  while (hasMorePages) {
    console.log(`⏳ Fetching companies page ${currentPage}...`);

    const companiesResponse = await instance.get("/companies", {
      params: {
        page: currentPage,
        per_page: perPage,
      },
    });

    const pageCompanies = companiesResponse.data;

    if (pageCompanies.length > 0) {
      allCompaniesData = [...allCompaniesData, ...pageCompanies];
      console.log(
        `✅ Fetched ${pageCompanies.length} companies from page ${currentPage}`
      );
      currentPage++;
    } else {
      hasMorePages = false;
      console.log("✅ All companies fetched successfully");
    }
  }

  const totalCompanies = allCompaniesData.length;
  stats.totalCompanies = totalCompanies;
  console.log(`⏳ Processing ${totalCompanies} companies in total...`);

  // Process companies in sequential batches
  const batchSize = 20;

  // Process companies in sequential batches instead of all at once
  for (let i = 0; i < allCompaniesData.length; i += batchSize) {
    const batch = allCompaniesData.slice(i, i + batchSize);
    console.log(
      `⏳ Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        allCompaniesData.length / batchSize
      )} (companies ${i + 1}-${Math.min(
        i + batchSize,
        allCompaniesData.length
      )})`
    );

    // Process this batch in parallel
    const batchPromises = batch.map(async (company, batchIndex) => {
      const index = i + batchIndex;
      console.log(
        `⏳ [${index + 1}/${totalCompanies}] Processing company: ${
          company.name
        }`
      );

      const periods = await instance.get(
        `/companies/${company.id}/periods?per_page=200`
      );

      const periodsData = periods.data;

      const fiscalYearEndPeriods = periodsData.filter(
        (period) => period.end_date === period.fiscal_year.end_date
      );

      // We need at least a third period to proceed
      if (!fiscalYearEndPeriods[2]) {
        console.log(
          `❌ No third last closing period found for company ${company.name} - SKIPPING`
        );

        // Add to failures list
        stats.failures.push({
          company: company.name,
          period: "N/A",
          periodLabel: "N/A",
          error: `No third last closing period found`,
        });

        // Skip to next company
        stats.processedCompanies++;
        console.log(
          `⏩ [${stats.processedCompanies}/${stats.totalCompanies}] Skipped company: ${company.name}`
        );
        return;
      }

      // Generate PDFs for the third, fourth, and fifth last periods concurrently
      const pdfPromises: Promise<void>[] = [];

      // Last closed bookyear
      if (fiscalYearEndPeriods[0]) {
        pdfPromises.push(
          generateAndSavePdf(
            company,
            fiscalYearEndPeriods[0],
            "eerste_laatste_boekjaar",
            stats
          )
        );
      }

      // Second last bookyear
      if (fiscalYearEndPeriods[1]) {
        pdfPromises.push(
          generateAndSavePdf(
            company,
            fiscalYearEndPeriods[1],
            "tweede_laatste_boekjaar",
            stats
          )
        );
      }

      // Third last bookyear
      if (fiscalYearEndPeriods[2]) {
        pdfPromises.push(
          generateAndSavePdf(
            company,
            fiscalYearEndPeriods[2],
            "derde_laatste_boekjaar",
            stats
          )
        );
      }

      // Fourth last bookyear
      if (fiscalYearEndPeriods[3]) {
        pdfPromises.push(
          generateAndSavePdf(
            company,
            fiscalYearEndPeriods[3],
            "vierde_laatste_boekjaar",
            stats
          )
        );
      }

      // Fifth last bookyear
      if (fiscalYearEndPeriods[4]) {
        pdfPromises.push(
          generateAndSavePdf(
            company,
            fiscalYearEndPeriods[4],
            "vijfde_laatste_boekjaar",
            stats
          )
        );
      }

      // Wait for all PDF generation to complete
      await Promise.all(pdfPromises);

      // Update progress after company is processed
      stats.processedCompanies++;
      console.log(
        `✔️ [${stats.processedCompanies}/${stats.totalCompanies}] Completed company: ${company.name}`
      );
    });

    // Wait for all promises in the batch to resolve
    await Promise.all(batchPromises);
  }

  console.log(
    `✅ All processing complete: ${stats.processedCompanies}/${stats.totalCompanies} companies processed, ${stats.totalPdfsGenerated} PDFs generated`
  );

  // Report on failures
  if (stats.failures.length > 0) {
    console.log("\n❌ Failed PDF generations:");
    stats.failures.forEach((failure) => {
      console.log(
        `${failure.company} (${failure.period}, ${failure.periodLabel}): ❌ ${failure.error}`
      );
    });
    console.log(`Total failures: ${stats.failures.length}`);
  } else {
    console.log("🎉 All PDFs generated successfully!");
  }
}

// Helper function to generate and save PDF
async function generateAndSavePdf(
  company,
  period,
  periodLabel,
  stats: {
    processedCompanies: number;
    totalCompanies: number;
    totalPdfsGenerated: number;
    failures: Failure[];
  }
) {
  // Increment before we start the process
  const pdfsInProgress = stats.totalPdfsGenerated++;
  console.log(
    `⏳ [${stats.processedCompanies}/${stats.totalCompanies}] [PDF ${pdfsInProgress}] Generating PDF for ${company.name}, period ${period.end_date} (${periodLabel})...`
  );

  // Define currentRequest outside try block to make it available in catch
  let currentRequest = "initializing";

  try {
    currentRequest = "creating PDF export instance";
    const createdPdfExport = await instance.post(
      `/companies/${company.id}/periods/${period.id}/export_pdf_instances`,
      {
        title: `Full export - ${period.end_date} - ${company.name}`,
        export_pdf_id: exportPdfId,
      }
    );

    // Poll the PDF export instance until it's ready
    let pdfExportInstance;
    let attempts = 0;

    // 10 minutes = 600 seconds, with 3 seconds between attempts
    // We need 600 / 3 = 200 attempts to cover 10 minutes
    const maxAttempts = 200;
    const timeBetweenAttempts = 3000;

    while (attempts < maxAttempts) {
      attempts++;

      currentRequest = "polling PDF export instance status";
      pdfExportInstance = await instance.get(
        `/companies/${company.id}/periods/${period.id}/export_pdf_instances/${createdPdfExport.data.id}`
      );

      if (pdfExportInstance.data.state === "created") {
        break;
      }

      if (pdfExportInstance.data.state === "error") {
        throw new Error(
          `PDF generation failed for ${company.name}, period ${period.end_date}: ${pdfExportInstance.data.processing_error}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, timeBetweenAttempts));
    }

    if (attempts >= maxAttempts) {
      throw new Error(
        `PDF generation timed out after ${maxAttempts} polling attempts for ${
          company.name
        } (${(maxAttempts * timeBetweenAttempts) / 60000} minutes)`
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
    currentRequest = "downloading PDF file";
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
    currentRequest = "saving PDF file to disk";
    fs.writeFileSync(filePath, Buffer.from(pdfExportInstanceResponse.data));

    console.log(
      `✔️ [${stats.processedCompanies}/${stats.totalCompanies}] [PDF ${pdfsInProgress}] Saved PDF to: ${filePath}`
    );
  } catch (error) {
    // Enhanced error message with request information and HTTP verb
    const httpMethod = error.config?.method
      ? error.config.method.toUpperCase()
      : "unknown";
    const errorMessage = error.response
      ? `${httpMethod} request failed with status code ${
          error.response.status
        } during ${currentRequest}. URL: ${error.config?.url || "unknown"}`
      : error.message;

    console.error(
      `❌ Error generating PDF for ${company.name}, period ${period.end_date}: ${errorMessage}`
    );

    // Record the failure with enhanced error information
    stats.failures.push({
      company: company.name,
      period: period.end_date,
      periodLabel,
      error: errorMessage,
    });

    // Continue with the next company rather than halting everything
    return;
  }
}

// Execute the async function
main().catch((error) => {
  console.error("Error in main execution:", error);
  process.exit(1);
});
