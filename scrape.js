const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Fallback data for when a movie fetch fails
const fallbackData = [
  {
    title: 'Placeholder Movie',
    backgroundImgScr: 'https://via.placeholder.com/480',
    screenings: [
      {
        dateTime: 'Visste du at du kan booke en privatvisning?',
        badge: 'idhuset.no/kino'
      }
    ]
  }
];

// Function to fetch and save movie data
const fetchMoviesData = async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to the main page
    await page.goto('https://idhuset.no', { waitUntil: 'networkidle2' });

    // Scrape the main page to get movie links, titles, and poster images
    const movieCards = await page.evaluate(() => {
      const movieElements = document.querySelectorAll('.cards .Card');
      const movies = [];

      movieElements.forEach((element, index) => {
        if (index < 4) {
          const href = element.getAttribute('href');
          const titleElement = element.querySelector('.card-title');
          const imageElement = element.querySelector('.card-image');

          const title = titleElement ? titleElement.textContent.trim() : 'Unknown Title';
          const imageUrl = imageElement
            ? imageElement.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)[1]
            : 'https://via.placeholder.com/480';

          if (href) {
            movies.push({
              href: `https://idhuset.no${href}`,
              title,
              backgroundImgScr: imageUrl.replace(/w=\d+&h=\d+/, 'w=480&h=auto') // Adjust image size
            });
          }
        }
      });

      return movies;
    });

    const movies = [];

    // Visit each movie page and fetch screening details
    for (const movieCard of movieCards) {
      const { href, title, backgroundImgScr } = movieCard;
      const moviePage = await browser.newPage();
      await moviePage.goto(href, { waitUntil: 'networkidle2' });

      const screenings = await moviePage.evaluate(() => {
        const screeningElements = document.querySelectorAll('.ticket-body');
        const screenings = [];

        screeningElements.forEach(screening => {
          const badgeElement = screening.querySelector('.badge.is-highlight');
          const dateTimeElement = screening.querySelector('.ticket-time');

          // Only fetch the badge if the "is-highlight" class is present
          const badge = badgeElement ? badgeElement.textContent.trim() : '';
          const dateTime = dateTimeElement ? dateTimeElement.textContent.trim() : 'Unknown Date & Time';

          // Only include screenings with a dateTime
          if (dateTime) {
            screenings.push({ dateTime, badge });
          }
        });

        return screenings;
      });

      movies.push({
        title,
        backgroundImgScr,
        screenings: screenings.length > 0 ? screenings : [{ dateTime: 'No screenings available', badge: '' }]
      });

      await moviePage.close();
    }

    // Save the results to movies.json
    const filePath = path.join(__dirname, 'movies.json');
    fs.writeFileSync(filePath, JSON.stringify(movies, null, 2));
    console.log(`Data saved to ${filePath}`);

    await browser.close();
  } catch (error) {
    console.error('Error fetching movies data:', error);
  }
};

// Function to run the script periodically
const runScriptPeriodically = () => {
  console.log('Starting periodic updates...');
  fetchMoviesData(); // Run initially
  setInterval(fetchMoviesData, 60 * 60 * 1000); // Run every hour
};

// Execute script manually or periodically
if (require.main === module) {
  runScriptPeriodically();
}
