const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

const QUESTIONS = JSON.parse(fs.readFileSync("./data/questions.json"));

function shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5);
}

/* Home – User Details */
app.get("/", (req, res) => {
    res.render("index");
});

/* Save user and start quiz */
app.post("/start", (req, res) => {
    const userId = Date.now().toString() + Math.floor(Math.random() * 1000);
    const user = {
        userId,
        name: req.body.name,
        email: req.body.email,
        mobile: req.body.mobile,
        startTime: new Date()
    };

    const usersPath = "./data/users.json";
    const users = fs.existsSync(usersPath)
        ? JSON.parse(fs.readFileSync(usersPath))
        : [];

    users.push(user);
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    const questions = shuffle([...QUESTIONS]).slice(0, 50);
    console.log("Questions generated:", JSON.stringify(questions, null, 2));
    res.render("quiz", { questions, userId });
});

/* Helper to generate leaderboard */
function getLeaderboard(currentUserId) {
    const resultsPath = "./data/results.json";
    const usersPath = "./data/users.json";

    const results = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath)) : [];
    const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath)) : [];

    // Map users by ID for quick lookup
    const userMap = users.reduce((acc, u) => {
        acc[u.userId] = u;
        return acc;
    }, {});

    const leaderboard = results
        .map(r => {
            const u = userMap[r.userId];
            return {
                name: u ? u.name : "Unknown",
                score: r.score,
                userId: r.userId,
                submittedAt: r.submittedAt
            };
        })
        .sort((a, b) => b.score - a.score) // Sort by score desc
        .map((entry, index) => {
            const isCurrent = entry.userId === currentUserId;
            let displayName = entry.name;

            if (!isCurrent) {
                // Mask name: "John Doe" -> "J******"
                if (displayName.length > 2) {
                    displayName = displayName[0] + "*".repeat(displayName.length - 2) + displayName[displayName.length - 1];
                } else {
                    displayName = "***";
                }
            }

            return {
                rank: index + 1,
                name: displayName,
                score: entry.score,
                isCurrent
            };
        });

    return leaderboard;
}

/* Submit quiz */
app.post("/submit", (req, res) => {
    const { answers, userId } = req.body;
    let score = 0;

    answers.forEach((ans, i) => {
        if (QUESTIONS[i] && ans == QUESTIONS[i].answer) {
            score++;
        }
    });

    const resultsPath = "./data/results.json";
    const results = fs.existsSync(resultsPath)
        ? JSON.parse(fs.readFileSync(resultsPath))
        : [];

    results.push({
        userId,
        score,
        submittedAt: new Date()
    });

    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

    // Leaderboard Logic
    const leaderboard = getLeaderboard(userId);
    const currentRank = leaderboard.find(l => l.isCurrent);

    res.json({
        success: true,
        score,
        leaderboard: leaderboard, // Top 10
        rank: currentRank ? currentRank.rank : "-"
    });
});

/* Leaderboard Page */
app.get("/leaderboard", (req, res) => {
    const userId = req.query.userId;
    console.log("Requesting leaderboard for userId:", userId);

    const leaderboard = getLeaderboard(userId);
    const userEntry = leaderboard.find(l => l.isCurrent);

    console.log("Found userEntry:", userEntry ? "Yes" : "No");
    if (userEntry) console.log("User Rank:", userEntry.rank);

    res.render("leaderboard", { leaderboard: leaderboard, userId, userEntry });
});

if (require.main === module) {
    app.listen(3000, () =>
        console.log("🚀 Server running on http://localhost:3000")
    );
}

module.exports = app;
