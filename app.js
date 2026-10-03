"use strict";

const API_BASE = "https://inai-col1.fishrungames.com";
const ADS_URL = API_BASE + "/ads";
const PAGE_LIMIT = 30;

const form = document.getElementById("ad-form");
const titleInput = document.getElementById("title");
const descInput = document.getElementById("description");
const priceInput = document.getElementById("price");
const imageInput = document.getElementById("image");
const preview = document.getElementById("preview");
const submitBtn = document.getElementById("submit-btn");
const formStatus = document.getElementById("form-status");

const adsEl = document.getElementById("ads");
const listStatus = document.getElementById("list-status");
const totalEl = document.getElementById("total");
const refreshBtn = document.getElementById("refresh-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const pageInfo = document.getElementById("page-info");

const searchInput = document.getElementById("search");

let currentPage = 1;
let totalPages = 1;
let currentItems = [];

// Поиск выполняется на клиенте: в API для GET /ads нет параметров фильтрации
function renderList() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = query
    ? currentItems.filter((ad) =>
        `${ad.title ?? ""} ${ad.description ?? ""}`.toLowerCase().includes(query))
    : currentItems;

  adsEl.replaceChildren(...filtered.map(renderAd));

  if (!currentItems.length) {
    setStatus(listStatus, "Объявлений пока нет.");
  } else if (!filtered.length) {
    setStatus(listStatus, "Ничего не найдено.");
  } else {
    setStatus(listStatus, query ? `Найдено: ${filtered.length}` : "");
  }
}

function setStatus(el, text, kind) {
  el.textContent = text || "";
  el.className = "status" + (kind ? " " + kind : "");
}

function imageSrc(url) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : API_BASE + url;
}

function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " сом";
}

function renderAd(ad) {
  const card = document.createElement("article");
  card.className = "ad";

  const src = imageSrc(ad.image_url);
  if (src) {
    const img = document.createElement("img");
    img.className = "ad-image";
    img.src = src;
    img.alt = ad.title || "";
    img.loading = "lazy";
    img.addEventListener("error", () => {
      const ph = document.createElement("div");
      ph.className = "ad-placeholder";
      ph.textContent = "Изображение недоступно";
      img.replaceWith(ph);
    });
    card.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "ad-placeholder";
    ph.textContent = "Нет изображения";
    card.appendChild(ph);
  }

  const body = document.createElement("div");
  body.className = "ad-body";

  const title = document.createElement("h3");
  title.className = "ad-title";
  title.textContent = ad.title;

  const desc = document.createElement("p");
  desc.className = "ad-desc";
  desc.textContent = ad.description;

  const price = document.createElement("div");
  price.className = "ad-price";
  price.textContent = formatPrice(ad.price);

  body.append(title, desc, price);
  card.appendChild(body);
  return card;
}

async function loadAds(page = currentPage) {
  setStatus(listStatus, "Загрузка...");
  refreshBtn.disabled = true;
  try {
    const url = `${ADS_URL}?page=${page}&limit=${PAGE_LIMIT}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Ошибка сервера: " + res.status);
    const data = await res.json();

    const items = Array.isArray(data.items) ? data.items : [];
    const total = Number(data.total) || items.length;
    const limit = Number(data.limit) || PAGE_LIMIT;

    currentPage = Number(data.page) || page;
    totalPages = Math.max(1, Math.ceil(total / limit));

    currentItems = items;
    totalEl.textContent = `(всего: ${total})`;
    pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    renderList();
  } catch (err) {
    setStatus(listStatus, "Не удалось загрузить объявления: " + err.message, "error");
  } finally {
    refreshBtn.disabled = false;
  }
}

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (preview.src.startsWith("blob:")) URL.revokeObjectURL(preview.src);
  if (file) {
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  } else {
    preview.removeAttribute("src");
    preview.hidden = true;
  }
});

function validate() {
  if (!titleInput.value.trim()) return "Введите заголовок.";
  if (!descInput.value.trim()) return "Введите описание.";
  const price = parseFloat(priceInput.value);
  if (!Number.isFinite(price) || price < 0) return "Укажите корректную цену.";
  const file = imageInput.files[0];
  if (!file) return "Выберите изображение.";
  if (!file.type.startsWith("image/")) return "Файл должен быть изображением.";
  return null;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = validate();
  if (error) {
    setStatus(formStatus, error, "error");
    return;
  }

  const body = new FormData();
  body.append("title", titleInput.value.trim());
  body.append("description", descInput.value.trim());
  body.append("price", String(parseFloat(priceInput.value)));
  body.append("image", imageInput.files[0]);

  submitBtn.disabled = true;
  setStatus(formStatus, "Отправка...");
  try {
    // Content-Type не задаём вручную: браузер сам добавит boundary для multipart/form-data
    const res = await fetch(ADS_URL, { method: "POST", body });
    if (!res.ok) {
      let detail = "";
      try { detail = JSON.stringify((await res.json()).detail ?? ""); } catch (_) {}
      throw new Error(`Ошибка сервера: ${res.status} ${detail}`.trim());
    }
    await res.json();
    form.reset();
    imageInput.dispatchEvent(new Event("change"));
    setStatus(formStatus, "Объявление опубликовано.", "ok");
    await loadAds(1);
  } catch (err) {
    setStatus(formStatus, "Не удалось отправить объявление: " + err.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

searchInput.addEventListener("input", renderList);
refreshBtn.addEventListener("click", () => loadAds(currentPage));
prevBtn.addEventListener("click", () => loadAds(currentPage - 1));
nextBtn.addEventListener("click", () => loadAds(currentPage + 1));

loadAds(1);
