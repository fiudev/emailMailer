const dotENV = require('dotenv').config();
const Parser = require("rss-parser");
const mjml = require("mjml");
const nodemailer = require("nodemailer");
const moment = require("moment");

const GoogleSpreadsheet = require('google-spreadsheet');
const {
  promisify
} = require('util');
const credentials = require(`../service-account.json`);
const cron = require('node-cron');
const {
  BitlyClient
} = require("bitly");

const bitly = new BitlyClient(process.env.BITLY_API, {});

// Cron Job
cron.schedule('0 15 * * Thursday', () => {
  let shell = require('../child_helper');

  let commandList = [
    "npm start"
  ]

  shell.series(commandList, function(err){
    console.log('Running Every Thursday at 1pm');
  });
}, {
  scheduled: true,
  timezone: "America/New_York"
});

const email = process.env.MAIL_EMAIL;
const password = process.env.MAIL_PASSWORD;

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
  cover: "https://www.cis.fiu.edu/wp-content/uploads/2019/09/scis-newsletter-cover-09192019.png",
  link: "https://www.cis.fiu.edu/events",
  calendar_url: "https://calendar.fiu.edu/department/computing_information_sciences/calendar/xml",
  date: moment().format('dddd, MMMM Do YYYY')
};
const CEC = {
  title: "College of Engineering",
  cover: "https://www.cis.fiu.edu/wp-content/uploads/2019/07/1-update-CEC-Email-Newsletter-header-min.jpg",
  link: "https://cec.fiu.edu/",
  calendar_url: "https://calendar.fiu.edu/department/cec/calendar/xml"
};

const Test = {
  title: "Test",
  cover: "http://news.fiu.edu/wp-content/uploads/FIU-campus-2016-000px.jpg",
  link: "https://fiu.edu",
  calendar_url: "https://calendar.fiu.edu/department/onestop/calendar/xml"
};

const calendar = SCIS;

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

    const media = event["media:content"][0]["$"].url;

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

  return {
    before: getUnique(index, 'link'),
    after: getUnique(reindex, 'link')
  }
}

// Google Spreadsheet
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
async function accessSpreadsheet() {
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID)
  await promisify(doc.useServiceAccountAuth)(credentials)
  const info = await promisify(doc.getInfo)()
  console.log(`Loaded doc: ` + info.title + ` by ` + info.author.email);
  doc.getRows(1, function (err, rows) {
    console.log(`Get All Rows: ` + rows);
  });
}

accessSpreadsheet()
console.log(accessSpreadsheet());

// Using MJML to format HTML Email
function formatHTML(events, calendar) {
  const {
    html
  } = mjml(
    `
  <mjml>
    <mj-body width="700px">
       
        <mj-section>
          <mj-column width="100%">
            <mj-image src=${calendar.cover} alt="header image" fluid-on-mobile="true" padding="0px"></mj-image>
          </mj-column>
        </mj-section>

        <mj-section background-color='#fff'>
	  <mj-column>
	    <mj-text align="center" font-size="21px" font-weight="500" color="#030303" padding="0 15px">${calendar.date}</mj-text>
	  </mj-column>
        </mj-section>

        <mj-section background-color="#fafafa"> 
          <mj-column width="600px" background-color="#FFF">
            
            ${events.before.map(
              event =>
              `
              <mj-section>
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
              <mj-spacer height="0px" />
                </mj-column>
              </mj-section>
              <mj-divider border-color="#081E3F" border-style="solid" border-width="1px" padding-left="100px" padding-right="100px" padding-bottom="5px" padding-top="5px"></mj-divider>
              `
              )}
            <mj-section background-color="#081D3F">
            <mj-text font-size="22px" font-weight="500" color="#fff" align="center">
                  Save the Date
              </mj-text>
            </mj-section>

	     <mj-raw>
              <ul>
             </mj-raw>	   
            ${events.after.map(
              event =>
                `
              <mj-text align="center" font-size="15px" font-weight="500" font-family="Helvetica Neue" color="#081D3F">
               <li> <a href=${event.link}> ${event.title} </a></li>
              </mj-text>
		<mj-spacer height="2px" />
            `
            )}
	  <mj-raw>
      	   </ul>
    	  </mj-raw>
	   
	  <mj-section background-color="#081D3F">
	  	<mj-text font-size="22px" font-weight="500" color="#fff" align="center">
                	Career Path
          	</mj-text>
	  </mj-section>
		<mj-text font-size="15px" font-weight="600" color="#000" align="center">
			<a href="https://careerpath.cis.fiu.edu/job/kleiner-perkins-fellows-8-kp-fellows-program-product-design-engineering/">KP Fellows Program (Product, Design, Engineering)</a>
		</mj-text>
		<mj-text font-size="14px" color="#000">
			The KP Fellows Program is a unique, career-defining opportunity for technical students who are interested in pursuing technology, entrepreneurship, design, and startups. Engineering and Design Fellows work with one of our company partners over the summer where they develop and hone their technical skills and are mentored by an executive within the company. Product Fellows will spend a full year working with one of our company partners.
		</mj-text>
		<mj-text>
			<a href="https://careerpath.cis.fiu.edu/job/kleiner-perkins-fellows-8-kp-fellows-program-product-design-engineering/">Learn More...</a>
		</mj-text>
			<mj-spacer height="2px" />
		<mj-divider border-color="#F8C93E"></mj-divider>
		<mj-text font-size="15px" font-weight="600" color="#000" align="center">
                        <a href="https://careerpath.cis.fiu.edu/job/fiu-panthersoft-fiu-miami-fl-7-erp-application-developer-i/">ERP Application Developer I</a>
                </mj-text>
                <mj-text font-size="14px" color="#000">
                        Entry level developer position at PantherSoft (FIU). This is a full-time position with benefits and tuition waiver for recent graduates of CS/IT with programming experience. Work with Oracle ERP PeopleSoft systems, FIU Mobile, Business Intelligence, Integration platforms, chatbots, and other enterprise systems.
                </mj-text>
                <mj-text>
                        <a href="https://careerpath.cis.fiu.edu/job/fiu-panthersoft-fiu-miami-fl-7-erp-application-developer-i/">Learn More...</a>
                </mj-text>
                        <mj-spacer height="2px" />
                <mj-divider border-color="#F8C93E"></mj-divider>
		<mj-text font-size="15px" font-weight="600" color="#000" align="center">
                        <a href="https://careerpath.cis.fiu.edu/job/gensco-pharma-doral-6-paid-it-internship/">Paid IT Internship</a>
                </mj-text>
                <mj-text font-size="14px" color="#000">
                        Gensco Pharma is currently looking to hire a paid intern to work out of our Doral, FL office location. Must be enrolled as junior, senior, or graduate student in: information technology, computer science,  software development, Internet of Things, computer engineering, management information science, health informatics, or related degree.
                </mj-text>
                <mj-text>
                        <a href="https://careerpath.cis.fiu.edu/job/gensco-pharma-doral-6-paid-it-internship/">Learn More...</a>
                </mj-text>
                        <mj-spacer height="2px" />
                <mj-divider border-color="#F8C93E"></mj-divider>
		<mj-text font-size="15px" font-weight="600" color="#000" align="center">
                        <a href="https://careerpath.cis.fiu.edu/job/daasly-inc-hialeah-fl-7-entry-level-sql-developer/">Entry Level SQL Developer</a>
                </mj-text>
                <mj-text font-size="14px" color="#000">
                        We are seeking an Entry Level SQL Developer to become part of our team! You will train directly with the company co-founders who have nearly a decade of experience in their field. Experience with databases, such as MySQL, SQL Server, AWS Redshift, Google Cloud Big Query.
                </mj-text>
                <mj-text>
                        <a href="https://careerpath.cis.fiu.edu/job/daasly-inc-hialeah-fl-7-entry-level-sql-developer/">Learn More...</a>
                </mj-text>
                        <mj-spacer height="2px" />
                <mj-divider border-color="#F8C93E"></mj-divider>
		<mj-text font-size="15px" font-weight="600" color="#000" align="center">
                        <a href="https://careerpath.cis.fiu.edu/job/the-ultimate-software-group-inc-1760-bell-tower-lane-weston-florida-33326-7-software-test-engineer/">Software Test Engineer</a>
                </mj-text>
                <mj-text font-size="14px" color="#000">
                        Software Test Engineer needed at Ultimate Software in Weston, Florida. Work proactively with members of project team to find and fix software defects.  Communicate with product owner in creating acceptance tests.  Write automated tests at the unit, services, integration and UI layers.
                </mj-text>
                <mj-text>
                        <a href="https://careerpath.cis.fiu.edu/job/the-ultimate-software-group-inc-1760-bell-tower-lane-weston-florida-33326-7-software-test-engineer/">Learn More...</a>
                </mj-text>
         </mj-section>

           <mj-section background-color="#fff">
              <mj-text align="center" font-size="15px" font-weight="300" font-family="Helvetica Neue" color="#000">
               Do you want to add your events and activities to this newsletter? <a href="http://bit.ly/FIU-Create-Event">Click here </a>to submit now!
              </mj-text>

            </mj-section>

              <!-- Copy Right -->
	    <mj-section background-color="#fff"> 
              <mj-text font-size="12px" font-weight="200" color="#000" align="center">
              Copyright © 2019, FIU School of Computing and Information Sciences, All rights reserved.
              </mj-text>
            </mj-section>
	<mj-raw>
		<img src="https://www.google-analytics.com/collect?v=1&tid=UA-72593959-1&cid=555&aip=1&t=event&ec=email&ea=open&dp=%2Femail%2Fnewsletter&dt=fiuwsn09192019">
	</mj-raw>
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
    host: "smtp.cs.fiu.edu",
    port: 25,
    secure: false,
    ignoreTLS: true
  });

  await transporter.sendMail({
    from: email,
    to: process.env.TO_EMAIL,
    subject: "FIUSCIS Events Newsletter",
    html
  });

  transporter.verify(function (error, success) {
    if (error) {
      console.log(error);
    } else {
      console.log("Server is ready to take our messages");
    }
  });
}

async function main() {
  const events = await parseURL(calendar).catch(console.error);

  const html = formatHTML(events, calendar);
  await mail(html).catch(console.error);
}

main();
