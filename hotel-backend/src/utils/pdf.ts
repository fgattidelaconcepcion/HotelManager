import puppeteer from "puppeteer";

/**
 * Here I convert HTML to a PDF Buffer using Puppeteer.
 *
 * NOTE:
 * - Some Puppeteer type versions (or TS configs) do NOT accept headless: "new".
 * - To keep builds stable in Railway/Docker, I use headless: true.
 * - I also add a couple of extra args that help in containers.
 */
export async function htmlToPdfBuffer(html: string) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", right: "12mm", bottom: "14mm", left: "12mm" },
    });

    return pdf;
  } finally {
    await browser.close();
  }
}
