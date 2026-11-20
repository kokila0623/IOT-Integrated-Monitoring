
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getDatabase,
    ref,
    get,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
    getAuth,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 1. Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "iot-integrated-smartmonitoring.firebaseapp.com",
    databaseURL: "https://iot-integrated-smartmonitoring-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "iot-integrated-smartmonitoring",
    appId: "1:572982811499:web:1c51514440b4f754064a2e"
};

// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// Helper: update an element only if it exists
function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

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

        // Load live sensor values
        startLiveMonitoring();

        // Load daily history
        await loadDailyLogs();

    } catch (error) {
        console.error(error);
        message.textContent = "Login failed: " + error.message;
    }
});

// 4. Read live sensor data continuously
let liveListenerStarted = false;

function startLiveMonitoring() {

    if (liveListenerStarted) return;

    liveListenerStarted = true;

    const liveRef = ref(database, "liveSensorData");

    onValue(liveRef, (snapshot) => {

        if (!snapshot.exists()) {
            setText("connectionStatus", "Waiting for Data");
            return;
        }

        const data = snapshot.val();

        console.log("Live Firebase Data:", data);

        // Weight and LPG cards
        const weight = Number(data.grossWeightKg);
        const lpg = Number(data.lpgRemainingKg);
        const percentage = Number(data.lpgPercentage);

        if (Number.isFinite(weight)) {
            setText("weight", weight.toFixed(3) + " kg");
        }

        if (Number.isFinite(lpg)) {
            setText("lpg", lpg.toFixed(3) + " kg");
        }

        if (Number.isFinite(percentage)) {
            setText("percentage", percentage.toFixed(2) + " %");
        }

        // Sensor readings
        const gas = Number(data.gasValue);

        if (Number.isFinite(gas)) {
            setText("gasValue", gas);
        }

        if (data.temperature !== null &&
            Number.isFinite(Number(data.temperature))) {
            setText("temperature", Number(data.temperature).toFixed(1) + " °C");
        }

        if (data.humidity !== null &&
            Number.isFinite(Number(data.humidity))) {
            setText("humidity", Number(data.humidity).toFixed(1) + " %");
        }

        // Alert status
        updateAlerts(data);

        // Connection status
        setText("connectionStatus", "Connected");

        // Last update
        setText("lastUpdated", data.timestamp || "--");

    }, (error) => {

        console.error("Live data error:", error);

        setText("connectionStatus", "Connection Error");
    });
}

// 5. Update website alerts
function updateAlerts(data) {

    const gasAlert = data.gasLeakage === true;
    const temperatureAlert = data.highTemperature === true;
    const lowGasAlert = data.lowGas === true;

    setText(
        "gasAlert",
        gasAlert ? "Gas Leakage Detected!" : "Normal"
    );

    setText(
        "temperatureAlert",
        temperatureAlert ? "High Temperature Alert!" : "Normal"
    );

    setText(
        "lpgAlert",
        lowGasAlert ? "Low LPG Level!" : "Normal"
    );
}

// 6. Read daily LPG records
async function loadDailyLogs() {

    try {

        const snapshot = await get(ref(database, "dailyLogs"));

        if (!snapshot.exists()) {

            setText("predictionResult", "No daily records found.");

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

        if (readings.length === 0) {

            setText("predictionResult", "No valid daily records found.");

            return;
        }

        // Display daily history
        displayHistory(readings);

        // Calculate prediction only with sufficient data
        if (readings.length < 3) {

            setText(
                "predictionResult",
                "At least three valid daily readings are required."
            );

            setText("consumption", "--");

            return;
        }

        calculatePrediction(readings);

    } catch (error) {

        console.error(error);

        setText(
            "predictionResult",
            "Unable to read Firebase data: " + error.message
        );
    }
}

// 7. Calculate consumption and refill prediction
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
        (sum, value, i) =>
            sum + (value - meanX) * (y[i] - meanY),
        0
    );

    const denominator = x.reduce(
        (sum, value) => sum + (value - meanX) ** 2,
        0
    );

    if (denominator === 0) {

        setText("predictionResult", "Not enough date variation for prediction.");

        return;
    }

    const slope = numerator / denominator;

    const latest = readings[readings.length - 1];

    if (slope < 0) {

        const consumption = -slope;
        const days = latest.lpg / consumption;

        setText(
            "consumption",
            consumption.toFixed(4) + " kg/day"
        );

        setText(
            "predictionResult",
            "Estimated days until refill: " + days.toFixed(2) + " days"
        );

    } else {

        setText("consumption", "Insufficient decreasing trend");

        setText(
            "predictionResult",
            "A reliable refill estimate cannot be calculated yet."
        );
    }
}

// 8. Display daily history
function displayHistory(readings) {

    const tableElement = document.getElementById("historyTable");

    if (!tableElement) return;

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

    tableElement.innerHTML = html;
}
