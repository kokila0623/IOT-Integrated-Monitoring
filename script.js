// Smart Gas Monitoring System

console.log("Smart Gas Monitoring Website Loaded");

document.addEventListener("DOMContentLoaded", function () {
    console.log("Dashboard is ready");

    document.getElementById("weight").textContent = "-- kg";
    document.getElementById("lpg").textContent = "-- %";
    document.getElementById("gas").textContent = "Connecting...";
    document.getElementById("temperature").textContent = "-- °C";
    document.getElementById("predictionResult").textContent =
        "Waiting for Firebase data...";
});
