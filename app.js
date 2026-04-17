const state = {
  map: null,
  markersLayer: null,
  geoJsonLayer: null,
  selectedLatLng: null,
  mediaLibrary: {},
  places: [],
  geoFeatures: [],
  nextId: 1,
};

const dom = {
  mapTitle: document.getElementById("mapTitle"),
  mapSubtitle: document.getElementById("mapSubtitle"),
  liveTitle: document.getElementById("liveTitle"),
  liveSubtitle: document.getElementById("liveSubtitle"),
  selectedCoords: document.getElementById("selectedCoords"),
  pointTitle: document.getElementById("pointTitle"),
  pointDescription: document.getElementById("pointDescription"),
  pointMedia: document.getElementById("pointMedia"),
  youtubeUrl: document.getElementById("youtubeUrl"),
  addPointButton: document.getElementById("addPointButton"),
  clearAllButton: document.getElementById("clearAllButton"),
  exportButton: document.getElementById("exportButton"),
  placesList: document.getElementById("placesList"),
  mediaLibrary: document.getElementById("mediaLibrary"),
  csvInput: document.getElementById("csvInput"),
  geojsonInput: document.getElementById("geojsonInput"),
  mediaInput: document.getElementById("mediaInput"),
};

init();

function init() {
  setupMap();
  bindEvents();
  syncProjectText();
  refreshMediaSelect();
  renderPlaces();
}

function setupMap() {
  state.map = L.map("map").setView([41.9, 12.5], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(state.map);

  state.markersLayer = L.layerGroup().addTo(state.map);
  state.geoJsonLayer = L.layerGroup().addTo(state.map);

  state.map.on("click", (event) => {
    state.selectedLatLng = event.latlng;
    updateSelectedCoords();
  });

  state.map.on("popupopen", handlePopupOpen);
}

function bindEvents() {
  dom.mapTitle.addEventListener("input", syncProjectText);
  dom.mapSubtitle.addEventListener("input", syncProjectText);
  dom.addPointButton.addEventListener("click", addPointFromForm);
  dom.clearAllButton.addEventListener("click", clearAllPlaces);
  dom.exportButton.addEventListener("click", exportStandaloneHtml);
  dom.mediaInput.addEventListener("change", handleMediaUpload);
  dom.csvInput.addEventListener("change", handleCsvUpload);
  dom.geojsonInput.addEventListener("change", handleGeoJsonUpload);
}

function syncProjectText() {
  dom.liveTitle.textContent = dom.mapTitle.value.trim() || "Mappa dei Suoni";
  dom.liveSubtitle.textContent =
    dom.mapSubtitle.value.trim() ||
    "Ascoltare lo spazio aiuta a capire come i luoghi cambiano e che storie raccontano.";
}

function updateSelectedCoords() {
  if (!state.selectedLatLng) {
    dom.selectedCoords.textContent = "Coordinate: nessuna posizione selezionata";
    return;
  }

  dom.selectedCoords.textContent = `Coordinate: ${state.selectedLatLng.lat.toFixed(5)}, ${state.selectedLatLng.lng.toFixed(5)}`;
}

function addPointFromForm() {
  if (!state.selectedLatLng) {
    window.alert("Clicca prima sulla mappa per scegliere una posizione.");
    return;
  }

  const place = buildPlace({
    lat: state.selectedLatLng.lat,
    lng: state.selectedLatLng.lng,
    title: dom.pointTitle.value,
    description: dom.pointDescription.value,
    mediaName: dom.pointMedia.value,
    youtubeUrl: dom.youtubeUrl.value,
  });

  state.places.push(place);
  renderAll();
  resetPointForm();
}

function buildPlace(raw) {
  const media = raw.mediaName ? state.mediaLibrary[raw.mediaName] || null : null;
  const youtube = normalizeYoutubeUrl(raw.youtubeUrl || "");
  return {
    id: raw.id || state.nextId++,
    title: (raw.title || "Luogo sonoro").trim(),
    description: (raw.description || "").trim(),
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    mediaName: raw.mediaName || "",
    media: media
      ? {
          name: media.name,
          type: media.type,
          dataUrl: media.dataUrl,
        }
      : null,
    remoteMediaUrl: String(raw.mediaUrl || "").trim(),
    remoteMediaType: String(raw.mediaType || "").trim(),
    youtubeUrl: youtube.embedUrl,
    youtubeWatchUrl: youtube.watchUrl,
    youtubeVideoId: youtube.videoId,
  };
}

function resetPointForm() {
  dom.pointTitle.value = "";
  dom.pointDescription.value = "";
  dom.pointMedia.value = "";
  dom.youtubeUrl.value = "";
  state.selectedLatLng = null;
  updateSelectedCoords();
}

function renderAll() {
  renderPlaces();
  renderMapLayers();
}

function renderMapLayers() {
  state.markersLayer.clearLayers();
  state.geoJsonLayer.clearLayers();

  if (!state.places.length && !state.geoFeatures.length) {
    return;
  }

  const bounds = [];

  state.places.forEach((place) => {
    const marker = L.marker([place.lat, place.lng]).addTo(state.markersLayer);
    marker.bindPopup(renderPopupHtml(place), {
      maxWidth: place.youtubeVideoId ? 500 : 340,
      minWidth: place.youtubeVideoId ? 440 : 300,
    });
    bounds.push([place.lat, place.lng]);
  });

  state.geoFeatures.forEach((entry) => {
    const layer = L.geoJSON(entry.feature, {
      style: {
        color: "#dd6b20",
        weight: 3,
        opacity: 0.9,
        fillColor: "#f59e0b",
        fillOpacity: 0.18,
      },
      pointToLayer: (_, latlng) =>
        L.circleMarker(latlng, {
          radius: 7,
          color: "#9a3412",
          weight: 2,
          fillColor: "#f59e0b",
          fillOpacity: 0.95,
        }),
      onEachFeature: (_, featureLayer) => {
        featureLayer.bindPopup(renderPopupHtml(entry), {
          maxWidth: entry.youtubeVideoId ? 500 : 340,
          minWidth: entry.youtubeVideoId ? 440 : 300,
        });
      },
    }).addTo(state.geoJsonLayer);

    if (layer.getBounds && layer.getBounds().isValid()) {
      bounds.push(layer.getBounds());
    }
  });

  if (bounds.length === 1) {
    if (Array.isArray(bounds[0])) {
      state.map.setView(bounds[0], 13);
    } else {
      state.map.fitBounds(bounds[0], { padding: [40, 40] });
    }
  } else {
    const group = L.featureGroup([
      ...state.markersLayer.getLayers(),
      ...state.geoJsonLayer.getLayers(),
    ]);
    const allBounds = group.getBounds();
    if (allBounds.isValid()) {
      state.map.fitBounds(allBounds, { padding: [40, 40] });
    }
  }
}

function renderPlaces() {
  if (!state.places.length) {
    dom.placesList.className = "places-list empty";
    dom.placesList.textContent = "Nessun punto ancora creato.";
    return;
  }

  dom.placesList.className = "places-list";
  dom.placesList.innerHTML = "";

  state.places.forEach((place) => {
    const article = document.createElement("article");
    article.className = "place-card";
    article.innerHTML = `
      <h3>${escapeHtml(place.title)}</h3>
      <p>${escapeHtml(place.description || "Senza descrizione")}</p>
      <p><strong>Coordinate:</strong> ${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}</p>
      <p><strong>Media:</strong> ${escapeHtml(place.mediaName || "nessuno")} ${place.youtubeUrl ? "• YouTube collegato" : ""}</p>
      <div class="card-actions">
        <button data-action="zoom" data-id="${place.id}">Vai al punto</button>
        <button data-action="edit" data-id="${place.id}">Modifica</button>
        <button data-action="delete" data-id="${place.id}" class="ghost">Elimina</button>
      </div>
    `;
    dom.placesList.appendChild(article);
  });

  dom.placesList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.id);
      const action = button.dataset.action;
      if (action === "zoom") zoomToPlace(id);
      if (action === "delete") deletePlace(id);
      if (action === "edit") loadPlaceIntoForm(id);
    });
  });
}

function zoomToPlace(id) {
  const place = state.places.find((item) => item.id === id);
  if (!place) return;
  state.map.setView([place.lat, place.lng], 15);
}

function deletePlace(id) {
  state.places = state.places.filter((item) => item.id !== id);
  renderAll();
}

function loadPlaceIntoForm(id) {
  const place = state.places.find((item) => item.id === id);
  if (!place) return;

  state.places = state.places.filter((item) => item.id !== id);
  state.selectedLatLng = L.latLng(place.lat, place.lng);
  updateSelectedCoords();
  dom.pointTitle.value = place.title;
  dom.pointDescription.value = place.description;
  dom.pointMedia.value = place.mediaName || "";
  dom.youtubeUrl.value = place.youtubeWatchUrl || "";
  renderAll();
}

function clearAllPlaces() {
  if (!state.places.length && !state.geoFeatures.length) return;
  const confirmed = window.confirm("Vuoi eliminare tutti i punti della mappa?");
  if (!confirmed) return;
  state.places = [];
  state.geoFeatures = [];
  renderAll();
}

async function handleMediaUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    state.mediaLibrary[file.name] = {
      name: file.name,
      type: file.type,
      dataUrl,
    };
  }

  state.places = state.places.map((place) => {
    if (place.media || !place.mediaName || !state.mediaLibrary[place.mediaName]) return place;
    const media = state.mediaLibrary[place.mediaName];
    return {
      ...place,
      media: {
        name: media.name,
        type: media.type,
        dataUrl: media.dataUrl,
      },
    };
  });

  state.geoFeatures = state.geoFeatures.map((entry) => {
    if (entry.media || !entry.mediaName || !state.mediaLibrary[entry.mediaName]) return entry;
    const media = state.mediaLibrary[entry.mediaName];
    return {
      ...entry,
      media: {
        name: media.name,
        type: media.type,
        dataUrl: media.dataUrl,
      },
    };
  });

  refreshMediaSelect();
  renderAll();
  event.target.value = "";
}

function refreshMediaSelect() {
  const existingValue = dom.pointMedia.value;
  dom.pointMedia.innerHTML = '<option value="">Nessun media locale</option>';

  Object.values(state.mediaLibrary)
    .sort((a, b) => a.name.localeCompare(b.name, "it"))
    .forEach((media) => {
      const option = document.createElement("option");
      option.value = media.name;
      option.textContent = media.name;
      dom.pointMedia.appendChild(option);
    });

  dom.pointMedia.value = state.mediaLibrary[existingValue] ? existingValue : "";
  renderMediaLibrary();
}

function renderMediaLibrary() {
  const items = Object.values(state.mediaLibrary);
  if (!items.length) {
    dom.mediaLibrary.className = "media-library empty";
    dom.mediaLibrary.textContent = "Nessun media caricato.";
    return;
  }

  dom.mediaLibrary.className = "media-library";
  dom.mediaLibrary.innerHTML = "";

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "media-chip";
    div.innerHTML = `<strong>${escapeHtml(item.name)}</strong><br /><span>${escapeHtml(item.type || "media")}</span>`;
    dom.mediaLibrary.appendChild(div);
  });
}

async function handleCsvUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const text = await file.text();
  const rows = parseCsv(text);
  const imported = [];

  rows.forEach((row) => {
    const lat = pickFirst(row, ["lat", "latitude", "point_latitude", "y"]);
    const lng = pickFirst(row, ["lng", "lon", "long", "longitude", "point_longitude", "x"]);
    if (!isFinite(Number(lat)) || !isFinite(Number(lng))) return;

    imported.push(
      buildPlace({
        title: pickFirst(row, ["title", "name", "nome", "titolo"]),
        description: pickFirst(row, ["description", "desc", "descrizione", "citta"]),
        lat,
        lng,
        mediaName: pickFirst(row, ["mediaName", "media", "file", "filename"]),
        mediaUrl: pickFirst(row, ["mediaUrl", "audioUrl", "videoUrl", "url"]),
        mediaType: pickFirst(row, ["mediaType", "type"]),
        youtubeUrl: pickFirst(row, ["youtubeUrl", "youtube", "video"]),
      })
    );
  });

  if (!imported.length) {
    window.alert("Nel CSV non ho trovato righe valide con latitudine e longitudine.");
  } else {
    state.places.push(...imported);
    renderAll();
  }

  event.target.value = "";
}

async function handleGeoJsonUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const rawText = await file.text();
    const data = JSON.parse(rawText.replace(/^\uFEFF/, ""));
    const features = normalizeGeoJsonFeatures(data);
    const importedPoints = [];
    const importedFeatures = [];

    features.forEach((feature) => {
      const properties = feature.properties || {};
      if (!feature?.geometry?.type) return;

      if (feature.geometry.type === "Point") {
        const coords = feature.geometry.coordinates || [];
        if (!isFinite(Number(coords[1])) || !isFinite(Number(coords[0]))) return;

        importedPoints.push(
          buildPlace({
            title: pickFirst(properties, ["title", "name", "nome", "titolo", "NAME_1", "NAME"]),
            description: pickFirst(properties, [
              "description",
              "desc",
              "descrizione",
              "COUNTRY",
              "TYPE_1",
              "ENGTYPE_1",
            ]),
            lat: coords[1],
            lng: coords[0],
            mediaName: pickFirst(properties, ["mediaName", "media", "file", "filename"]),
            mediaUrl: pickFirst(properties, ["mediaUrl", "audioUrl", "videoUrl", "url"]),
            mediaType: pickFirst(properties, ["mediaType", "type"]),
            youtubeUrl: pickFirst(properties, ["youtubeUrl", "youtube", "video"]),
          })
        );
        return;
      }

      importedFeatures.push(buildGeoFeature(feature));
    });

    if (!importedPoints.length && !importedFeatures.length) {
      window.alert("Nel GeoJSON non ho trovato geometrie valide.");
    } else {
      state.places.push(...importedPoints);
      state.geoFeatures.push(...importedFeatures);
      renderAll();
    }
  } catch (error) {
    console.error(error);
    window.alert("Il file GeoJSON non sembra valido.");
  }

  event.target.value = "";
}

function normalizeGeoJsonFeatures(data) {
  if (!data || typeof data !== "object") return [];
  if (data.type === "FeatureCollection") return Array.isArray(data.features) ? data.features : [];
  if (data.type === "Feature") return [data];
  if (data.type && data.coordinates) {
    return [{ type: "Feature", properties: {}, geometry: data }];
  }
  return [];
}

function buildGeoFeature(feature) {
  const properties = feature.properties || {};
  const mediaName = pickFirst(properties, ["mediaName", "media", "file", "filename"]);
  const media = mediaName ? state.mediaLibrary[mediaName] || null : null;
  const youtube = normalizeYoutubeUrl(
    pickFirst(properties, ["youtubeUrl", "youtube", "video"])
  );

  return {
    id: state.nextId++,
    title:
      pickFirst(properties, ["title", "name", "nome", "titolo", "NAME_1", "NAME"]) ||
      "Elemento geografico",
    description: pickFirst(properties, [
      "description",
      "desc",
      "descrizione",
      "COUNTRY",
      "TYPE_1",
      "ENGTYPE_1",
    ]),
    mediaName,
    media: media
      ? {
          name: media.name,
          type: media.type,
          dataUrl: media.dataUrl,
        }
      : null,
    remoteMediaUrl: pickFirst(properties, ["mediaUrl", "audioUrl", "videoUrl", "url"]),
    remoteMediaType: pickFirst(properties, ["mediaType", "type"]),
    youtubeUrl: youtube.embedUrl,
    youtubeWatchUrl: youtube.watchUrl,
    youtubeVideoId: youtube.videoId,
    feature,
  };
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const separator = detectSeparator(lines[0]);
  const headers = splitCsvLine(lines[0], separator).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line, separator);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || "").trim();
    });
    return row;
  });
}

function detectSeparator(headerLine) {
  const separators = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;

  separators.forEach((separator) => {
    const count = headerLine.split(separator).length;
    if (count > bestCount) {
      bestCount = count;
      best = separator;
    }
  });

  return best;
}

function splitCsvLine(line, separator) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === separator && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function pickFirst(object, keys) {
  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null && String(object[key]).trim() !== "") {
      return String(object[key]).trim();
    }
  }
  return "";
}

function normalizeYoutubeUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) {
    return {
      embedUrl: "",
      watchUrl: "",
      videoId: "",
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id
        ? {
            embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&controls=1&rel=0`,
            watchUrl: `https://www.youtube.com/watch?v=${id}`,
            videoId: id,
          }
        : { embedUrl: "", watchUrl: "", videoId: "" };
    }
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/")) {
        const id = parsed.pathname.split("/").filter(Boolean)[1] || "";
        return {
          embedUrl: id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&controls=1&rel=0` : trimmed,
          watchUrl: id ? `https://www.youtube.com/watch?v=${id}` : trimmed,
          videoId: id,
        };
      }
      const id = parsed.searchParams.get("v");
      return id
        ? {
            embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&controls=1&rel=0`,
            watchUrl: `https://www.youtube.com/watch?v=${id}`,
            videoId: id,
          }
        : { embedUrl: "", watchUrl: "", videoId: "" };
    }
  } catch (error) {
    console.warn("YouTube URL non valida", error);
  }

  return {
    embedUrl: "",
    watchUrl: "",
    videoId: "",
  };
}

function renderPopupHtml(place) {
  const description = place.description
    ? `<p>${escapeHtml(place.description)}</p>`
    : "<p>Nessuna descrizione.</p>";

  return `
    <div class="popup-content${place.youtubeVideoId ? " has-youtube" : ""}">
      <h3>${escapeHtml(place.title)}</h3>
      ${description}
      ${renderMediaHtml(place)}
    </div>
  `;
}

function renderMediaHtml(place) {
  const pieces = [];

  if (place.media?.type?.startsWith("audio/")) {
    pieces.push(`<audio controls src="${place.media.dataUrl}"></audio>`);
  }

  if (place.media?.type?.startsWith("video/")) {
    pieces.push(`<video controls playsinline src="${place.media.dataUrl}"></video>`);
  }

  if (place.remoteMediaUrl && place.remoteMediaType.startsWith("audio/")) {
    pieces.push(`<audio controls src="${place.remoteMediaUrl}"></audio>`);
  }

  if (place.remoteMediaUrl && place.remoteMediaType.startsWith("video/")) {
    pieces.push(`<video controls playsinline src="${place.remoteMediaUrl}"></video>`);
  }

  if (place.youtubeVideoId && place.youtubeWatchUrl) {
    if (window.location.protocol === "file:") {
      pieces.push(renderYoutubeFallbackHtml(place));
    } else if (place.youtubeUrl) {
      pieces.push(
        `<iframe src="${place.youtubeUrl}" title="Video YouTube" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
      );
    }
    pieces.push(
      `<p><a href="${place.youtubeWatchUrl}" target="_blank" rel="noopener noreferrer">Apri il video su YouTube</a></p>`
    );
  }

  return pieces.join("");
}

function renderYoutubeFallbackHtml(place) {
  const thumbnailUrl = `https://i.ytimg.com/vi/${place.youtubeVideoId}/hqdefault.jpg`;
  return `
    <div class="youtube-card">
      <a href="${place.youtubeWatchUrl}" target="_blank" rel="noopener noreferrer">
        <div class="youtube-thumb">
          <img src="${thumbnailUrl}" alt="Anteprima video YouTube di ${escapeHtml(place.title)}" />
          <div class="youtube-play" aria-hidden="true">
            <span class="youtube-play-triangle"></span>
          </div>
        </div>
        <span>Guarda il video su YouTube</span>
      </a>
      <p class="youtube-note">Nel file HTML scaricato YouTube non consente sempre il player incorporato.</p>
    </div>
  `;
}

function handlePopupOpen(event) {
  const container = event.popup?.getElement?.();
  if (!container) return;

  container.querySelectorAll("audio, video").forEach((media) => {
    media.controls = true;
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function exportStandaloneHtml() {
  if (!state.places.length) {
    window.alert("Aggiungi almeno un punto prima di esportare la mappa.");
    return;
  }

  const payload = {
    title: dom.mapTitle.value.trim() || "Mappa dei Suoni",
    subtitle:
      dom.mapSubtitle.value.trim() ||
      "Ascoltare lo spazio aiuta a capire come i luoghi cambiano e che storie raccontano.",
    places: state.places,
  };

  const serializedPayload = JSON.stringify(payload).replace(/<\/script/gi, "<\\\\/script");

  const html = `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(payload.title)}</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
    <style>
      :root {
        --bg: #f4efe5;
        --paper: #fffaf1;
        --ink: #16213e;
        --muted: #5d6b82;
        --accent: #dd6b20;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        color: var(--ink);
        background: linear-gradient(135deg, #f8f3ea 0%, #ece4d6 100%);
      }
      .layout {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(280px, 360px) 1fr;
      }
      .intro {
        padding: 24px;
        background: rgba(255, 250, 241, 0.92);
        border-right: 1px solid rgba(85, 67, 41, 0.12);
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.75rem;
        color: #9a3412;
        font-weight: 700;
      }
      h1 {
        font-family: Georgia, "Times New Roman", serif;
        font-size: clamp(2rem, 4vw, 2.8rem);
        margin: 8px 0 12px;
      }
      p {
        line-height: 1.5;
      }
      .muted {
        color: var(--muted);
      }
      #map {
        min-height: 100vh;
      }
      .card {
        background: white;
        border-radius: 18px;
        padding: 14px;
        margin-top: 16px;
      }
      .card h2 {
        margin-top: 0;
        font-size: 1rem;
      }
      .point {
        border-top: 1px solid #eadfca;
        padding-top: 10px;
        margin-top: 10px;
      }
      .popup-content {
        min-width: 320px;
      }
      .popup-content.has-youtube {
        min-width: 440px;
      }
      .popup-content audio,
      .popup-content video,
      .popup-content iframe {
        width: 100%;
        margin-top: 10px;
        border-radius: 12px;
      }
      .popup-content video { max-height: 220px; }
      .popup-content iframe {
        aspect-ratio: 16 / 9;
        min-height: 248px;
      }
      .youtube-card a {
        display: block;
        text-decoration: none;
        color: var(--ink);
        font-weight: 700;
      }
      .youtube-card img {
        width: 100%;
        margin-top: 10px;
        border-radius: 12px;
        aspect-ratio: 16 / 9;
        object-fit: cover;
      }
      .youtube-thumb {
        position: relative;
        margin-top: 10px;
      }
      .youtube-thumb img {
        margin-top: 0;
      }
      .youtube-play {
        position: absolute;
        inset: 50% auto auto 50%;
        transform: translate(-50%, -50%);
        width: 68px;
        height: 48px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.84);
        display: grid;
        place-items: center;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
      }
      .youtube-play-triangle {
        display: block;
        width: 0;
        height: 0;
        margin-left: 4px;
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
        border-left: 16px solid white;
      }
      .youtube-card span {
        display: inline-block;
        margin-top: 8px;
      }
      .youtube-note {
        margin-top: 8px;
        color: var(--muted);
        font-size: 0.9rem;
      }
      @media (max-width: 900px) {
        .layout { grid-template-columns: 1fr; }
        #map { min-height: 70vh; }
      }
    </style>
  </head>
  <body>
    <div class="layout">
      <aside class="intro">
        <div class="eyebrow">Mappa condivisa</div>
        <h1>${escapeHtml(payload.title)}</h1>
        <p class="muted">${escapeHtml(payload.subtitle)}</p>
        <div class="card">
          <h2>Punti della mappa</h2>
          ${payload.places
            .map(
              (place) => `
            <div class="point">
              <strong>${escapeHtml(place.title)}</strong><br />
              <span class="muted">${escapeHtml(place.description || "Senza descrizione")}</span>
            </div>`
            )
            .join("")}
        </div>
      </aside>
      <main id="map"></main>
    </div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script>
      const data = ${serializedPayload};
      const map = L.map("map");
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("popupopen", handlePopupOpen);

      const bounds = [];
      data.places.forEach((place) => {
        const marker = L.marker([place.lat, place.lng]).addTo(map);
        marker.bindPopup(\`
          <div class="popup-content\${place.youtubeVideoId ? " has-youtube" : ""}">
            <h3>\${escapeHtmlInline(place.title)}</h3>
            <p>\${escapeHtmlInline(place.description || "Nessuna descrizione.")}</p>
            \${renderMediaInline(place)}
          </div>
        \`, {
          maxWidth: place.youtubeVideoId ? 500 : 340,
          minWidth: place.youtubeVideoId ? 440 : 300,
        });
        bounds.push([place.lat, place.lng]);
      });

      if (bounds.length === 1) {
        map.setView(bounds[0], 13);
      } else {
        map.fitBounds(bounds, { padding: [40, 40] });
      }

      function renderMediaInline(place) {
        const pieces = [];
        if (place.media && place.media.type && place.media.type.startsWith("audio/")) {
          pieces.push(\`<audio controls src="\${place.media.dataUrl}"></audio>\`);
        }
        if (place.media && place.media.type && place.media.type.startsWith("video/")) {
          pieces.push(\`<video controls playsinline src="\${place.media.dataUrl}"></video>\`);
        }
        if (place.remoteMediaUrl && place.remoteMediaType && place.remoteMediaType.startsWith("audio/")) {
          pieces.push(\`<audio controls src="\${place.remoteMediaUrl}"></audio>\`);
        }
        if (place.remoteMediaUrl && place.remoteMediaType && place.remoteMediaType.startsWith("video/")) {
          pieces.push(\`<video controls playsinline src="\${place.remoteMediaUrl}"></video>\`);
        }
        if (place.youtubeVideoId && place.youtubeWatchUrl) {
          if (window.location.protocol === "file:") {
            const thumb = \`https://i.ytimg.com/vi/\${place.youtubeVideoId}/hqdefault.jpg\`;
            pieces.push(\`
              <div class="youtube-card">
                <a href="\${place.youtubeWatchUrl}" target="_blank" rel="noopener noreferrer">
                  <div class="youtube-thumb">
                    <img src="\${thumb}" alt="Anteprima video YouTube" />
                    <div class="youtube-play" aria-hidden="true">
                      <span class="youtube-play-triangle"></span>
                    </div>
                  </div>
                  <span>Guarda il video su YouTube</span>
                </a>
                <p class="youtube-note">Per vedere il video dentro il popup apri questa mappa da server locale invece che come file.</p>
              </div>
            \`);
          } else if (place.youtubeUrl) {
            pieces.push(\`<iframe src="\${place.youtubeUrl}" title="Video YouTube" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>\`);
          }
          pieces.push(\`<p><a href="\${place.youtubeWatchUrl}" target="_blank" rel="noopener noreferrer">Apri il video su YouTube</a></p>\`);
        }
        return pieces.join("");
      }

      function handlePopupOpen(event) {
        const container = event.popup && event.popup.getElement ? event.popup.getElement() : null;
        if (!container) return;

        container.querySelectorAll("audio, video").forEach((media) => {
          media.controls = true;
        });
      }

      function escapeHtmlInline(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }
    </script>
  </body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeTitle = payload.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-");
  link.href = url;
  link.download = `${safeTitle || "mappa-dei-suoni"}.html`;
  link.click();
  URL.revokeObjectURL(url);
}
