const { JSDOM } = require("jsdom");
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });

dom.window.addEventListener('load', () => {
    console.log("DOM Loaded.");

    // Call the newly updated function to see if it renders correctly without errors
    try {
        dom.window.renderPatterns();
        const htmlOut = dom.window.document.getElementById('patList').innerHTML;
        if (htmlOut && htmlOut.includes("pattern-item")) {
             console.log("Successfully rendered patterns.");
             console.log("Extracted items:", htmlOut.split('pattern-item').length - 1);
        } else {
             console.error("Pattern rendering failed or returned empty.");
             console.log(htmlOut);
        }
    } catch(e) {
        console.error("Error running renderPatterns:", e);
    }
});
