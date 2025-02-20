import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium'; // Uses the lightweight Chromium for AWS Lambda

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
    await page.goto('https://www.ittf.com/wp-content/uploads/2025/02/2025_6_SEN_MS.html', {
      waitUntil: 'networkidle2'
    });

    // Wait for the table rows to load
    await page.waitForSelector('#content tbody tr.rrow', { timeout: 10000 });

    // Extract the desired HTML content
    const content = await page.evaluate(() => {
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
    
    if (!content || content.length === 0) {
      console.warn('No content found.');
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'No rankings found.' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(content),
      headers: {
        'Content-Type': 'application/json'
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