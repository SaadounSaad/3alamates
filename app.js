const h = React.createElement;
const { useEffect, useMemo, useRef, useState } = React;

const STORAGE_KEYS = {
  bookmarks: "3alamates.bookmarks",
  draft: "3alamates.draft"
};

const categories = [
  { id: "memorisation", label: "حفظ", bg: "#E3EFE9", text: "#1F6B54" },
  { id: "revision", label: "مراجعة", bg: "#F6ECD9", text: "#96702A" },
  { id: "lecture", label: "قراءة", bg: "#E8EEF4", text: "#43596E" },
  { id: "tafsir", label: "تفسير", bg: "#F1E9F2", text: "#7C5286" },
  { id: "priere", label: "صلاة", bg: "#EAF1E6", text: "#4C7A44" }
];

const HABOUS_PRAYER_URL = "./api/horaires?ville=1";
const PRAYER_ORDER = [
  { key: "fajr", label: "الفجر" },
  { key: "sunrise", label: "الشروق" },
  { key: "dhuhr", label: "الظهر" },
  { key: "asr", label: "العصر" },
  { key: "maghrib", label: "المغرب" },
  { key: "isha", label: "العشاء" }
];
const NEXT_PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const JUZ_STARTS = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148],
  [5, 82], [6, 111], [7, 88], [8, 41], [9, 93], [11, 6],
  [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1],
  [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32],
  [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1]
];
const HIZB_STARTS = [
  [1, 1], [2, 75], [2, 142], [2, 203], [2, 253], [3, 15],
  [3, 93], [3, 171], [4, 24], [4, 88], [4, 148], [5, 27],
  [5, 82], [6, 36], [6, 111], [7, 1], [7, 88], [7, 171],
  [8, 41], [9, 34], [9, 93], [10, 26], [11, 6], [11, 84],
  [12, 53], [13, 19], [15, 1], [16, 51], [17, 1], [17, 99],
  [18, 75], [20, 1], [21, 1], [22, 1], [23, 1], [24, 21],
  [25, 22], [26, 111], [27, 56], [28, 51], [29, 46], [31, 22],
  [33, 31], [34, 24], [36, 28], [37, 145], [39, 32], [40, 41],
  [41, 47], [43, 24], [46, 1], [48, 18], [51, 31], [55, 1],
  [58, 1], [62, 1], [67, 1], [72, 1], [78, 1], [87, 1]
];

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeSearch(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatReference(surah, ayah) {
  return surah ? surah.nom + ":" + ayah : "";
}

function compareVerseRef(surahId, ayah, start) {
  if (surahId !== start[0]) {
    return surahId - start[0];
  }

  return ayah - start[1];
}

function findSectionNumber(starts, surahId, ayah) {
  let section = 1;

  starts.forEach(function (start, index) {
    if (compareVerseRef(surahId, ayah, start) >= 0) {
      section = index + 1;
    }
  });

  return section;
}

function getWirdInfo(surah, ayah) {
  if (!surah || !ayah) {
    return null;
  }

  return {
    juz: findSectionNumber(JUZ_STARTS, Number(surah.id), Number(ayah)),
    hizb: findSectionNumber(HIZB_STARTS, Number(surah.id), Number(ayah))
  };
}

function parsePrayerDate(time, baseDate, dayOffset) {
  const parts = String(time || "").trim().split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  const date = new Date(baseDate);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatCountdown(milliseconds) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));

  if (totalMinutes < 1) {
    return "أقل من دقيقة";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return "متبقي " + minutes + "د";
  }

  return "متبقي " + hours + "س " + minutes + "د";
}

function getPrayerSummary(prayerData, now) {
  if (!prayerData || !prayerData.prayers) {
    return null;
  }

  const todayPrayers = NEXT_PRAYER_KEYS
    .map(function (key) {
      const item = PRAYER_ORDER.find(function (prayer) { return prayer.key === key; });
      const date = parsePrayerDate(prayerData.prayers[key], now, 0);
      return date && item ? { key: key, label: item.label, time: prayerData.prayers[key], date: date } : null;
    })
    .filter(Boolean);

  let nextPrayer = todayPrayers.find(function (item) {
    return item.date.getTime() > now.getTime();
  });

  if (!nextPrayer && prayerData.prayers.fajr) {
    nextPrayer = {
      key: "fajr",
      label: "الفجر",
      time: prayerData.prayers.fajr,
      date: parsePrayerDate(prayerData.prayers.fajr, now, 1),
      tomorrow: true
    };
  }

  if (!nextPrayer || !nextPrayer.date) {
    return null;
  }

  return {
    next: nextPrayer,
    countdown: formatCountdown(nextPrayer.date.getTime() - now.getTime()),
    others: PRAYER_ORDER
      .filter(function (item) {
        return item.key !== nextPrayer.key && prayerData.prayers[item.key];
      })
      .map(function (item) {
        return item.label + " " + prayerData.prayers[item.key];
      })
      .join(" · ")
  };
}

function renderDateWithStrong(value, keyPrefix) {
  const text = String(value || "");
  const match = text.match(/(\d{1,2}\s+[^\s]+)/);

  if (!match) {
    return text;
  }

  return [
    text.slice(0, match.index),
    h("strong", { key: keyPrefix + "-strong", className: "header-date-strong" }, match[1]),
    text.slice(match.index + match[1].length)
  ];
}

function renderPrayerDate(prayerData) {
  if (!prayerData || !prayerData.date) {
    return "مواقيت الصلاة الرسمية - الرباط";
  }

  if (!prayerData.date.hijri && !prayerData.date.gregorian) {
    return "مواقيت الصلاة الرسمية - الرباط";
  }

  return [
    prayerData.date.hijri && renderDateWithStrong(prayerData.date.hijri, "hijri"),
    prayerData.date.hijri && prayerData.date.gregorian ? " " : "",
    prayerData.date.gregorian && renderDateWithStrong(prayerData.date.gregorian, "gregorian"),
    " ·"
  ];
}

function iconBookmark() {
  return h("svg", { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
    h("path", {
      d: "M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1Z",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinejoin: "round"
    })
  );
}

function iconDots() {
  return h("svg", { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true" },
    h("circle", { cx: 4, cy: 10, r: 1.8, fill: "currentColor" }),
    h("circle", { cx: 10, cy: 10, r: 1.8, fill: "currentColor" }),
    h("circle", { cx: 16, cy: 10, r: 1.8, fill: "currentColor" })
  );
}

function iconClose() {
  return h("svg", { width: 14, height: 14, viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true" },
    h("path", {
      d: "M1 1l10 10M11 1 1 11",
      stroke: "currentColor",
      strokeWidth: 1.7,
      strokeLinecap: "round"
    })
  );
}

function iconCopy() {
  return h("svg", { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true" },
    h("rect", { x: 7, y: 7, width: 10.5, height: 10.5, rx: 2, stroke: "currentColor", strokeWidth: 1.5 }),
    h("path", { d: "M4.5 12.5V4.5a1 1 0 0 1 1-1H13", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" })
  );
}

function iconShare() {
  return h("svg", { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true" },
    h("path", { d: "M6 10.5v5a1 1 0 0 0 1 1h8.5a1 1 0 0 0 1-1v-5", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }),
    h("path", { d: "M10.25 12.2V3M7.2 6.1l3.05-3.1 3.05 3.1", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" })
  );
}

function iconSearch() {
  return h("svg", { width: 17, height: 17, viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true", style: { flex: "none" } },
    h("circle", { cx: 9, cy: 9, r: 6.2, stroke: "currentColor", strokeWidth: 1.7 }),
    h("path", { d: "m17 17-3.4-3.4", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" })
  );
}

function iconEmpty() {
  return h("svg", { width: 56, height: 56, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
    h("circle", { cx: 12, cy: 12, r: 10.2, stroke: "var(--border)", strokeWidth: 1.4 }),
    h("path", {
      d: "M9 4.2h6a1 1 0 0 1 1 1V18l-4-2.4-4 2.4V5.2a1 1 0 0 1 1-1Z",
      stroke: "var(--muted)",
      strokeWidth: 1.4,
      strokeLinejoin: "round"
    })
  );
}

function iconExport() {
  return h("svg", { width: 16, height: 16, viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true" },
    h("path", { d: "M10 3v9M6.2 8.8 10 12.6l3.8-3.8", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }),
    h("path", { d: "M4 14.5v1.7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.7", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" })
  );
}

function iconImport() {
  return h("svg", { width: 16, height: 16, viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true" },
    h("path", { d: "M10 13V4M6.2 8.2 10 4.4l3.8 3.8", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }),
    h("path", { d: "M4 14.5v1.7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.7", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" })
  );
}

function iconDelete() {
  return h("svg", { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true" },
    h("path", {
      d: "M4.5 6.2h11M8.2 6.2V4.5a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v1.7M6.2 6.2 6.9 16a1 1 0 0 0 1 .9h4.2a1 1 0 0 0 1-.9l.7-9.8",
      stroke: "currentColor",
      strokeWidth: 1.5,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    })
  );
}

function App() {
  const importInputRef = useRef(null);
  const surahSearchInputRef = useRef(null);
  const selectedSurahRowRef = useRef(null);
  const statusTimerRef = useRef(null);
  const savedDraft = safeJsonParse(localStorage.getItem(STORAGE_KEYS.draft), {});

  const [surahs, setSurahs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedSurahId, setSelectedSurahId] = useState(String(savedDraft.selectedSurahId || ""));
  const [ayahNumber, setAyahNumber] = useState(String(savedDraft.ayahNumber || ""));
  const [searchTerm, setSearchTerm] = useState("");
  const [note, setNote] = useState(savedDraft.note || "");
  const [category, setCategory] = useState(savedDraft.category || categories[0].id);
  const [bookmarkSearch, setBookmarkSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [status, setStatus] = useState("");
  const [surahPickerOpen, setSurahPickerOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState("");
  const [prayerData, setPrayerData] = useState(null);
  const [prayerError, setPrayerError] = useState("");
  const [now, setNow] = useState(function () {
    return new Date();
  });
  const [bookmarks, setBookmarks] = useState(function () {
    return safeJsonParse(localStorage.getItem(STORAGE_KEYS.bookmarks), []);
  });

  useEffect(function () {
    fetch("./quran.json", { cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Impossible de charger quran.json");
        }
        return response.json();
      })
      .then(function (data) {
        const loadedSurahs = Array.isArray(data.sourates) ? data.sourates : [];
        setSurahs(loadedSurahs);
        setSelectedSurahId(function (current) {
          return current || (loadedSurahs[0] ? String(loadedSurahs[0].id) : "");
        });
      })
      .catch(function () {
        setLoadError("تعذر تحميل بيانات السور.");
      })
      .finally(function () {
        setLoading(false);
      });
  }, []);

  useEffect(function () {
    localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(function () {
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify({
      selectedSurahId: selectedSurahId,
      ayahNumber: ayahNumber,
      note: note,
      category: category
    }));
  }, [selectedSurahId, ayahNumber, note, category]);

  useEffect(function () {
    let cancelled = false;

    fetch(HABOUS_PRAYER_URL, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Habous HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        if (cancelled) {
          return;
        }
        setPrayerData(data);
        setPrayerError("");
      })
      .catch(function () {
        if (!cancelled) {
          setPrayerError("تعذر تحميل مواقيت الصلاة");
        }
      });

    return function () {
      cancelled = true;
    };
  }, []);

  useEffect(function () {
    const timer = window.setInterval(function () {
      setNow(new Date());
    }, 30000);

    return function () {
      window.clearInterval(timer);
    };
  }, []);

  const selectedSurah = useMemo(function () {
    return surahs.find(function (surah) {
      return String(surah.id) === String(selectedSurahId);
    });
  }, [surahs, selectedSurahId]);

  const ayahValue = Number(ayahNumber);
  const isAyahValid = Boolean(selectedSurah && ayahNumber && ayahValue >= 1 && ayahValue <= selectedSurah.ayahs);
  const validationText = selectedSurah ? "من 1 إلى " + selectedSurah.ayahs : "اختر سورة أولا";
  const wirdInfo = isAyahValid ? getWirdInfo(selectedSurah, ayahValue) : null;

  const filteredSurahs = useMemo(function () {
    const query = normalizeSearch(searchTerm);
    if (!query) {
      return surahs;
    }
    return surahs.filter(function (surah) {
      const searchable = [
        surah.id,
        surah.nom,
        surah.latin,
        surah.id + " " + surah.nom,
        surah.id + " " + surah.latin
      ].map(normalizeSearch).join(" ");
      return searchable.includes(query);
    });
  }, [surahs, searchTerm]);

  useEffect(function () {
    if (!surahPickerOpen) {
      return;
    }

    window.setTimeout(function () {
      if (!searchTerm && selectedSurahRowRef.current) {
        selectedSurahRowRef.current.scrollIntoView({ block: "center" });
      }
      if (surahSearchInputRef.current) {
        surahSearchInputRef.current.focus({ preventScroll: true });
      }
    }, 0);
  }, [surahPickerOpen, searchTerm, selectedSurahId, filteredSurahs.length]);

  const filteredBookmarks = useMemo(function () {
    const query = normalizeSearch(bookmarkSearch);
    return bookmarks
      .map(function (bookmark) {
        return {
          ...bookmark,
          surah: surahs.find(function (surah) {
            return Number(surah.id) === Number(bookmark.surahId);
          })
        };
      })
      .filter(function (bookmark) {
        return activeFilter === "all" || bookmark.category === activeFilter;
      })
      .filter(function (bookmark) {
        if (!query) {
          return true;
        }
        const categoryLabel = categories.find(function (item) {
          return item.id === bookmark.category;
        });
        const searchable = [
          bookmark.ayah,
          bookmark.note,
          bookmark.surah && bookmark.surah.nom,
          bookmark.surah && bookmark.surah.latin,
          categoryLabel && categoryLabel.label
        ].map(normalizeSearch).join(" ");
        return searchable.includes(query);
      });
  }, [bookmarks, bookmarkSearch, surahs, activeFilter]);

  function showStatus(message) {
    setStatus(message);
    window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(function () {
      setStatus("");
    }, 2200);
  }

  function sanitizeAyah(value) {
    return String(value || "").replace(/[^\d]/g, "").slice(0, 3);
  }

  function setCleanAyah(value) {
    const next = sanitizeAyah(value);
    if (selectedSurah && next && Number(next) > selectedSurah.ayahs) {
      showStatus("آخر آية في " + selectedSurah.nom + " هي " + selectedSurah.ayahs + ".");
      return;
    }
    setAyahNumber(next);
  }

  function pressDigit(digit) {
    if (!selectedSurah) {
      showStatus("اختر سورة أولا.");
      return;
    }
    const next = sanitizeAyah(ayahNumber + String(digit));
    if (!next) {
      setAyahNumber("");
      return;
    }
    if (Number(next) > selectedSurah.ayahs) {
      showStatus("آخر آية في " + selectedSurah.nom + " هي " + selectedSurah.ayahs + ".");
      return;
    }
    setAyahNumber(next.length > 1 && next[0] === "0" ? String(digit) : next);
  }

  function deleteDigit() {
    setAyahNumber(ayahNumber.slice(0, -1));
  }

  function clearForm() {
    setNote("");
    setCategory(categories[0].id);
  }

  function selectSurah(surah) {
    setSelectedSurahId(String(surah.id));
    setAyahNumber(function (current) {
      return current && Number(current) <= surah.ayahs ? current : "";
    });
    setSearchTerm("");
    setSurahPickerOpen(false);
  }

  function addBookmark() {
    if (!selectedSurah) {
      showStatus("اختر سورة قبل الحفظ.");
      return;
    }
    if (!isAyahValid) {
      showStatus("رقم الآية يجب أن يكون " + validationText + ".");
      return;
    }

    const duplicate = bookmarks.some(function (bookmark) {
      return Number(bookmark.surahId) === Number(selectedSurah.id) && Number(bookmark.ayah) === ayahValue;
    });

    if (duplicate) {
      showStatus("هذه الإشارة محفوظة من قبل.");
      return;
    }

    setBookmarks([{
      id: String(Date.now()),
      surahId: selectedSurah.id,
      ayah: ayahValue,
      note: note.trim(),
      category: category,
      createdAt: new Date().toISOString()
    }].concat(bookmarks));
    clearForm();
    showStatus("تم حفظ الإشارة.");
  }

  function removeBookmark(id) {
    setBookmarks(bookmarks.filter(function (bookmark) {
      return bookmark.id !== id;
    }));
    setDeleteConfirmId("");
    showStatus("تم حذف الإشارة.");
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showStatus("تم النسخ.");
      }).catch(function () {
        showStatus(text);
      });
    } else {
      showStatus(text);
    }
  }

  function shareBookmark(bookmark) {
    const text = bookmark.surah
      ? formatReference(bookmark.surah, bookmark.ayah) + (bookmark.note ? " - " + bookmark.note : "")
      : "";

    if (navigator.share) {
      navigator.share({ title: "3alamates", text: text }).catch(function () {});
    } else {
      copyText(text);
    }
  }

  function exportBookmarks() {
    const blob = new Blob([JSON.stringify(bookmarks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "3alamates-bookmarks.json";
    link.click();
    URL.revokeObjectURL(url);
    showStatus("تم تجهيز ملف الحفظ.");
  }

  function importBookmarks(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      const imported = safeJsonParse(String(reader.result || ""), null);
      if (!Array.isArray(imported)) {
        showStatus("ملف غير صالح.");
        return;
      }
      const normalized = imported
        .filter(function (bookmark) {
          const surah = surahs.find(function (item) {
            return Number(item.id) === Number(bookmark.surahId);
          });
          const ayah = Number(bookmark.ayah);
          return surah && ayah >= 1 && ayah <= surah.ayahs;
        })
        .map(function (bookmark) {
          return {
            id: String(bookmark.id || Date.now() + Math.random()),
            surahId: Number(bookmark.surahId),
            ayah: Number(bookmark.ayah),
            note: String(bookmark.note || "").trim(),
            category: categories.some(function (item) { return item.id === bookmark.category; })
              ? bookmark.category
              : categories[0].id,
            createdAt: bookmark.createdAt || new Date().toISOString()
          };
        });
      setBookmarks(normalized.concat(bookmarks));
      showStatus("تم استيراد " + normalized.length + " إشارة.");
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  function renderSurahPicker() {
    const pickerOpen = surahPickerOpen || !selectedSurah;

    return [
      h("div", { key: "label", className: "section-label" }, "السورة"),
      selectedSurah && h("button", {
        key: "selected",
        type: "button",
        className: "surah-chip surah-chip-button" + (surahPickerOpen ? " open" : ""),
        onClick: function () {
          setSearchTerm("");
          setSurahPickerOpen(!surahPickerOpen);
        },
        "aria-expanded": pickerOpen,
        "aria-controls": "surah-options"
      },
        h("div", { className: "surah-chip-main" },
          h("span", { className: "surah-chip-name" }, selectedSurah.nom + " (" + selectedSurah.id + ")"),
          h("span", { className: "surah-chip-sub" }, selectedSurah.latin + " — " + selectedSurah.ayahs + " آية")
        ),
        h("span", { className: "surah-chip-caret", "aria-hidden": "true" }, "⌄")
      ),
      pickerOpen && h("div", { key: "search", className: "surah-search-wrap" },
        h("div", { className: "search-bar surah-search-bar" },
          iconSearch(),
          h("input", {
            ref: surahSearchInputRef,
            id: "surah-search",
            className: "search-input",
            type: "search",
            value: searchTerm,
            onChange: function (event) { setSearchTerm(event.target.value); },
            placeholder: "ابحث بالاسم أو الرقم...",
            autoComplete: "off"
          }),
          searchTerm && h("button", {
            type: "button",
            className: "clear-btn",
            onClick: function () { setSearchTerm(""); },
            "aria-label": "مسح البحث"
          }, iconClose())
        )
      ),
      pickerOpen && h("div", { key: "options", id: "surah-options", className: "surah-dropdown", role: "listbox" },
        filteredSurahs.length
          ? filteredSurahs.map(function (surah) {
              const active = String(surah.id) === String(selectedSurahId);
              return h("button", {
                key: surah.id,
                ref: active ? selectedSurahRowRef : null,
                type: "button",
                className: "surah-row" + (active ? " active" : ""),
                role: "option",
                "aria-selected": active,
                onClick: function () { selectSurah(surah); }
              },
                h("span", { className: "surah-row-main" },
                  h("span", { className: "surah-name" }, surah.nom),
                  h("span", { className: "surah-tr" }, surah.latin)
                ),
                h("span", { className: "surah-badge" }, surah.id)
              );
            })
          : h("div", { className: "empty-state", style: { padding: "16px" } }, "لا توجد سورة مطابقة")
      )
    ];
  }

  function renderCategoryChips() {
    return h("div", { className: "category-chips" },
      categories.map(function (item) {
        const active = category === item.id;
        return h("button", {
          key: item.id,
          type: "button",
          className: "category-chip" + (active ? " active" : ""),
          style: active ? { borderColor: item.text, background: item.bg, color: item.text } : undefined,
          onClick: function () {
            setCategory(item.id);
          }
        }, item.label);
      })
    );
  }

  function renderFilterChips() {
    const tabs = [{ id: "all", label: "الكل" }].concat(categories);
    return h("div", { className: "filter-tabs" },
      tabs.map(function (item) {
        return h("button", {
          key: item.id,
          type: "button",
          className: "filter-tab" + (activeFilter === item.id ? " active" : ""),
          onClick: function () {
            setActiveFilter(item.id);
          }
        }, item.label);
      })
    );
  }

  function renderBookmark(bookmark) {
    const surah = bookmark.surah;
    const categoryInfo = categories.find(function (item) {
      return item.id === bookmark.category;
    }) || categories[0];
    const confirmingDelete = deleteConfirmId === bookmark.id;

    return h("article", { key: bookmark.id, className: "bookmark-card" },
      h("div", { className: "bookmark-top" },
        h("div", null,
          h("div", { className: "bookmark-ref arabic-display" }, surah ? formatReference(surah, bookmark.ayah) : "إشارة غير معروفة"),
          surah && h("div", { className: "bookmark-sub" }, surah.id + " - " + surah.latin)
        ),
        h("span", { className: "pill", style: { background: categoryInfo.bg, color: categoryInfo.text } }, categoryInfo.label)
      ),
      bookmark.note && h("p", { className: "bookmark-note" }, bookmark.note),
      h("div", { className: "bookmark-actions" },
        confirmingDelete
          ? [
              h("span", { key: "question", style: { color: "var(--danger)", fontSize: "13px", fontWeight: 800, marginLeft: "auto" } }, "حذف هذه الإشارة؟"),
              h("button", {
                key: "confirm",
                type: "button",
                className: "danger-button",
                onClick: function () { removeBookmark(bookmark.id); },
                "aria-label": "تأكيد الحذف"
              }, "نعم"),
              h("button", {
                key: "cancel",
                type: "button",
                className: "secondary-button",
                onClick: function () { setDeleteConfirmId(""); },
                "aria-label": "إلغاء"
              }, "لا")
            ]
          : [
              h("button", {
                key: "copy",
                type: "button",
                className: "bookmark-icon-button",
                onClick: function () { copyText(surah ? formatReference(surah, bookmark.ayah) : ""); },
                "aria-label": "نسخ"
              }, iconCopy()),
              h("button", {
                key: "share",
                type: "button",
                className: "bookmark-icon-button",
                onClick: function () { shareBookmark(bookmark); },
                "aria-label": "مشاركة"
              }, iconShare()),
              h("button", {
                key: "delete",
                type: "button",
                className: "bookmark-icon-button delete",
                onClick: function () { setDeleteConfirmId(bookmark.id); },
                "aria-label": "حذف"
              }, iconDelete())
            ]
      )
    );
  }

  function renderBottomSheet() {
    return h(React.Fragment, null,
      listOpen && h("div", { className: "sheet-backdrop", onClick: function () { setListOpen(false); } }),
      h("section", { className: "bottom-sheet" + (listOpen ? " open" : ""), "aria-label": "الإشارات المحفوظة" },
        h("div", { className: "sheet-handle" }),
        h("div", { className: "sheet-header" },
          h("h2", { className: "sheet-title" }, "الإشارات المحفوظة"),
          h("button", {
            type: "button",
            className: "icon-button",
            onClick: function () { setListOpen(false); },
            "aria-label": "إغلاق"
          }, iconClose())
        ),
        h("div", { className: "sheet-tools" },
          renderFilterChips(),
          h("div", { className: "search-bar" },
            iconSearch(),
            h("input", {
              className: "search-input",
              type: "search",
              value: bookmarkSearch,
              onChange: function (event) { setBookmarkSearch(event.target.value); },
              placeholder: "ابحث في الإشارات المحفوظة",
              autoComplete: "off"
            }),
            bookmarkSearch && h("button", {
              type: "button",
              className: "clear-btn",
              onClick: function () { setBookmarkSearch(""); },
              "aria-label": "مسح البحث"
            }, iconClose())
          )
        ),
        h("div", { className: "bookmarks-list" },
          filteredBookmarks.length
            ? filteredBookmarks.map(renderBookmark)
            : bookmarks.length
              ? h("div", { className: "empty-state" }, "لا توجد نتائج مطابقة لبحثك")
              : h("div", { className: "empty-state-rich" },
                  iconEmpty(),
                  h("div", { className: "empty-title" }, "لا توجد إشارات محفوظة بعد"),
                  h("div", { className: "empty-sub" }, "أضف إشارتك الأولى من الشاشة الرئيسية")
                )
        )
      )
    );
  }

  function renderMenu() {
    if (!menuOpen) {
      return null;
    }
    return h(React.Fragment, null,
      h("div", { className: "menu-backdrop", onClick: function () { setMenuOpen(false); } }),
      h("div", { className: "menu-panel" },
        h("button", {
          type: "button",
          className: "menu-item",
          onClick: function () { setMenuOpen(false); exportBookmarks(); }
        }, iconExport(), "تصدير الإشارات"),
        h("div", { className: "menu-divider" }),
        h("button", {
          type: "button",
          className: "menu-item",
          onClick: function () {
            setMenuOpen(false);
            importInputRef.current && importInputRef.current.click();
          }
        }, iconImport(), "استيراد الإشارات")
      )
    );
  }

  function renderPrayerStrip() {
    const summary = getPrayerSummary(prayerData, now);

    if (!summary) {
      return h("section", { className: "prayer-strip prayer-strip-muted", "aria-live": "polite" },
        h("div", { className: "prayer-strip-status" }, prayerError || "جاري تحميل مواقيت الصلاة...")
      );
    }

    return h("section", { className: "prayer-strip", "aria-label": "مواقيت الصلاة الرسمية لمدينة الرباط" },
      h("div", { className: "prayer-strip-top" },
        h("span", { className: "prayer-next-label" }, "التالي"),
        h("span", { className: "prayer-next-name" }, summary.next.label),
        h("span", { className: "prayer-next-time" }, summary.next.time),
        h("span", { className: "prayer-countdown" }, summary.next.tomorrow ? summary.countdown + " غدًا" : summary.countdown)
      ),
      h("div", { className: "prayer-other-times" }, summary.others)
    );
  }

  if (loading) {
    return h("main", { className: "app-shell" },
      h("div", { className: "empty-state" }, "جار تحميل التطبيق...")
    );
  }

  if (loadError) {
    return h("main", { className: "app-shell" },
      h("div", { className: "empty-state", style: { color: "var(--danger)" } }, loadError)
    );
  }

  return h("main", { className: "app-shell" },
    h("header", { className: "app-header header-stack" },
      h("div", { className: "header-main" },
        h("div", { className: "brand-lockup" },
          h("div", { className: "brand-icon" }, iconBookmark()),
          h("h1", { className: "brand-title" }, "علامات")
        ),
        h("div", { className: "header-actions" },
          h("button", {
            type: "button",
            className: "count-button",
            onClick: function () { setListOpen(true); },
            "aria-label": "فتح الإشارات المحفوظة"
          }, iconBookmark(), h("span", null, bookmarks.length)),
          h("button", {
            type: "button",
            className: "icon-button",
            onClick: function () { setMenuOpen(true); },
            "aria-label": "القائمة"
          }, iconDots())
        )
      ),
      h("div", { className: "header-date" }, renderPrayerDate(prayerData))
    ),

    renderPrayerStrip(),

    h("input", {
      ref: importInputRef,
      type: "file",
      accept: "application/json,.json",
      style: { display: "none" },
      onChange: importBookmarks
    }),

    h("form", {
      className: "form-scroll",
      onSubmit: function (event) {
        event.preventDefault();
        addBookmark();
      }
    },
      wirdInfo && h("div", { className: "wird-info", "aria-live": "polite" },
        h("span", { className: "wird-info-label" }, "الورد الحالي :"),
        h("span", null, "الجزء ", h("strong", null, wirdInfo.juz)),
        h("span", null, "الحزب ", h("strong", null, wirdInfo.hizb))
      ),

      renderSurahPicker(),

      h("div", { className: "verse-inline" },
        h("div", { className: "verse-inline-copy" },
          h("label", { className: "section-label", style: { margin: 0 }, htmlFor: "ayah-number" }, "رقم الآية"),
          h("span", { className: "verse-helper" + (isAyahValid ? " valid" : "") }, validationText)
        ),
        h("input", {
          id: "ayah-number",
          className: "verse-display" + (isAyahValid ? " valid" : ""),
          dir: "ltr",
          type: "text",
          inputMode: "numeric",
          pattern: "[0-9]*",
          value: ayahNumber,
          onChange: function (event) { setCleanAyah(event.target.value); },
          placeholder: "0",
          autoComplete: "off"
        })
      ),
      h("div", { className: "numeric-keypad", "aria-label": "لوحة الأرقام" },
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (digit) {
          return h("button", {
            key: digit,
            type: "button",
            className: "keypad-button",
            onClick: function () { pressDigit(digit); }
          }, digit);
        }),
        h("button", {
          type: "button",
          className: "keypad-button keypad-action",
          onClick: function () { setAyahNumber(""); },
          "aria-label": "مسح"
        }, "×"),
        h("button", {
          type: "button",
          className: "keypad-button",
          onClick: function () { pressDigit(0); }
        }, "0"),
        h("button", {
          type: "button",
          className: "keypad-button keypad-action",
          onClick: deleteDigit,
          "aria-label": "حذف رقم"
        }, "⌫")
      ),

      h("div", { className: "section-label" }, "التصنيف ", h("span", { className: "optional-label" }, "(اختياري)")),
      renderCategoryChips(),

      h("label", { className: "section-label", htmlFor: "note" }, "ملاحظة ", h("span", { className: "optional-label" }, "(اختياري)")),
      h("textarea", {
        id: "note",
        className: "field note-field",
        value: note,
        onChange: function (event) { setNote(event.target.value); },
        placeholder: "مثال: تلاوة الفجر",
        rows: 3
      })
    ),

    h("div", { className: "cta-bar" },
      h("button", {
        type: "button",
        className: "save-button",
        disabled: !isAyahValid,
        onClick: addBookmark
      }, "حفظ الإشارة")
    ),

    renderBottomSheet(),
    renderMenu(),
    status && h("div", { className: "toast" }, status)
  );
}

ReactDOM.render(h(App), document.getElementById("root"));
