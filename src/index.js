const dotENV = require('dotenv').config();
const Parser = require("rss-parser");
const mjml = require("mjml");
const nodemailer = require("nodemailer");
const moment = require("moment");
const {
  BitlyClient
} = require("bitly");

const bitly = new BitlyClient(process.env.BITLY_API, {});

const email = process.env.GMAIL_EMAIL;
const password = process.env.GMAIL_PASSWORD;

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "media:content", {
        keepArray: true
      }]
    ]
  }
});

const SCIS = {
  title: "School of Computing and Information Sciences",
  cover: "https://parking.fiu.edu/wp-content/uploads/2018/04/pg6cornershot.jpg",
  link: "https://www.cis.fiu.edu/events",
  calendar_url: "https://calendar.fiu.edu/department/computing_information_sciences/calendar/xml"
};
const CEC = {
  title: "College of Engineering",
  cover: "http://news.fiu.edu/wp-content/uploads/FIU-campus-2016-000px.jpg",
  link: "https://cec.fiu.edu/",
  calendar_url: "https://calendar.fiu.edu/department/cec/calendar/xml"
};

const Test = {
  title: "Test",
  cover: "http://news.fiu.edu/wp-content/uploads/FIU-campus-2016-000px.jpg",
  link: "https://fiu.edu",
  calendar_url: "https://calendar.fiu.edu/department/onestop/calendar/xml"
};

const calendar = CEC;

/**
 *
 * @param {string} url
 */

async function parseURL(calendar) {
  const feed = await parser.parseURL(calendar.calendar_url);
  const {
    items: events
  } = feed;

  const date = new Date();
  const today = date.getDate();
  const nextweek = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 14
  );

  const promises = events.map(async event => {
    const {
      date,
      title,
      contentSnippet,
      link
    } = event;
    const datetime = new Date(date);
    //const {url} = await bitly.shorten(link);
    const media = event["media:content"][0]["$"].url;

    // console.log("List Event for 2 weeks: " + event);

    let snippet = contentSnippet
      .replace(/(<([^>]+)>)/gi, "")
      .replace(/(\r\n|\n|\r)/gm, "")
      .substring(0, 200);

    return {
      date: datetime,
      title,
      snippet,
      link,
      media
    };
  });

  let results = await Promise.all(promises);

  // Remove duplicate objects from the array of post
  function getUnique(results, comp) {
    const unique = results
      .map(e => e[comp])
      // store the keys of the unique objects
      .map((e, i, final) => final.indexOf(e) === i && i)
      // eliminate the dead keys & store unique objects
      .filter(e => results[e]).map(e => results[e]);

    return unique;
  }
  // Remove objects by date range
  index = results.filter(function (obj) {
    return obj.date <= nextweek;
  });

  // Save the Date: Remove objects by date range
  reindex = results.filter(function (obj) {
    return obj.date > nextweek;
  });

  // console.log("2week date: " + nextweek);
  //console.log("Index: " + index);
  // console.log("Save the Date results: " + reindex);

  //console.log(getUnique(results, 'link'));
  //return getUnique(index, 'link')
  return {
    before: getUnique(index, 'link'),
    after: getUnique(reindex, 'link')
  }
}

function formatHTML(events, calendar) {
  const {
    html
  } = mjml(
    `
  <mjml>
    <mj-body width="700px">
        <mj-section background-color="#081D3F">
            <mj-column>
                <mj-text font-size="20px" font-weight="500" color="#FFF" align="center">
                    ${calendar.title}
                </mj-text>
            </mj-column>
        </mj-section>
            <mj-section background-url=${calendar.cover} 
                background-size="cover" background-repeat="no-repeat">
            <mj-column width="600px">
                <mj-text align="center" color="#fff" font-size="40px" font-family="Helvetica Neue" font-weight="600">Upcoming Events</mj-text>
                <mj-button background-color="#F8C93D" href=${calendar.link}>
                    Learn more</mj-button>
            </mj-column>
            </mj-section>
              <mj-section background-color="#fafafa"> 
                  <mj-column width="600px">
      
            ${events.before.map(
              event =>
                `
              <mj-section background-color="white">
              <mj-raw>
                <!-- Left image -->
              </mj-raw>
              <mj-column align="center">
                <mj-image width="200px" src=${
                  event.media
                } align="center" fluid-on-mobile="true"></mj-image>
              </mj-column>
              <mj-raw>

                <!-- right paragraph -->
              </mj-raw>
              <mj-column>
                <mj-text font-size="20px" font-weight="500" font-family="Helvetica Neue" color="#081D3F">
                  ${event.title}
                </mj-text>
                <mj-text font-family="Helvetica Neue" color="#626262" font-size="14px" >${
                  event.snippet
                }...</mj-text>
                <mj-text color="#081D3F"><a href=${event.link}>
                Read more..</a></mj-text>
            <mj-spacer height="5px" />
              </mj-column>
            </mj-section>  
        `
            )}
            <mj-text font-size="20px" font-weight="500" color="#000" align="center">
                  Save the Date
              </mj-text>
            ${events.after.map(
              event =>
                `
              <mj-section background-color="white">
              <mj-raw>
                <!-- Left image -->
              </mj-raw>
              <mj-column align="center">
                <mj-image width="200px" src=${
                  event.media
                } align="center" fluid-on-mobile="true"></mj-image>
              </mj-column>
              <mj-raw>

                <!-- right paragraph -->
              </mj-raw>
              <mj-column>
                <mj-text font-size="20px" font-weight="500" font-family="Helvetica Neue" color="#081D3F">
                  ${event.title}
                </mj-text>
                <mj-text font-family="Helvetica Neue" color="#626262" font-size="14px" >${
                  event.snippet
                }...</mj-text>
                <mj-text color="#081D3F"><a href=${event.link}>
                Read more..</a></mj-text>
            <mj-spacer height="5px" />
              </mj-column>
            </mj-section>  
        `
            )}

            <mj-spacer height="5px" />
            <mj-section background-color="#F8C93E">
              <mj-column>
              <mj-text font-size="20px" font-weight="500" color="#000" align="center">
                  Special Events
              </mj-text>
              <mj-text color="#081D3F" font-size="16px">July 11th - <a href="https://calendar.fiu.edu/event/concrete_in_the_garden#.XSZQ9ZNKjUI">Concrete in the Garden</a></mj-text>
              <mj-text color="#081D3F" font-size="16px">Sept. 16th - <a href="https://calendar.fiu.edu/event/exhibition_david_chang_landscapes#.XSZQ65NKjUI">Exhibition: David Chang Landscapes</a></mj-text>
              <mj-text color="#081D3F" font-size="16px">Dec. 4th - <a href="https://calendar.fiu.edu/event/nodus_ensembles_fall_concert_series_7243#.XSZR7pNKjUI">NODUS Ensemble’s Fall Concert Series</a></mj-text>
              </mj-column>
            </mj-section>

            <mj-column>
    </mj-body>
  </mjml>
`, {
      beautify: true
    }
  );

  return html;
}

async function mail(html) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: email,
      pass: password
    }
  });

  await transporter.sendMail({
    from: email,
    to: process.env.TO_EMAIL,
    subject: "FIUCEC Events Newsletter",
    html
  });
}

async function main() {
  const events = await parseURL(calendar).catch(console.error);

  const html = formatHTML(events, calendar);
  await mail(html).catch(console.error);
}

main();