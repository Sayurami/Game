import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
    const { action, query, url } = req.query;
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    };

    try {
        if (!action) return res.status(400).json({ status: false, message: "Action missing (search/download)" });

        // --- 1. සෙවීම (Search Logic) ---
        if (action === "search") {
            const searchUrl = `https://www.alltypehacks.net/search?q=${encodeURIComponent(query)}&m=1`;
            const { data: searchHtml } = await axios.get(searchUrl, { headers });
            const $ = cheerio.load(searchHtml);
            const results = [];

            $(".post-title a, h3 a, h2 a").each((i, el) => {
                const title = $(el).text().trim();
                const link = $(el).attr("href");
                if (title && link) {
                    results.push({ title, link });
                }
            });

            return res.json({ status: true, data: results });
        }

        // --- 2. ඩවුන්ලෝඩ් (Download Logic - No Logic Removed) ---
        if (action === "download") {
            const { data: pageHtml } = await axios.get(url, { headers });
            const $p = cheerio.load(pageHtml);
            
            let bridgeUrl = "";
            $p("a").each((i, el) => {
                const href = $p(el).attr("href");
                if (href && (href.includes("alltypehacks.in/s/") || href.includes("files.alltypehacks.in"))) {
                    bridgeUrl = href;
                    return false;
                }
            });

            if (!bridgeUrl) return res.json({ status: false, message: "Download link not found inside the post." });

            // Step 3: Bridge Bypassing
            const bridgeRes = await axios.get(bridgeUrl, { headers, maxRedirects: 5 });
            const finalPageUrl = bridgeRes.request.res.responseUrl || bridgeRes.config.url;

            try {
                // POST request එක යවනවා (Start downloading simulate)
                const postRes = await axios.post(finalPageUrl, "download_file=", {
                    headers: {
                        ...headers,
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Referer": finalPageUrl
                    },
                    maxRedirects: 0, 
                    validateStatus: (status) => status >= 200 && status < 400
                });

                const direct = postRes.headers.location;
                if (direct) {
                    return res.json({ status: true, direct_link: direct });
                } else {
                    return res.json({ status: false, message: "Direct link hidden", manual_link: finalPageUrl });
                }
            } catch (err) {
                if (err.response && err.response.headers.location) {
                    return res.json({ status: true, direct_link: err.response.headers.location });
                } else {
                    return res.status(500).json({ status: false, error: err.message });
                }
            }
        }

    } catch (err) {
        return res.status(500).json({ status: false, error: err.message });
    }
}
