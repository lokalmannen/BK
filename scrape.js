const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Valid badges and their mappings
const validBadges = {
  "Førpremiere": "Premiere",
  "Verdenspremiere": "Premiere",
  "Norgespremiere": "Premiere",
  "Siste dag": "Siste dag",
  "Babykino": "Babykino",
  "Seniorkino": "Seniorkino",
  "Nattkino": "Nattkino",
  "Strikkekino": "Strikkekino",
  "Vaffelkino": "Vaffelkino"
};

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

      // Collect all screening details
      const screenings = await moviePage.evaluate(() => {
        const screeningElements = document.querySelectorAll('.ticket-body');
        return Array.from(screeningElements).map(screening => {
          const badgeElement = screening.querySelector('.badge.is-highlight');
          const dateTimeElement = screening.querySelector('.ticket-time');

          const badge = badgeElement ? badgeElement.textContent.trim() : null;
          const dateTime = dateTimeElement ? dateTimeElement.textContent.trim() : 'Unknown Date & Time';

          const screeningData = { dateTime };
          if (badge) {
            screeningData.badge = badge; // Add badge only if it exists
          }
          return screeningData;
        });
      });

      // Filter and map badges
      const filteredScreenings = screenings
        .filter(screening => screening.dateTime) // Ensure valid dateTime
        .map(screening => ({
          dateTime: screening.dateTime,
          ...(screening.badge && { badge: validBadges[screening.badge] || screening.badge }) // Conditionally include badge
        }));

      movies.push({
        title,
        backgroundImgScr,
        screenings: filteredScreenings.length > 0
          ? filteredScreenings
          : [{ dateTime: 'No screenings available' }]
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
  setInterval(fetchMoviesData, 15 * 60 * 1000); // Run every 15 minutes
};

// Execute script manually or periodically
if (require.main === module) {
  runScriptPeriodically();
}
