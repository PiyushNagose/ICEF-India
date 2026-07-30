const puppeteer = require("puppeteer");

let browserPromise;

const getBrowser = async () => {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--font-render-hinting=medium",
      ],
    }).catch((error) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
};

const htmlToPdfBuffer = async (html, options = {}) => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, {
      waitUntil: ["load", "networkidle0"],
      timeout: options.timeout || 60000,
    });
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: options.margin || undefined,
    });
    return Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
};

module.exports = {
  htmlToPdfBuffer,
};
