const express = require("express");
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const port = 3000;
const app = express();
const url = "mongodb://localhost:27017";
const dbname = "url_shortener";
let db;

async function connectToMongo() {
    try {
        const client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
        db = client.db(dbname);
        console.log("Successfully connected to mongodb");
    }
    catch (err) {
        console.log("Error connecting to MongoDB");
        process.exit(1);
    }
}

connectToMongo();

app.use(express.json());

app.get('/', (req, res) => {
    res.send("<h1>the get part</h1>");
});

async function generateShortUrl(longUrl) {
    const hash = crypto.createHash('sha256').update(longUrl).digest('hex');
    let attempt = 0;
    let uniqueShortId;

    while (true) {
        uniqueShortId = hash.substring(attempt, attempt + 7); // Take 7 characters from different positions in the hash

        try {
            const existingUrl = await db.collection("urls").findOne({ shortId: uniqueShortId });
            if (!existingUrl) {
                break; // Unique shortId found
            }
            attempt++;
        } catch (err) {
            console.log(err);
            break;
        }
    }

    return uniqueShortId;
}

app.post("/shorten", async (req, res) => {
    if (!db) {
        console.log("No database connection available");
        return res.status(500).send("Database connection is not available");
    }

    const longUrl = req.body.longUrl;
    if (!longUrl) {
        return res.status(400).send("Invalid URL");
    }

    try {

        let shortId = await db.collection('urls').findOne({longUrl:longUrl});
        if (shortId) {
            return res.status(400).send(`The Shortened Url for this already exists as: \"${shortId.shortId}\"`)
        }
        shortId = await generateShortUrl(longUrl);
        
        const urlEntry = { shortId, longUrl };
        await db.collection("urls").insertOne(urlEntry);

        const shortUrl = `${shortId}`;
        res.send(`${shortUrl}`);
    } catch (err) {
        console.log(err);
        res.status(500).send('Internal Server Error of shorten');
    }
});

app.get("/:shortId", async (req, res) => {
    if (!db) {
        console.log('No database connection available');
        return res.status(500).send('Database connection is not available');
    }

    const shortId = req.params.shortId;

    try {
        const urlEntry = await db.collection('urls').findOne({ shortId });
        if (urlEntry) {
            res.send(urlEntry.longUrl);
        } else {
            res.status(404).send("Short URL Not Found");
        }
    } catch (err) {
        console.log(err);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(port, () => {
    console.log("App running on port", port);
});
