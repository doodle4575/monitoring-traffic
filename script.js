// Configuration
const API_URL = 'http://127.0.0.1:5000/api/traffic';

// --- Initialize Libraries & Elements ---
const map = L.map('map', { zoomControl: true }).setView([-6.595, 106.797], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
const markers = L.layerGroup().addTo(map);

const volumeCtx = document.getElementById('volumeChart');
const volumeChart = new Chart(volumeCtx, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 150 } }
    }
});

// Initialize Modal
const cctvModalElement = document.getElementById('cctvModal');
const cctvModal = new bootstrap.Modal(cctvModalElement);
const modalTitle = document.getElementById('cctvModalLabel');

// --- Utility Functions ---
function volumeColor(count) {
    if (count >= 15) return '#dc3545'; // Jammed
    if (count >= 7) return '#ffc107';  // Congested
    return '#28a745';                   // Smooth
}

/**
 * Menampilkan pop-up modal dengan stream video yang telah diproses YOLO.
 * @param {object} point - Objek data lokasi dari API.
 */
function showCctvPopup(point) {
    modalTitle.textContent = `Live Stream (Deteksi Aktif) - ${point.name}`;
    
    // Ambil elemen <img> yang sudah kita ubah di index.html
    const streamViewer = document.getElementById('cctvStreamViewer');
    
    // Bangun URL ke endpoint video stream di backend Flask Anda
    const processedStreamUrl = `http://127.0.0.1:5000/video_feed/${point.id}`;
    
    // Atur sumber gambar ke stream yang diproses
    streamViewer.src = processedStreamUrl;
    
    cctvModal.show();
}

// --- Core Application Logic ---
/**
 * Renders data points to the map and table.
 * @param {Array} points - Array of location data from the API.
 */
function renderPoints(points) {
    markers.clearLayers();
    const tbody = document.getElementById('pointsTableBody');
    tbody.innerHTML = '';

    points.forEach(p => {
        const color = volumeColor(p.vehicle_count);
        
        // Add marker to map with a click event for the video pop-up
        const marker = L.circleMarker([p.lat, p.lng], {
            radius: 10, fillOpacity: 0.9, color: '#000', weight: 1, fillColor: color
        }).addTo(markers).on('click', () => showCctvPopup(p));
        
        marker.bindTooltip(`<strong>${p.name}</strong><br/>Klik untuk melihat live stream`);
        
        // Add row to table with a click event for the video pop-up
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><a href="#" class="link-select">${p.name}</a></td><td>${p.status}</td><td>${p.vehicle_count}</td>`;
        tbody.appendChild(tr);

        tr.querySelector('.link-select').addEventListener('click', (e) => {
            e.preventDefault();
            showCctvPopup(p);
        });
    });
}

/**
 * Updates the line chart with new vehicle volume data.
 * @param {Array} points - Array of location data from the API.
 */
function updateVolumeChart(points) {
    const timestamp = new Date().toLocaleTimeString('id-ID');
    if (volumeChart.data.labels.length > 15) volumeChart.data.labels.shift();
    volumeChart.data.labels.push(timestamp);

    points.forEach(p => {
        let dataset = volumeChart.data.datasets.find(ds => ds.label === p.name);
        if (!dataset) {
            dataset = {
                label: p.name,
                data: [],
                borderColor: volumeColor(p.vehicle_count),
                tension: 0.3,
                fill: false
            };
            volumeChart.data.datasets.push(dataset);
        }
        
        if (dataset.data.length > 15) dataset.data.shift();
        dataset.data.push(p.vehicle_count);
        dataset.borderColor = volumeColor(p.vehicle_count);
    });
    volumeChart.update();
}

/**
 * Main function to fetch data from the backend and trigger UI updates.
 */
async function fetchAndUpdate() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
        
        const data = await response.json();
        const points = data.points; // Langsung gunakan data dari backend

        if (points.length > 0) {
            renderPoints(points);
            updateVolumeChart(points);
        }
    } catch (error) {
        console.error("Gagal mengambil data dari backend:", error);
    }
}

// --- Event Listeners & Initializers ---
// Membersihkan stream saat modal ditutup untuk menghemat resource
cctvModalElement.addEventListener('hidden.bs.modal', () => {
    const streamViewer = document.getElementById('cctvStreamViewer');
    // Mengosongkan src akan menghentikan koneksi ke stream
    streamViewer.src = ""; 
});

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    fetchAndUpdate(); // Initial call
    setInterval(fetchAndUpdate, 5000); // Auto-refresh every 5 seconds
    document.getElementById('refreshBtn').addEventListener('click', fetchAndUpdate);
});