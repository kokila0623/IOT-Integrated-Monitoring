
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getDatabase,
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
    getAuth,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 1. Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBH-3391eeczMmJcQc1Cuer9G6DjebHLzQ",
    authDomain: "iot-integrated-smartmonitoring.firebaseapp.com",
    databaseURL: "https://iot-integrated-smartmonitoring-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "iot-integrated-smartmonitoring",
    appId: "1:572982811499:web:1c51514440b4f754064a2e"
};

// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// 3. Login button
document.getElementById("loginBtn").addEventListener("click", async () => {

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const message = document.getElementById("loginMessage");

    if (!email || !password) {
        message.textContent = "Please enter your email and password.";
        return;
    }

    message.textContent = "Connecting to Firebase...";

    try {
        await signInWithEmailAndPassword(auth, email, password);
        message.textContent = "Firebase connected successfully!";

        await loadDailyLogs();

    } catch (error) {
        console.error(error);
        message.textContent = "Login failed: " + error.message;
    }
});

// 4. Read daily LPG records
async function loadDailyLogs() {

    try {
        const snapshot = await get(ref(database, "dailyLogs"));

        if (!snapshot.exists()) {
            document.getElementById("predictionResult").textContent =
                "No daily records found.";
            return;
        }

        const records = snapshot.val();

        const readings = Object.entries(records)
            .map(([date, data]) => ({
                date: date,
                weight: Number(data.grossWeightKg),
                lpg: Number(data.lpgRemainingKg),
                percentage: Number(data.lpgPercentage)
            }))
            .filter(r =>
                Number.isFinite(r.weight) &&
                Number.isFinite(r.lpg) &&
                Number.isFinite(r.percentage)
            )
            .sort((a, b) => a.date.localeCompare(b.date));

        if (readings.length < 3) {
            document.getElementById("predictionResult").textContent =
                "At least three valid readings are required.";
            return;
        }

        displayLatestReading(readings);
        displayHistory(readings);
        calculatePrediction(readings);

    } catch (error) {
        console.error(error);
        document.getElementById("predictionResult").textContent =
            "Unable to read Firebase data: " + error.message;
    }
}

// 5. Display latest reading
function displayLatestReading(readings) {

    const latest = readings[readings.length - 1];

    document.getElementById("weight").textContent =
        latest.weight.toFixed(3) + " kg";

    document.getElementById("lpg").textContent =
        latest.lpg.toFixed(3) + " kg";

    document.getElementById("percentage").textContent =
        latest.percentage.toFixed(2) + " %";
}

// 6. Calculate linear regression
function calculatePrediction(readings) {

    const firstDate = new Date(readings[0].date + "T00:00:00");

    const x = readings.map(r => {
        const date = new Date(r.date + "T00:00:00");
        return Math.round((date - firstDate) / 86400000);
    });

    const y = readings.map(r => r.lpg);

    const n = x.length;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    const numerator = x.reduce(
        (sum, value, i) => sum + (value - meanX) * (y[i] - meanY),
        0
    );

    const denominator = x.reduce(
        (sum, value) => sum + (value - meanX) ** 2,
        0
    );

    if (denominator === 0) {
        document.getElementById("predictionResult").textContent =
            "Not enough date variation for prediction.";
        return;
    }

    const m = numerator / denominator;
    const c = meanY - m * meanX;

    const ssTotal = y.reduce(
        (sum, value) => sum + (value - meanY) ** 2,
        0
    );

    const ssResidual = y.reduce(
        (sum, value, i) => sum + (value - (m * x[i] + c)) ** 2,
        0
    );

    const rSquared = ssTotal === 0
        ? 0
        : 1 - ssResidual / ssTotal;

    const latest = readings[readings.length - 1];

    if (m < 0) {
        const consumption = -m;
        const days = latest.lpg / consumption;

        document.getElementById("consumption").textContent =
            consumption.toFixed(4) + " kg/day";

        document.getElementById("predictionResult").textContent =
            "Estimated days until refill: " + days.toFixed(2) + " days";
    } else {
        document.getElementById("consumption").textContent =
            "Insufficient decreasing trend";

        document.getElementById("predictionResult").textContent =
            "A reliable refill estimate cannot be calculated yet.";
    }
}

// 7. Display daily history
function displayHistory(readings) {

    let html = `
        <table>
            <tr>
                <th>Date</th>
                <th>Gross Weight (kg)</th>
                <th>LPG Remaining (kg)</th>
                <th>LPG (%)</th>
            </tr>
    `;

    readings.forEach(r => {
        html += `
            <tr>
                <td>${r.date}</td>
                <td>${r.weight.toFixed(3)}</td>
                <td>${r.lpg.toFixed(3)}</td>
                <td>${r.percentage.toFixed(2)}%</td>
            </tr>
        `;
    });

    html += "</table>";

    document.getElementById("historyTable").innerHTML = html;
}
