const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Fallback data for when a movie fetch fails
const fallbackData = [
  {
    backgroundImgScr: 'https://www.istockphoto.com/photo/dark-movie-theatre-interior-with-screen-and-chairs-gm1968967126-558308843?utm_source=pixabay&utm_medium=affiliate&utm_campaign=SRP_image_sponsored_ratiochange&utm_content=https%3A%2F%2Fpixabay&utm_term=cinema+lux+seat',
    dateTime: 'Visste du at du kan booke en privatvisning?',
    badge: 'idhuset.no/kino'
  },
  {
    backgroundImgScr: 'https://www.istockphoto.com/photo/cute-toddler-boy-watching-cartoon-movie-in-the-cinema-gm868668838-144809033?utm_source=pixabay&utm_medium=affiliate&utm_campaign=SRP_image_sponsored_ratiochange&utm_content=https%3A%2F%2Fpixabay&utm_term=kids+cinema',
    dateTime: 'Ta barnebursdagen på kinoen? Pizza + film = Null stress',
    badge: 'Booking: idhuset.no/kino'
  },
  {
    backgroundImgScr: 'https://media.istockphoto.com/id/1488301035/photo/buying-movie-tickets.jpg?s=2048x2048&w=is&k=20&c=hO_ekk9dYRlQp_W3y7EYp0nzVe4Mfr8yBs5SwxpQY6A=',
    dateTime: 'Vil du vere frivillig på kinoen? Free movie + free popcorn!',
    badge: 'Filmvisning: idhuset.no/kino'
  },
  {
    backgroundImgScr: 'https://dx-cw-static-files.imgix.net/128/kinosal3.jpeg',
    dateTime: 'Sjå alle visninger på idhuset.no',
    badge: ''
  }
];

// List of valid badges
const validBadges = [
  "Førpremiere",
  "Verdenspremiere",
  "Norgespremiere",
  "Siste dag",
  "Skolekino",
  "Babykino",
  "Seniorkino",
  "Nattkino",
  "Strikkekino",
  "Dagkino"
];

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to the main page
    await page.goto('https://idhuset.no', { waitUntil: 'networkidle2' });

    // Scrape the main page to get the hrefs for the first 4 movie cards
    const hrefs = await page.evaluate(() => {
      const movieElements = document.querySelectorAll('.cards .card-item a');
      const links = [];

      // Extract up to 4 href links
      movieElements.forEach((movieElement, index) => {
        if (index < 4) {
          const href = movieElement.getAttribute('href');
          if (href) links.push(`https://idhuset.no${href}`);
        }
      });

      return links;
    });

    const movies = [];

    // Visit each href and scrape the required details
    for (let i = 0; i < 4; i++) {
      if (hrefs[i]) {
        const moviePage = await browser.newPage();
        await moviePage.goto(hrefs[i], { waitUntil: 'networkidle2' });

        const movieData = await moviePage.evaluate((validBadges) => {
          const backgroundImgElement = document.querySelector('.movie-poster');
          let backgroundImgScr = 'Placeholder Image URL'; // Default placeholder

          if (backgroundImgElement) {
            const backgroundImage = backgroundImgElement.style.backgroundImage;
            if (backgroundImage) {
              const match = backgroundImage.match(/url\(["']?(.*?)["']?\)/);
              if (match && match[1]) {
                backgroundImgScr = match[1]; // Extract URL from the matched group
                // Adjust the image resolution (keeping the aspect ratio)
                backgroundImgScr = backgroundImgScr.replace(/w=\d+&h=\d+/, 'w=480&h=480');
              }
            }
          }

          const screenings = document.querySelectorAll('.ticket-body');
          const results = [];

          screenings.forEach(screening => {
            const dateTimeElement = screening.querySelector('.ticket-time');
            const badgeElement = screening.querySelector('.badge');
            const dateTime = dateTimeElement ? dateTimeElement.textContent.trim() : 'Unknown Date & Time';
            const badge = badgeElement ? badgeElement.textContent.trim() : '';

            // Include only relevant badges
            const filteredBadge = validBadges.includes(badge) ? badge : '';

            results.push({
              backgroundImgScr: backgroundImgScr,
              dateTime: dateTime,
              badge: filteredBadge
            });
          });

          return results;
        }, validBadges);

        if (movieData.length > 0) {
          movies.push(...movieData);
        } else {
          // Add fallback data if no valid movie data is found
          movies.push(fallbackData[i % fallbackData.length]);
        }

        await moviePage.close();
      } else {
        // Add a placeholder for missing movies
        movies.push(fallbackData[i % fallbackData.length]);
      }
    }

    // Save the results to movies.json
    const filePath = path.join(__dirname, 'movies.json');
    fs.writeFileSync(filePath, JSON.stringify(movies, null, 2));
    console.log(`Data saved to ${filePath}`);

    // Close the browser
    await browser.close();
  } catch (error) {
    console.error('Error:', error);
  }
})();
