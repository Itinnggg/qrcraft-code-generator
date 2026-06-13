import { useState, useRef, useEffect, useCallback } from "react";

const TABS = [
  { id: "url", label: "URL", icon: "🔗" },
  { id: "whatsapp", label: "WhatsApp", icon: "💬" },
  { id: "wifi", label: "WiFi", icon: "📶" },
];

const FG_COLORS = [
  { hex: "#0F0A1E", name: "Midnight" },
  { hex: "#7C3AED", name: "Violet" },
  { hex: "#06B6D4", name: "Cyan" },
  { hex: "#F43F5E", name: "Rose" },
  { hex: "#F59E0B", name: "Amber" },
  { hex: "#10B981", name: "Emerald" },
];

const BG_COLORS = [
  { hex: "#FFFFFF", name: "White" },
  { hex: "#F8F4FF", name: "Lavender" },
  { hex: "#ECFDF5", name: "Mint" },
  { hex: "#FFF7ED", name: "Cream" },
];

const SIZES = [160, 200, 256, 320, 400];

function buildQRText(tab, fields) {
  if (tab === "url") return fields.url || "";
  if (tab === "whatsapp") {
    const num = (fields.phone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(fields.message || "");
    return num ? `https://wa.me/${num}${msg ? "?text=" + msg : ""}` : "";
  }
  if (tab === "wifi") {
    const s = fields.ssid || "";
    const p = fields.password || "";
    const t = fields.encryption || "WPA";
    return s ? `WIFI:T:${t};S:${s};P:${p};;` : "";
  }
  return "";
}

function renderToCanvas(canvas, qrData, size, fgColor, bgColor, logoImg) {
  if (!canvas || !qrData) return;
  const ctx = canvas.getContext("2d");
  const cellCount = qrData.getModuleCount();
  const cell = size / cellCount;
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);
  for (let r = 0; r < cellCount; r++) {
    for (let c = 0; c < cellCount; c++) {
      if (qrData.isDark(r, c)) {
        ctx.fillStyle = fgColor;
        ctx.fillRect(Math.floor(c * cell), Math.floor(r * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
  if (logoImg) {
    const logoSize = size * 0.22;
    const pad = logoSize * 0.15;
    const x = (size - logoSize) / 2;
    const y = (size - logoSize) / 2;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, 8);
    ctx.fill();
    ctx.drawImage(logoImg, x, y, logoSize, logoSize);
  }
}

function renderToDataURL(qrData, size, fgColor, bgColor, logoImg) {
  const c = document.createElement("canvas");
  renderToCanvas(c, qrData, size, fgColor, bgColor, logoImg);
  return c.toDataURL("image/png");
}

export default function QRcraft() {
  const [tab, setTab] = useState("url");
  const [fields, setFields] = useState({ url: "", phone: "", message: "", ssid: "", password: "", encryption: "WPA" });
  const [fgColor, setFgColor] = useState("#0F0A1E");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [size, setSize] = useState(256);
  const [logoImg, setLogoImg] = useState(null);
  const [logoName, setLogoName] = useState("");
  const [qrData, setQrData] = useState(null);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("qrcraft_history") || "[]"); } catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);

  const canvasRef = useRef(null);
  const logoInputRef = useRef(null);

  useEffect(() => {
    if (window.qrcode) return;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (generated && qrData && canvasRef.current) {
      renderToCanvas(canvasRef.current, qrData, size, fgColor, bgColor, logoImg);
    }
  }, [generated, qrData, size, fgColor, bgColor, logoImg]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const handleField = (key, val) => { setFields((f) => ({ ...f, [key]: val })); setGenerated(false); };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => setLogoImg(img);
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => { setLogoImg(null); setLogoName(""); if (logoInputRef.current) logoInputRef.current.value = ""; };

  const generate = useCallback(() => {
    setError("");
    const text = buildQRText(tab, fields);
    if (!text) {
      setError(tab === "url" ? "Masukkan URL terlebih dahulu." : tab === "whatsapp" ? "Masukkan nomor WhatsApp." : "Masukkan nama WiFi (SSID).");
      return;
    }
    try {
      const qr = window.qrcode(0, "H");
      qr.addData(text);
      qr.make();
      setQrData(qr);
      setGenerated(true);

      // Save to history
      const dataUrl = renderToDataURL(qr, 256, fgColor, bgColor, logoImg);
      const label = tab === "url" ? fields.url : tab === "whatsapp" ? `wa.me/${fields.phone}` : `WiFi: ${fields.ssid}`;
      const entry = {
        id: Date.now(),
        tab,
        label: label.length > 50 ? label.slice(0, 48) + "…" : label,
        dataUrl,
        fgColor,
        bgColor,
        createdAt: new Date().toLocaleString("id-ID"),
      };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 20); // max 20
        localStorage.setItem("qrcraft_history", JSON.stringify(next));
        return next;
      });
      showToast("✅ QR Code berhasil dibuat!");
    } catch {
      setError("Gagal generate QR. Coba persingkat teksnya.");
    }
  }, [tab, fields, fgColor, bgColor, logoImg]);

  const download = () => {
    if (!canvasRef.current) return;
    const dlCanvas = document.createElement("canvas");
    renderToCanvas(dlCanvas, qrData, Math.max(size, 400), fgColor, bgColor, logoImg);
    const link = document.createElement("a");
    link.download = `qrcraft-${tab}.png`;
    link.href = dlCanvas.toDataURL("image/png");
    link.click();
    showToast("⬇️ QR Code didownload!");
  };

  const downloadFromHistory = (item) => {
    const link = document.createElement("a");
    link.download = `qrcraft-history-${item.id}.png`;
    link.href = item.dataUrl;
    link.click();
  };

  const deleteHistory = (id) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      localStorage.setItem("qrcraft_history", JSON.stringify(next));
      return next;
    });
  };

  const clearAllHistory = () => {
    setHistory([]);
    localStorage.removeItem("qrcraft_history");
    showToast("🗑️ History dihapus semua.");
  };

  const s = styles;

  return (
    <div style={s.root}>
      <div style={s.blob1} />
      <div style={s.blob2} />
      <div style={s.blob3} />

      {toast && <div style={s.toast}>{toast}</div>}

      {/* Header */}
      <header style={s.header}>
        <div style={s.logoRow}>
          <span style={s.logoDot} />
          <span style={s.logoText}>Tingcraft</span>
          <span style={s.logoDot} />
        </div>
        <h1 style={s.h1}>Buat <span style={s.grad}>QR Code</span><br />dalam detik</h1>
        <p style={s.tagline}>URL · WhatsApp · WiFi — dengan logo, warna, dan download langsung.</p>
      </header>

      {/* Main layout */}
      <div style={s.layout}>

        {/* LEFT: Controls */}
        <div style={s.card}>
          <div style={s.tabBar}>
            {TABS.map((t) => (
              <button key={t.id} style={{ ...s.tabBtn, ...(tab === t.id ? s.tabActive : {}) }}
                onClick={() => { setTab(t.id); setGenerated(false); setError(""); }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div style={s.fields}>
            {tab === "url" && (
              <Field label="URL / Link">
                <Input type="url" placeholder="https://contoh.com" value={fields.url} onChange={(v) => handleField("url", v)} icon="🔗" />
              </Field>
            )}
            {tab === "whatsapp" && (<>
              <Field label="Nomor WhatsApp">
                <Input type="tel" placeholder="628123456789 (sertakan kode negara)" value={fields.phone} onChange={(v) => handleField("phone", v)} icon="📱" />
              </Field>
              <Field label="Pesan (opsional)">
                <textarea placeholder="Halo, saya ingin bertanya..." value={fields.message} onChange={(e) => handleField("message", e.target.value)} style={s.textarea} rows={3} />
              </Field>
            </>)}
            {tab === "wifi" && (<>
              <Field label="Nama WiFi (SSID)">
                <Input placeholder="NamaWiFiKamu" value={fields.ssid} onChange={(v) => handleField("ssid", v)} icon="📶" />
              </Field>
              <Field label="Password WiFi">
                <Input type="password" placeholder="••••••••" value={fields.password} onChange={(v) => handleField("password", v)} icon="🔒" />
              </Field>
              <Field label="Enkripsi">
                <div style={s.encRow}>
                  {["WPA", "WEP", "nopass"].map((enc) => (
                    <button key={enc} style={{ ...s.encBtn, ...(fields.encryption === enc ? s.encActive : {}) }} onClick={() => handleField("encryption", enc)}>{enc}</button>
                  ))}
                </div>
              </Field>
            </>)}
          </div>

          <Divider />

          <Field label="Logo di Tengah QR (opsional)">
            {logoImg ? (
              <div style={s.logoPreviewRow}>
                <img src={logoImg.src} alt="logo" style={s.logoThumb} />
                <span style={s.logoFileName}>{logoName}</span>
                <button style={s.removeBtn} onClick={removeLogo}>✕ Hapus</button>
              </div>
            ) : (
              <div style={s.uploadZone} onClick={() => logoInputRef.current?.click()}>
                <span style={{ fontSize: 24 }}>⬆️</span>
                <span style={s.uploadText}>Klik untuk upload logo</span>
                <span style={s.uploadHint}>PNG / JPG / SVG, maks 2MB</span>
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />
              </div>
            )}
          </Field>

          <Divider />

          <div style={s.colorRow}>
            <Field label="Warna QR">
              <div style={s.swatches}>
                {FG_COLORS.map((c) => (
                  <div key={c.hex} title={c.name} style={{ ...s.swatch, background: c.hex, outline: fgColor === c.hex ? "2px solid white" : "2px solid transparent", outlineOffset: 2 }} onClick={() => setFgColor(c.hex)} />
                ))}
              </div>
            </Field>
            <Field label="Background">
              <div style={s.swatches}>
                {BG_COLORS.map((c) => (
                  <div key={c.hex} title={c.name} style={{ ...s.swatch, background: c.hex, border: "1px solid rgba(255,255,255,0.15)", outline: bgColor === c.hex ? "2px solid #7C3AED" : "2px solid transparent", outlineOffset: 2 }} onClick={() => setBgColor(c.hex)} />
                ))}
              </div>
            </Field>
          </div>

          <Divider />

          <Field label={`Ukuran: ${size}px`}>
            <div style={s.sizeRow}>
              {SIZES.map((sz) => (
                <button key={sz} style={{ ...s.sizeBtn, ...(size === sz ? s.sizeBtnActive : {}) }} onClick={() => setSize(sz)}>{sz}</button>
              ))}
            </div>
          </Field>

          <Divider />

          {error && <div style={s.errorMsg}>⚠️ {error}</div>}

          <button style={s.genBtn} onClick={generate}>⚡ Generate QR Code</button>
        </div>

        {/* RIGHT: Preview */}
        <div style={s.previewCol}>
          <div style={s.previewCard}>
            {generated ? (<>
              <div style={s.canvasFrame}>
                <canvas ref={canvasRef} style={{ display: "block", borderRadius: 8 }} />
              </div>
              <p style={s.previewLabel}>
                {tab === "url" && (fields.url.length > 40 ? fields.url.slice(0, 38) + "…" : fields.url)}
                {tab === "whatsapp" && `wa.me/${fields.phone}`}
                {tab === "wifi" && `WiFi: ${fields.ssid}`}
              </p>
              <button style={s.dlBtn} onClick={download}>⬇️ Download PNG</button>
            </>) : (
              <div style={s.emptyState}>
                <div style={s.emptyIcon}>◻️</div>
                <p style={s.emptyText}>QR Code kamu muncul di sini</p>
                <p style={s.emptyHint}>Isi form di sebelah kiri, lalu klik Generate.</p>
              </div>
            )}
          </div>

          <div style={s.tipsCard}>
            <p style={s.tipsTitle}>💡 Tips</p>
            <ul style={s.tipsList}>
              <li>Gunakan logo berukuran kecil agar QR tetap bisa discan.</li>
              <li>Warna QR harus kontras dengan background-nya.</li>
              <li>Ukuran 256px+ disarankan untuk cetak.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── HISTORY SECTION ── */}
      <div style={s.historySection}>
        <div style={s.historyHeader}>
          <button style={s.historyToggle} onClick={() => setShowHistory((v) => !v)}>
            <span>🕓 History QR</span>
            <span style={{ ...s.historyBadge, display: history.length ? "inline-flex" : "none" }}>{history.length}</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#9B8EC4" }}>{showHistory ? "▲ Tutup" : "▼ Lihat"}</span>
          </button>
          {showHistory && history.length > 0 && (
            <button style={s.clearBtn} onClick={clearAllHistory}>🗑️ Hapus Semua</button>
          )}
        </div>

        {showHistory && (
          <div style={s.historyGrid}>
            {history.length === 0 ? (
              <div style={s.historyEmpty}>
                <p style={{ color: "#9B8EC4", fontSize: 14 }}>Belum ada QR yang dibuat. Generate QR pertamamu!</p>
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} style={s.historyItem}>
                  <div style={s.historyThumbWrap}>
                    <img src={item.dataUrl} alt="qr" style={s.historyThumb} />
                  </div>
                  <div style={s.historyInfo}>
                    <span style={s.historyTabBadge}>{item.tab.toUpperCase()}</span>
                    <p style={s.historyLabel}>{item.label}</p>
                    <p style={s.historyDate}>{item.createdAt}</p>
                  </div>
                  <div style={s.historyActions}>
                    <button style={s.historyDlBtn} onClick={() => downloadFromHistory(item)} title="Download">⬇️</button>
                    <button style={s.historyDelBtn} onClick={() => deleteHistory(item.id)} title="Hapus">✕</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <footer style={s.footer}>Tingcraft — gratis, tanpa iklan, tanpa simpan data ke server.</footer>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

function Input({ type = "text", placeholder, value, onChange, icon }) {
  return (
    <div style={{ position: "relative" }}>
      {icon && <span style={styles.inputIcon}>{icon}</span>}
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ ...styles.input, paddingLeft: icon ? 40 : 16 }} />
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(124,58,237,0.2)", margin: "4px 0" }} />;
}

const styles = {
  root: {
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    background: "#0F0A1E",
    minHeight: "100vh",
    width: "100%",
    color: "#F1F0F8",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "48px 40px",
    position: "relative",
    boxSizing: "border-box",
  },
  blob1: { position: "fixed", top: -150, left: -150, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 },
  blob2: { position: "fixed", bottom: -120, right: 0, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 },
  blob3: { position: "fixed", top: "40%", left: "50%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(132,204,22,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0, transform: "translate(-50%,-50%)" },
  toast: { position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", background: "#10B981", color: "white", padding: "12px 24px", borderRadius: 12, fontWeight: 600, fontSize: 14, zIndex: 999, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },
  header: { textAlign: "center", marginBottom: 48, position: "relative", zIndex: 1 },
  logoRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 },
  logoDot: { width: 6, height: 6, borderRadius: "50%", background: "linear-gradient(135deg, #7C3AED, #06B6D4)", display: "inline-block" },
  logoText: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9B8EC4" },
  h1: { fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em" },
  grad: { background: "linear-gradient(90deg, #A78BFA, #06B6D4, #84CC16)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" },
  tagline: { marginTop: 12, fontSize: 15, color: "#9B8EC4" },
  layout: { display: "flex", gap: 24, width: "100%", maxWidth: "100%", position: "relative", zIndex: 1, flexWrap: "wrap", justifyContent: "center" },
  card: { background: "#1A1235", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 24, padding: 32, display: "flex", flexDirection: "column", gap: 20, flex: "1 1 380px", minWidth: 300, maxWidth: 480 },
  tabBar: { display: "flex", gap: 8, background: "#0F0A1E", padding: 4, borderRadius: 14 },
  tabBtn: { flex: 1, padding: "10px 8px", border: "none", borderRadius: 10, background: "transparent", color: "#9B8EC4", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  tabActive: { background: "linear-gradient(135deg, #7C3AED, #4F46E5)", color: "white", boxShadow: "0 4px 16px rgba(124,58,237,0.4)" },
  fields: { display: "flex", flexDirection: "column", gap: 16 },
  fieldLabel: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B8EC4" },
  inputIcon: { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" },
  input: { width: "100%", background: "#241A44", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 12, padding: "14px 14px", fontFamily: "Inter, sans-serif", fontSize: 14, color: "#F1F0F8", outline: "none", boxSizing: "border-box" },
  textarea: { width: "100%", background: "#241A44", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 12, padding: "14px", fontFamily: "Inter, sans-serif", fontSize: 14, color: "#F1F0F8", outline: "none", resize: "vertical", boxSizing: "border-box" },
  encRow: { display: "flex", gap: 8 },
  encBtn: { padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(124,58,237,0.3)", background: "#241A44", color: "#9B8EC4", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  encActive: { background: "rgba(124,58,237,0.3)", color: "#A78BFA", borderColor: "#7C3AED" },
  uploadZone: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "24px 16px", border: "2px dashed rgba(124,58,237,0.35)", borderRadius: 14, cursor: "pointer" },
  uploadText: { fontSize: 14, color: "#F1F0F8", fontWeight: 500 },
  uploadHint: { fontSize: 12, color: "#9B8EC4" },
  logoPreviewRow: { display: "flex", alignItems: "center", gap: 12, background: "#241A44", borderRadius: 12, padding: "10px 14px" },
  logoThumb: { width: 36, height: 36, objectFit: "contain", borderRadius: 6 },
  logoFileName: { fontSize: 13, color: "#F1F0F8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  removeBtn: { background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)", color: "#F43F5E", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  colorRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  swatches: { display: "flex", gap: 8, flexWrap: "wrap" },
  swatch: { width: 28, height: 28, borderRadius: 8, cursor: "pointer", transition: "transform 0.15s", flexShrink: 0 },
  sizeRow: { display: "flex", gap: 8 },
  sizeBtn: { flex: 1, padding: "8px 4px", border: "1px solid rgba(124,58,237,0.3)", background: "#241A44", color: "#9B8EC4", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", cursor: "pointer" },
  sizeBtnActive: { background: "rgba(6,182,212,0.2)", color: "#06B6D4", borderColor: "#06B6D4" },
  errorMsg: { background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", color: "#F43F5E", borderRadius: 10, padding: "10px 14px", fontSize: 13 },
  genBtn: { width: "100%", padding: 16, border: "none", borderRadius: 14, fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg, #7C3AED, #4F46E5, #06B6D4)", color: "white", boxShadow: "0 4px 24px rgba(124,58,237,0.4)" },
  previewCol: { display: "flex", flexDirection: "column", gap: 16, flex: "1 1 300px", maxWidth: 380 },
  previewCard: { background: "#1A1235", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 24, padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, minHeight: 320 },
  canvasFrame: { padding: 16, borderRadius: 16, background: "white", boxShadow: "0 0 0 3px rgba(124,58,237,0.4), 0 16px 48px rgba(0,0,0,0.4)" },
  previewLabel: { fontSize: 12, color: "#9B8EC4", textAlign: "center", wordBreak: "break-all", maxWidth: 220 },
  dlBtn: { display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 12, border: "1px solid rgba(132,204,22,0.4)", background: "rgba(132,204,22,0.1)", color: "#84CC16", fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 0" },
  emptyIcon: { fontSize: 48, opacity: 0.3 },
  emptyText: { fontSize: 15, color: "#9B8EC4", fontWeight: 500 },
  emptyHint: { fontSize: 13, color: "#6B5EA8", textAlign: "center" },
  tipsCard: { background: "#1A1235", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 16, padding: 20 },
  tipsTitle: { fontWeight: 600, fontSize: 13, marginBottom: 10, color: "#A78BFA" },
  tipsList: { paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#9B8EC4", lineHeight: 1.6 },

  // History styles
  historySection: { width: "100%", maxWidth: "100%", marginTop: 40, position: "relative", zIndex: 1 },
  historyHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  historyToggle: { display: "flex", alignItems: "center", gap: 10, flex: 1, background: "#1A1235", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 14, padding: "14px 20px", color: "#F1F0F8", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15, cursor: "pointer" },
  historyBadge: { background: "linear-gradient(135deg, #7C3AED, #06B6D4)", color: "white", borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 700, alignItems: "center", justifyContent: "center" },
  clearBtn: { background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", color: "#F43F5E", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  historyGrid: { display: "flex", flexDirection: "column", gap: 10 },
  historyEmpty: { background: "#1A1235", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 14, padding: 32, textAlign: "center" },
  historyItem: { background: "#1A1235", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 },
  historyThumbWrap: { background: "white", borderRadius: 8, padding: 4, flexShrink: 0 },
  historyThumb: { width: 56, height: 56, display: "block" },
  historyInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 4, overflow: "hidden" },
  historyTabBadge: { fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#A78BFA", background: "rgba(124,58,237,0.15)", borderRadius: 4, padding: "2px 6px", alignSelf: "flex-start" },
  historyLabel: { fontSize: 14, color: "#F1F0F8", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  historyDate: { fontSize: 11, color: "#6B5EA8" },
  historyActions: { display: "flex", gap: 8, flexShrink: 0 },
  historyDlBtn: { background: "rgba(132,204,22,0.1)", border: "1px solid rgba(132,204,22,0.3)", color: "#84CC16", borderRadius: 8, padding: "8px 12px", fontSize: 14, cursor: "pointer" },
  historyDelBtn: { background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", color: "#F43F5E", borderRadius: 8, padding: "8px 12px", fontSize: 14, cursor: "pointer" },
  footer: { marginTop: 48, fontSize: 13, color: "#6B5EA8", textAlign: "center", position: "relative", zIndex: 1 },
};