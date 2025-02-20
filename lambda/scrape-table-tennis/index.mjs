import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium'; // Uses the lightweight Chromium for AWS Lambda
import AWS from 'aws-sdk';

const s3 = new AWS.S3();

const currentWeekNumber = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  return Math.ceil((day + start.getDay() + 1) / 7);
}

// these URLs might fail next month
const URLS = {
  men: `https://www.ittf.com/wp-content/uploads/2025/02/2025_${currentWeekNumber()}_SEN_MS.html`,
  women: `https://www.ittf.com/wp-content/uploads/2025/02/2025_${currentWeekNumber()}_SEN_WS.html`
};

async function saveToS3(bucketName, key, data) {
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  };

  await s3.putObject(params).promise();
  console.log(`Data saved to S3: ${bucketName}/${key}`);
}

async function getFromS3(bucketName, key) {
  try {
    const params = { Bucket: bucketName, Key: key };
    const result = await s3.getObject(params).promise();
    console.log('Cache hit! Returning data from S3.');
    return JSON.parse(result.Body.toString());
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      console.log('Cache miss! No data found in S3.');
      return null;
    }
    throw error;
  }
}

async function isCacheValid(bucketName, key, ttlInSeconds) {
  try {
    const params = { Bucket: bucketName, Key: key };
    const head = await s3.headObject(params).promise();
    
    const lastModified = new Date(head.LastModified).getTime();
    const now = Date.now();
    
    return (now - lastModified) / 1000 < ttlInSeconds;
  } catch (error) {
    if (error.code === 'NotFound') return false;
    throw error;
  }
}

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
  const bucketName = 'table-tennis-score';
  const cacheKey = 'scraped-data.json';
  let browser;

  try {
    // Check for cached data
    const cachedData = await getFromS3(bucketName, cacheKey);
    const isCacheStillValid = await isCacheValid(bucketName, cacheKey, 3600); // 1 hour TTL

    if (cachedData && isCacheStillValid) {
      return {
        statusCode: 200,
        body: cachedData,
        headers: { 'Content-Type': 'application/json' },
      };
    }

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

    const data = {
      men: menRankings,
      women: womenRankings
    };

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

     // Save new data to S3
     await saveToS3(bucketName, cacheKey, data);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // 'Access-Control-Allow-Origin': '*'
      },
      body: data
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