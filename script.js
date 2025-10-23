// ==========================================================
// FULL SCRIPT UNTUK FILE 'script.js'
// ==========================================================

// Configuration
// ⬇️ WAJIB GANTI URL INI ⬇️ (Ganti dengan URL ngrok dari output Colab Anda)
const API_URL = 'https://70838e8534c2.ngrok-free.app/api/traffic';

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
        scales: { y: { beginAtZero: true, max: 150 } } // Atur max Y-axis jika perlu
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

function statusLabel(status) {
    if (status === "Padat") return '<span class="badge text-bg-danger">Padat</span>';
    if (status === "Ramai") return '<span class="badge text-bg-warning">Ramai</span>';
    if (status === "Lancar") return '<span class="badge text-bg-success">Lancar</span>';
    return `<span class="badge text-bg-secondary">${status}</span>`;
}

function getMarkerIcon(count) {
    const iconHtml = `
    <div class="marker-container">
      <div class="marker-pin" style="background-color: ${volumeColor(count)};"></div>
      <div class="marker-count">${count}</div>
    </div>`;
    return L.divIcon({
        html: iconHtml,
        className: 'custom-div-icon', // Pastikan class ini ada di CSS jika Anda menambahkannya
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -42]
    });
}

// --- UI Rendering Functions ---
function renderPoints(points) {
    const tableBody = document.getElementById('pointsTableBody');
    tableBody.innerHTML = ''; // Clear existing table
    markers.clearLayers();    // Clear existing markers

    points.forEach(p => {
        // 1. Add Marker to Map
        const marker = L.marker([p.lat, p.lng], { icon: getMarkerIcon(p.vehicle_count) })
            .addTo(markers)
            .bindPopup(`<b>${p.name}</b><br>${p.vehicle_count} Kendaraan (${p.status})`);
        
        // Add click event to marker
        marker.on('click', () => openModal(p));

        // 2. Add Row to Table
        const row = document.createElement('tr');
        row.className = 'link-select';
        row.innerHTML = `
            <td>${p.name}</td>
            <td>${statusLabel(p.status)}</td>
            <td><b>${p.vehicle_count}</b></td>
        `;
        // Add click event to table row
        row.addEventListener('click', () => {
            openModal(p);
            map.flyTo([p.lat, p.lng], 16); // Zoom to point
        });
        tableBody.appendChild(row);
    });
}

/**
 * Opens the CCTV modal and starts the stream.
 * @param {object} cctv - The CCTV data object
 */
function openModal(cctv) {
    modalTitle.textContent = `Live Stream - ${cctv.name}`;
    const streamViewer = document.getElementById('cctvStreamViewer');
    
    // ⬇️ WAJIB GANTI URL INI ⬇️ (Ganti dengan URL ngrok dari output Colab Anda)
    streamViewer.src = `https://70838e8534c2.ngrok-free.app/video_feed/${cctv.id}`;
    
    cctvModal.show();
}

/**
 * Updates the line chart with new data.
 * @param {Array} points - Array of traffic data points
 */
function updateVolumeChart(points) {
    // Add current time as label
    const now = new Date();
    const timeLabel = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    if (volumeChart.data.labels.length > 15) {
        volumeChart.data.labels.shift();
    }
    volumeChart.data.labels.push(timeLabel);

    points.forEach(p => {
        let dataset = volumeChart.data.datasets.find(ds => ds.label === p.name);
        if (!dataset) {
            dataset = {
                label: p.name,
                data: [],
                fill: false,
                tension: 0.1
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

        if (points && points.length > 0) {
            renderPoints(points);
            updateVolumeChart(points);
        } else {
            console.warn("Tidak ada data 'points' yang diterima dari API.");
        }
    } catch (error) {
        console.error("Gagal mengambil data dari backend:", error);
        // Tampilkan error di UI jika perlu, misal:
        // document.getElementById('pointsTableBody').innerHTML = '<tr><td colspan="3" class="text-danger text-center">Gagal terhubung ke server backend.</td></tr>';
    }
}

// --- Event Listeners & Initializers ---
// Membersihkan stream saat modal ditutup untuk menghemat resource
cctvModalElement.addEventListener('hidden.bs.modal', () => {
    const streamViewer = document.getElementById('cctvStreamViewer');
    // Mengosongkan src akan menghentikan koneksi ke stream
    streamViewer.src = ""; 
});

// Menambahkan fungsi ke tombol refresh
document.getElementById('refreshBtn').addEventListener('click', () => {
    fetchAndUpdate();
});

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    fetchAndUpdate(); // Initial call
    setInterval(fetchAndUpdate, 5000); // Refresh data every 5 seconds
});
