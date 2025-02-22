import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium'; // Uses the lightweight Chromium for AWS Lambda
import AWS from 'aws-sdk';

const s3 = new AWS.S3();

const isTuesday = () => {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  return dayOfWeek === 2; // 2 = Tuesday
}

const currentWeekNumber = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  return Math.ceil((day + start.getDay() + 1) / 7);
}

const getRankingUrls = async (page) => {
  await page.goto('https://www.ittf.com/rankings/', { 
    waitUntil: 'networkidle2',
    timeout: 15000 
  });

  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('.theiaStickySidebar .page-content ul:nth-of-type(1) li:first-child a'));
    const urls = {
      men: links.find(link => link.href.includes('_SEN_MS'))?.href,
      women: links.find(link => link.href.includes('_SEN_WS'))?.href
    };

    if (!urls.men || !urls.women) {
      throw new Error('Could not find ranking URLs');
    }

    return urls;
  });
};

 const saveToS3 = async (bucketName, key, data) =>  {
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
    CacheControl: 'max-age=604800', // Cache for 7 days
  };

  await s3.putObject(params).promise();
  console.log(`Data saved to S3: ${bucketName}/${key}`);
}

const isCacheStale = async (bucketName, key) => {
  try {
    const head = await s3.headObject({ Bucket: bucketName, Key: key }).promise();
    const lastModified = new Date(head.LastModified).getTime();
    const now = Date.now();

    // If today is Tuesday and last modified date is not today, invalidate cache
    if (isTuesday()) {
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      return lastModified < startOfToday.getTime();
    }

    // Otherwise, check if it's been more than a week
    return (now - lastModified) / 1000 > 604800; // 7 days
  } catch (error) {
    if (error.code === 'NotFound') {
      console.log('Cache miss! No cached file found.');
      return true;
    }
    throw error;
  }
}

const formatResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body
});

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
    // Check if cache is stale
    const cacheStale = await isCacheStale(bucketName, cacheKey);
    if (cacheStale) {
      console.log('Cache is stale. Scraping new data...');

      // Launch Puppeteer using the Chromium from the layer
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(), // This gets the correct Chrome path from the layer
        headless: chromium.headless
      });

      const page = await browser.newPage();

      const urls = await getRankingUrls(page);
      
      // Scrape both rankings
      const [menRankings, womenRankings] = await Promise.all([
        scrapeRankings(page, urls.men),
        scrapeRankings(await browser.newPage(), urls.women)
      ]);

      const data = {
        men: menRankings,
        women: womenRankings
      };

      if (!menRankings.length && !womenRankings.length) {
        console.warn('No rankings found');
        return formatResponse(404, { message: 'No rankings found' });
      }

      // Save new data to S3
      await saveToS3(bucketName, cacheKey, data);
      return formatResponse(200, data);
    }

     // Serve cached data
     const cachedData = await s3.getObject({ Bucket: bucketName, Key: cacheKey }).promise();
     return formatResponse(200, JSON.parse(cachedData.Body.toString()));
  } catch (error) {
    console.error(error);
    return formatResponse(500, { error: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};