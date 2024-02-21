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

    //   code start here

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
      const productPage = await browser.newPage();
      await productPage.goto(productLink);

      const data = await productPage.evaluate(() => {
        const name =
          document
            .querySelector(".a-size-large.product-title-word-break")
            ?.textContent.trim() || "Name not found";
        const description =
          document.querySelector(".a-list-item")?.textContent.trim() ||
          "Description not found";
        const rating =
          document
            .querySelector(".a-size-base.a-color-base")
            ?.textContent.trim() || "Rating not found";
        const reviews =
          document
            .querySelector("#acrCustomerReviewText")
            ?.textContent.trim() || "Reviews not found";
        const price =
          document.querySelector(".a-price-whole")?.textContent.trim() ||
          "Price not found";

        return { name, description, rating, reviews, price };
      });

      await productPage.close();
      return data;
    });

    const productData = await Promise.all(productDetails);
    // console.log(productLinks)
    console.log(productData);
    await browser.close();
    res.status(200).json({ productDetail: productData });
  } catch (err) {
    console.log("unable to fetch details", err);
  }
});

//code ends here
// });

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
