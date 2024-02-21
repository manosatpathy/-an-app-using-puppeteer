const express = require("express");
const puppeteer = require("puppeteer");
const app = express();
const port = 3000;

app.use(express.json());

app.get("/", async (req, res) => {
  try {
    const keyword = req.headers.keyword;
    if (!keyword || typeof keyword !== "string") {
      res.status(400).json({ message: "invalid or keyword not provided" });
    }

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto("https://amazon.in");
    await page.focus("input[name='field-keywords']");
    await page.keyboard.type(keyword);
    await page.keyboard.press("Enter");
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    const productLinks = await page.evaluate(() => {
      const links = document.querySelectorAll(
        ".s-result-item .a-link-normal.a-text-normal"
      );
      return [...new Set(Array.from(links, (a) => a.href))].slice(0, 4);
    });

    const productDetails = productLinks.map(async (productLink) => {
      try {
        console.log("Fetching data for product");
        const productPage = await browser.newPage();
        await productPage.goto(productLink);

        const data = await productPage.evaluate(() => {
          const name =
            document
              .querySelector(".a-size-large.product-title-word-break")
              ?.textContent.trim() || "Name not found";
          const description =
            document
              .querySelector("#productDescription p span")
              ?.textContent.trim() || "Description not found";
          const rating =
            document
              .querySelector(
                ".a-icon.a-icon-star.a-star-4.cm-cr-review-stars-spacing-big span"
              )
              ?.textContent.trim() || "Rating not found";
          const noOfReviews =
            document
              .querySelector("#acrCustomerReviewText")
              ?.textContent.trim() || "Reviews not found";
          const price =
            document.querySelector(".a-price-whole")?.textContent.trim() ||
            "Price not found";

          return { name, description, rating, noOfReviews, price };
        });

        console.log("Data fetched for product");

        const seeAllReviewsLink = await productPage.$(
          ".a-link-emphasis.a-text-bold"
        );
        if (seeAllReviewsLink) {
          await seeAllReviewsLink.click();
          await productPage.waitForSelector(".a-row.a-spacing-small.review-data span span");

          console.log("Fetching reviews for product");

          const topReviews = await productPage.evaluate(() => {
            const reviews = document.querySelectorAll(
              ".a-row.a-spacing-small.review-data span span"
            );
            const user = document.querySelectorAll(".a-profile-content span");
            const topReviewsData = [];
            for (let i = 0; i < reviews.length; i++) {
              topReviewsData.push({
                customer: user[i].textContent.trim() || "Amazon user",
                review: reviews[i].textContent.trim(),
              });
            }
            return topReviewsData;
          });
          data.topReviews = topReviews;
        }
        console.log("Reviews fetched for product");

        await productPage.close();
        return data;
      } catch (error) {
        console.log(`Error fetching data`, error);
      }
    });

    const productData = await Promise.all(productDetails);
    await browser.close();
    res.status(200).json({ productDetail: productData });
  } catch (err) {
    console.log("unable to fetch details", err);
  }
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
