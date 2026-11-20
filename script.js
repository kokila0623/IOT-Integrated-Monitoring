
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
    apiKey: "AIzaSyBH-3391eeczMmJcQc1Cuer9G6DjebHLzQ",
    authDomain: "iot-integrated-smartmonitoring.firebaseapp.com",
    databaseURL: https://iot-integrated-smartmonitoring-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "iot-integrated-smartmonitoring",
    appId: "1:572982811499:web:1c51514440b4f754064a2e"
};


// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);


// Helper function to update HTML elements
function setText(id, value) {

    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


// Helper function to safely read numeric values
function getNumber(value) {

    if (value === null || value === undefined || value === "") {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
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

    setText("firebaseStatusText", "Firebase: Connecting...");

    try {

        await signInWithEmailAndPassword(auth, email, password);

        message.textContent = "Firebase connected successfully!";

        setText("firebaseStatusText", "Firebase: Connected");

        // Start continuous live monitoring
        startLiveMonitoring();

        // Load daily LPG history
        await loadDailyLogs();

    } catch (error) {

        console.error("Login Error:", error);

        message.textContent = "Login failed: " + error.message;

        setText("firebaseStatusText", "Firebase: Login failed");

    }

});


// 4. Read live sensor data continuously
let liveListenerStarted = false;

function startLiveMonitoring() {

    if (liveListenerStarted) {
        return;
    }

    liveListenerStarted = true;

    const liveRef = ref(database, "liveSensorData");

    onValue(liveRef, (snapshot) => {

        if (!snapshot.exists()) {

            console.log("No live sensor data found.");

            setText("firebaseStatusText", "Firebase: Waiting for data");

            return;
        }

        const data = snapshot.val();

        console.log("Live Firebase Data:", data);


        // ---------------------------------
        // LPG AND CYLINDER WEIGHT
        // ---------------------------------

        const weight = getNumber(data.grossWeightKg);

        const lpg = getNumber(data.lpgRemainingKg);

        const percentage = getNumber(data.lpgPercentage);


        if (weight !== null) {

            setText(
                "weight",
                weight.toFixed(3) + " kg"
            );

        }


        if (lpg !== null) {

            setText(
                "lpg",
                lpg.toFixed(3) + " kg"
            );

        }


        if (percentage !== null) {

            setText(
                "percentage",
                percentage.toFixed(2) + " %"
            );

        }


        // ---------------------------------
        // MQ-2 GAS SENSOR
        // ---------------------------------

        const gas = getNumber(data.gasValue);

        if (gas !== null) {

            setText("gasValue", gas);

        }


        // ---------------------------------
        // DHT11 TEMPERATURE
        // ---------------------------------

        const temperature = getNumber(data.temperature);

        if (temperature !== null) {

            setText(
                "temperature",
                temperature.toFixed(1) + " °C"
            );

        }


        // ---------------------------------
        // DHT11 HUMIDITY
        // ---------------------------------

        const humidity = getNumber(data.humidity);

        if (humidity !== null) {

            setText(
                "humidity",
                humidity.toFixed(1) + " %"
            );

        }


        // ---------------------------------
        // ALERTS
        // ---------------------------------

        updateAlerts(data);


        // ---------------------------------
        // FIREBASE CONNECTION STATUS
        // ---------------------------------

        setText(
            "firebaseStatusText",
            "Firebase: Connected"
        );


        // ---------------------------------
        // LAST UPDATED TIME
        // ---------------------------------

        let updatedTime = "Recently received";

        if (data.timestamp !== undefined && data.timestamp !== null) {

            const timestamp = Number(data.timestamp);

            if (Number.isFinite(timestamp)) {

                // Handle Unix seconds or milliseconds
                const date = new Date(
                    timestamp < 1000000000000
                        ? timestamp * 1000
                        : timestamp
                );

                updatedTime = date.toLocaleString();

            } else {

                updatedTime = String(data.timestamp);

            }

        }

        setText("lastUpdated", updatedTime);


    }, (error) => {

        console.error("Live Firebase Error:", error);

        setText(
            "firebaseStatusText",
            "Firebase: Unable to read data"
        );

    });

}


// 5. Update alerts
function updateAlerts(data) {

    const gasAlert = data.gasLeakage === true;

    const temperatureAlert = data.highTemperature === true;

    const lowGasAlert = data.lowGas === true;


    // Gas leakage alert message
    setText(
        "gasAlertMessage",
        gasAlert
            ? "WARNING: Gas leakage detected!"
            : "No gas leakage detected."
    );


    // Low LPG alert message
    setText(
        "lpgAlertMessage",
        lowGasAlert
            ? "WARNING: LPG level is low. Refill required."
            : "LPG level is sufficient."
    );


    // High temperature alert message
    setText(
        "temperatureAlertMessage",
        temperatureAlert
            ? "WARNING: High temperature detected!"
            : "Temperature is normal."
    );


    // Highlight active alerts
    const gasElement = document.getElementById("gasAlert");

    const lpgElement = document.getElementById("lpgAlert");

    const temperatureElement =
        document.getElementById("temperatureAlert");


    if (gasElement) {

        gasElement.classList.toggle(
            "active-alert",
            gasAlert
        );

    }


    if (lpgElement) {

        lpgElement.classList.toggle(
            "active-alert",
            lowGasAlert
        );

    }


    if (temperatureElement) {

        temperatureElement.classList.toggle(
            "active-alert",
            temperatureAlert
        );

    }

}


// 6. Read daily LPG records
async function loadDailyLogs() {

    try {

        const snapshot = await get(ref(database, "dailyLogs"));


        if (!snapshot.exists()) {

            setText(
                "predictionResult",
                "No daily records found."
            );

            setText(
                "historyTable",
                "No daily history available yet."
            );

            return;
        }


        const records = snapshot.val();


        const readings = Object.entries(records)

            .map(([date, data]) => ({

                date: date,

                weight: getNumber(data.grossWeightKg),

                lpg: getNumber(data.lpgRemainingKg),

                percentage: getNumber(data.lpgPercentage)

            }))

            .filter(r =>
                r.weight !== null &&
                r.lpg !== null &&
                r.percentage !== null
            )

            .sort((a, b) =>
                a.date.localeCompare(b.date)
            );


        if (readings.length === 0) {

            setText(
                "predictionResult",
                "No valid daily records found."
            );

            setText(
                "historyTable",
                "No valid history available."
            );

            return;
        }


        // Display daily history
        displayHistory(readings);


        // Calculate prediction only with sufficient readings
        if (readings.length < 3) {

            setText(
                "predictionResult",
                "At least three valid daily readings are required for prediction."
            );

            setText("consumption", "-- kg/day");

            return;
        }


        // Calculate consumption and refill prediction
        calculatePrediction(readings);


    } catch (error) {

        console.error("Daily Logs Error:", error);

        setText(
            "predictionResult",
            "Unable to read daily records: " + error.message
        );

    }

}


// 7. Calculate consumption and refill prediction
function calculatePrediction(readings) {

    const firstDate = new Date(
        readings[0].date + "T00:00:00"
    );


    const x = readings.map(r => {

        const date = new Date(
            r.date + "T00:00:00"
        );

        return Math.round(
            (date - firstDate) / 86400000
        );

    });


    const y = readings.map(r => r.lpg);

    const n = x.length;


    const meanX = x.reduce(
        (a, b) => a + b,
        0
    ) / n;


    const meanY = y.reduce(
        (a, b) => a + b,
        0
    ) / n;


    const numerator = x.reduce(
        (sum, value, i) =>
            sum + (value - meanX) * (y[i] - meanY),
        0
    );


    const denominator = x.reduce(
        (sum, value) =>
            sum + (value - meanX) ** 2,
        0
    );


    if (denominator === 0) {

        setText(
            "predictionResult",
            "Not enough date variation for prediction."
        );

        return;
    }


    const slope = numerator / denominator;

    const latest = readings[readings.length - 1];


    if (slope < 0 && latest.lpg > 0) {

        const consumption = -slope;

        const days = latest.lpg / consumption;


        setText(
            "consumption",
            consumption.toFixed(4) + " kg/day"
        );


        setText(
            "predictionResult",
            "Estimated days until refill: " +
            days.toFixed(2) +
            " days"
        );

    } else {

        setText(
            "consumption",
            "Insufficient data"
        );


        setText(
            "predictionResult",
            "A reliable refill estimate cannot be calculated yet."
        );

    }

}


// 8. Display daily history
function displayHistory(readings) {

    const tableElement =
        document.getElementById("historyTable");


    if (!tableElement) {
        return;
    }


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
