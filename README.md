# Silverfin Bulk PDF Export

This utility script allows you to generate and download PDF exports in bulk from your Silverfin firm. It retrieves all companies and generates a specified PDF export for the most recent and previous fiscal year end periods.

## Features

- Retrieves all companies from Silverfin with pagination
- Processes companies in batches to avoid overwhelming the API
- Generates PDFs for the last two available fiscal years for each company
- Downloads and saves PDFs locally
- Provides detailed progress tracking and error reporting
- Handles timeouts and errors gracefully

## Prerequisites

- Node.js
- pnpm
- Access to Silverfin API with proper permissions
- Export Style ID from Silverfin

## Setup

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Create a `.env` file in the root directory and add your Silverfin API credentials:

```bash
SILVERFIN_FIRM_ID=your_firm_id
SF_CLIENT_ID=your_client_id
SF_SECRET=your_secret
SF_SCOPE=your_scope
SF_AUTHORIZATION_CODE=your_authorazation_code_from_the_url
SILVERFIN_TOKEN=your_access_token_generated_from_the_endpoint
```

4. Edit the `exportPdfId` in the script to match your desired export style:

```typescript
const exportPdfId = "100002477"; // Replace with your export template ID:
```

5. Run the script:

```bash
npx ts-node src/index.ts
```

## How It Works

1. The script fetches all companies using pagination (10 companies per page)
2. Companies are processed in batches of 10 to control concurrency
3. For each company, it finds:
   - The most recent fiscal year-end period
   - The previous fiscal year-end period (if available)
4. It generates PDF exports for both periods
5. PDFs are saved to the `exports` folder with a standardized naming convention:
   - `full_export_{company_name}_{period_end_date}_{period_label}.pdf`

## Output

The script creates an `exports` directory and saves all PDFs there. Progress is logged to the console, including:
- Company processing status
- PDF generation progress
- Success and failure notifications
- A summary table of any failed exports at the end

## Troubleshooting

If PDFs aren't generating:
- Check if your export template ID is correct
- Verify your API token has the necessary permissions
- Check if the export shows an error in the Silverfin UI
- Increase the `maxAttempts` value if timeouts occur
