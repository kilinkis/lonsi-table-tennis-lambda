import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium'; // Uses the lightweight Chromium for AWS Lambda

const currentWeekNumber = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  return Math.ceil((day + start.getDay() + 1) / 7);
}

const URLS = {
  men: `https://www.ittf.com/wp-content/uploads/2025/02/2025_${currentWeekNumber()}_SEN_MS.html`,
  women: `https://www.ittf.com/wp-content/uploads/2025/02/2025_${currentWeekNumber()}_SEN_WS.html`
};

const scrapeRankings = async (page, url) => {
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#content tbody tr.rrow', { timeout: 15000 });

  return page.evaluate(() => {
    const extractText = (row, index) => row.querySelector(`td:nth-child(${index})`).textContent.trim();
    
    return Array.from(document.querySelectorAll('#content tbody tr.rrow'))
      .map(row => {
        try {
          return {
            rank: extractText(row, 1),
            name: extractText(row, 2),
            assoc: extractText(row, 3),
            points: extractText(row, 4)
          };
        } catch (err) {
          console.error('Error parsing row:', err);
          return null;
        }
      })
      .filter(Boolean);
  });
};

export const handler = async () => {
  let browser;
  try {
    // Launch Puppeteer using the Chromium from the layer
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(), // This gets the correct Chrome path from the layer
      headless: chromium.headless
    });

    const page = await browser.newPage();
    
    // Scrape both rankings
    const [menRankings, womenRankings] = await Promise.all([
      scrapeRankings(page, URLS.men),
      scrapeRankings(await browser.newPage(), URLS.women)
    ]);

    if (!menRankings.length && !womenRankings.length) {
      console.warn('No rankings found');
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'No rankings found' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: {
        data: {
          men: menRankings,
          women: womenRankings
        },
        total: {
          men: menRankings.length,
          women: womenRankings.length
        },
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};