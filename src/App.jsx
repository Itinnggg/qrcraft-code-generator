import { useState, useRef, useEffect, useCallback } from "react";

// ── QR generation via qrcode-generator (loaded from CDN via useEffect) ──────
// We draw everything on a <canvas> manually so we can composite the logo.

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

/* ── tiny helpers ── */
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

/* ── draw QR + logo onto canvas ── */
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
        ctx.fillRect(
          Math.floor(c * cell),
          Math.floor(r * cell),
          Math.ceil(cell),
          Math.ceil(cell)
        );
      }
    }
  }

  if (logoImg) {
    const logoSize = size * 0.22;
    const pad = logoSize * 0.15;
    const x = (size - logoSize) / 2;
    const y = (size - logoSize) / 2;
    // white badge
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, 8);
    ctx.fill();
    ctx.drawImage(logoImg, x, y, logoSize, logoSize);
  }
}

/* ══════════════════════════════════════════════════════════════════ */
export default function QRcraft() {
  const [tab, setTab] = useState("url");
  const [fields, setFields] = useState({
    url: "",
    phone: "",
    message: "",
    ssid: "",
    password: "",
    encryption: "WPA",
  });
  const [fgColor, setFgColor] = useState("#0F0A1E");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [size, setSize] = useState(256);
  const [logoImg, setLogoImg] = useState(null);
  const [logoName, setLogoName] = useState("");
  const [qrData, setQrData] = useState(null);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [libLoaded, setLibLoaded] = useState(false);

  const canvasRef = useRef(null);
  const logoInputRef = useRef(null);

  // Load qrcode-generator lib from CDN
  useEffect(() => {
    if (window.qrcode) { setLibLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    s.onload = () => setLibLoaded(true);
    document.head.appendChild(s);

    // Also load qrcode-generator for raw data
    const s2 = document.createElement("script");
    s2.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
    s2.onload = () => setLibLoaded(true);
    document.head.appendChild(s2);
  }, []);

  // Re-render canvas whenever relevant state changes
  useEffect(() => {
    if (generated && qrData && canvasRef.current) {
      renderToCanvas(canvasRef.current, qrData, size, fgColor, bgColor, logoImg);
    }
  }, [generated, qrData, size, fgColor, bgColor, logoImg]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleField = (key, val) => {
    setFields((f) => ({ ...f, [key]: val }));
    setGenerated(false);
  };

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

  const removeLogo = () => {
    setLogoImg(null);
    setLogoName("");
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const generate = useCallback(() => {
    setError("");
    const text = buildQRText(tab, fields);
    if (!text) {
      setError(
        tab === "url" ? "Masukkan URL terlebih dahulu."
        : tab === "whatsapp" ? "Masukkan nomor WhatsApp."
        : "Masukkan nama WiFi (SSID)."
      );
      return;
    }

    try {
      // Use qrcode-generator lib
      const qr = window.qrcode(0, "H");
      qr.addData(text);
      qr.make();
      setQrData(qr);
      setGenerated(true);
    } catch {
      setError("Gagal generate QR. Coba persingkat teksnya.");
    }
  }, [tab, fields]);

  const download = () => {
    if (!canvasRef.current) return;
    // Render larger for download
    const dlCanvas = document.createElement("canvas");
    const dlSize = Math.max(size, 400);
    renderToCanvas(dlCanvas, qrData, dlSize, fgColor, bgColor, logoImg);

    const link = document.createElement("a");
    link.download = `qrcraft-${tab}.png`;
    link.href = dlCanvas.toDataURL("image/png");
    link.click();
    showToast("✅ QR Code berhasil didownload!");
  };

  // ── Styles (inline for single-file React) ──────────────────────
  const s = styles;

  return (
    <div style={s.root}>
      {/* Ambient blobs */}
      <div style={s.blob1} />
      <div style={s.blob2} />
      <div style={s.blob3} />

      {/* Toast */}
      {toast && <div style={s.toast}>{toast}</div>}

      {/* Header */}
      <header style={s.header}>
        <div style={s.logoRow}>
          <span style={s.logoDot} />
          <span style={s.logoText}>Tingcraft</span>
          <span style={s.logoDot} />
        </div>
        <h1 style={s.h1}>
          Buat <span style={s.grad}>QR Code</span>
          <br />dalam detik
        </h1>
        <p style={s.tagline}>URL · WhatsApp · WiFi — dengan logo, warna, dan download langsung.</p>
      </header>

      {/* Main layout */}
      <div style={s.layout}>
        {/* ── LEFT: Controls ── */}
        <div style={s.card}>
          {/* Tab switcher */}
          <div style={s.tabBar}>
            {TABS.map((t) => (
              <button
                key={t.id}
                style={{ ...s.tabBtn, ...(tab === t.id ? s.tabActive : {}) }}
                onClick={() => { setTab(t.id); setGenerated(false); setError(""); }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div style={s.fields}>
            {tab === "url" && (
              <Field label="URL / Link">
                <Input
                  type="url"
                  placeholder="https://contoh.com"
                  value={fields.url}
                  onChange={(v) => handleField("url", v)}
                  icon="🔗"
                />
              </Field>
            )}

            {tab === "whatsapp" && (
              <>
                <Field label="Nomor WhatsApp">
                  <Input
                    type="tel"
                    placeholder="628123456789 (sertakan kode negara)"
                    value={fields.phone}
                    onChange={(v) => handleField("phone", v)}
                    icon="📱"
                  />
                </Field>
                <Field label="Pesan (opsional)">
                  <textarea
                    placeholder="Halo, saya ingin bertanya..."
                    value={fields.message}
                    onChange={(e) => handleField("message", e.target.value)}
                    style={s.textarea}
                    rows={3}
                  />
                </Field>
              </>
            )}

            {tab === "wifi" && (
              <>
                <Field label="Nama WiFi (SSID)">
                  <Input
                    placeholder="NamaWiFiKamu"
                    value={fields.ssid}
                    onChange={(v) => handleField("ssid", v)}
                    icon="📶"
                  />
                </Field>
                <Field label="Password WiFi">
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={fields.password}
                    onChange={(v) => handleField("password", v)}
                    icon="🔒"
                  />
                </Field>
                <Field label="Enkripsi">
                  <div style={s.encRow}>
                    {["WPA", "WEP", "nopass"].map((enc) => (
                      <button
                        key={enc}
                        style={{ ...s.encBtn, ...(fields.encryption === enc ? s.encActive : {}) }}
                        onClick={() => handleField("encryption", enc)}
                      >
                        {enc}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}
          </div>

          <Divider />

          {/* Logo Upload */}
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
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleLogoUpload}
                />
              </div>
            )}
          </Field>

          <Divider />

          {/* Colors */}
          <div style={s.colorRow}>
            <Field label="Warna QR">
              <div style={s.swatches}>
                {FG_COLORS.map((c) => (
                  <div
                    key={c.hex}
                    title={c.name}
                    style={{
                      ...s.swatch,
                      background: c.hex,
                      outline: fgColor === c.hex ? "2px solid white" : "2px solid transparent",
                      outlineOffset: 2,
                    }}
                    onClick={() => setFgColor(c.hex)}
                  />
                ))}
              </div>
            </Field>
            <Field label="Background">
              <div style={s.swatches}>
                {BG_COLORS.map((c) => (
                  <div
                    key={c.hex}
                    title={c.name}
                    style={{
                      ...s.swatch,
                      background: c.hex,
                      border: "1px solid rgba(255,255,255,0.15)",
                      outline: bgColor === c.hex ? "2px solid #7C3AED" : "2px solid transparent",
                      outlineOffset: 2,
                    }}
                    onClick={() => setBgColor(c.hex)}
                  />
                ))}
              </div>
            </Field>
          </div>

          <Divider />

          {/* Size */}
          <Field label={`Ukuran: ${size}px`}>
            <div style={s.sizeRow}>
              {SIZES.map((sz) => (
                <button
                  key={sz}
                  style={{ ...s.sizeBtn, ...(size === sz ? s.sizeBtnActive : {}) }}
                  onClick={() => setSize(sz)}
                >
                  {sz}
                </button>
              ))}
            </div>
          </Field>

          <Divider />

          {/* Error */}
          {error && <div style={s.errorMsg}>⚠️ {error}</div>}

          {/* Generate button */}
          <button style={s.genBtn} onClick={generate}>
            ⚡ Generate QR Code
          </button>
        </div>

        {/* ── RIGHT: Preview ── */}
        <div style={s.previewCol}>
          <div style={s.previewCard}>
            {generated ? (
              <>
                <div style={s.canvasFrame}>
                  <canvas ref={canvasRef} style={{ display: "block", borderRadius: 8 }} />
                </div>
                <p style={s.previewLabel}>
                  {tab === "url" && (fields.url.length > 40 ? fields.url.slice(0, 38) + "…" : fields.url)}
                  {tab === "whatsapp" && `wa.me/${fields.phone}`}
                  {tab === "wifi" && `WiFi: ${fields.ssid}`}
                </p>
                <button style={s.dlBtn} onClick={download}>
                  ⬇️ Download PNG
                </button>
              </>
            ) : (
              <div style={s.emptyState}>
                <div style={s.emptyIcon}>◻️</div>
                <p style={s.emptyText}>QR Code kamu muncul di sini</p>
                <p style={s.emptyHint}>Isi form di sebelah kiri, lalu klik Generate.</p>
              </div>
            )}
          </div>

          {/* Tips */}
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

      <footer style={s.footer}>
        QRcraft — gratis, tanpa iklan, tanpa simpan data.
      </footer>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */
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
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...styles.input, paddingLeft: icon ? 40 : 16 }}
      />
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(124,58,237,0.2)", margin: "4px 0" }} />;
}

/* ── Style tokens ───────────────────────────────────────────────── */
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
  blob1: {
    position: "fixed", top: -150, left: -150,
    width: 500, height: 500, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0, overflow: "hidden",
  },
  blob2: {
    position: "fixed", bottom: -120, right: 0,
    width: 420, height: 420, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0,
  },
  blob3: {
    position: "fixed", top: "40%", left: "50%",
    width: 300, height: 300, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(132,204,22,0.06) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0, transform: "translate(-50%,-50%)",
  },
  toast: {
    position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
    background: "#10B981", color: "white",
    padding: "12px 24px", borderRadius: 12,
    fontWeight: 600, fontSize: 14, zIndex: 999,
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  },
  header: {
    textAlign: "center", marginBottom: 48, position: "relative", zIndex: 1,
  },
  logoRow: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, marginBottom: 16,
  },
  logoDot: {
    width: 6, height: 6, borderRadius: "50%",
    background: "linear-gradient(135deg, #7C3AED, #06B6D4)",
    display: "inline-block",
  },
  logoText: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 12, fontWeight: 600,
    letterSpacing: "0.18em", textTransform: "uppercase",
    color: "#9B8EC4",
  },
  h1: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "clamp(32px, 5vw, 56px)",
    fontWeight: 700, lineHeight: 1.05,
    letterSpacing: "-0.02em",
  },
  grad: {
    background: "linear-gradient(90deg, #A78BFA, #06B6D4, #84CC16)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  tagline: {
    marginTop: 12, fontSize: 15, color: "#9B8EC4",
  },
  layout: {
    display: "flex", gap: 24, width: "100%", maxWidth: "100%",
    position: "relative", zIndex: 1, flexWrap: "wrap",
    justifyContent: "center",
  },
  card: {
    background: "#1A1235",
    border: "1px solid rgba(124,58,237,0.25)",
    borderRadius: 24, padding: 32,
    display: "flex", flexDirection: "column", gap: 20,
    flex: "1 1 380px", minWidth: 300, maxWidth: 480,
  },
  tabBar: {
    display: "flex", gap: 8,
    background: "#0F0A1E",
    padding: 4, borderRadius: 14,
  },
  tabBtn: {
    flex: 1, padding: "10px 8px",
    border: "none", borderRadius: 10,
    background: "transparent", color: "#9B8EC4",
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 600, fontSize: 13, cursor: "pointer",
    transition: "all 0.2s",
  },
  tabActive: {
    background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
    color: "white",
    boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
  },
  fields: {
    display: "flex", flexDirection: "column", gap: 16,
  },
  fieldLabel: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 11, fontWeight: 600,
    letterSpacing: "0.1em", textTransform: "uppercase",
    color: "#9B8EC4",
  },
  inputIcon: {
    position: "absolute", left: 12, top: "50%",
    transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none",
  },
  input: {
    width: "100%", background: "#241A44",
    border: "1px solid rgba(124,58,237,0.25)",
    borderRadius: 12, padding: "14px 14px",
    fontFamily: "Inter, sans-serif", fontSize: 14,
    color: "#F1F0F8", outline: "none",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%", background: "#241A44",
    border: "1px solid rgba(124,58,237,0.25)",
    borderRadius: 12, padding: "14px",
    fontFamily: "Inter, sans-serif", fontSize: 14,
    color: "#F1F0F8", outline: "none", resize: "vertical",
    boxSizing: "border-box",
  },
  encRow: { display: "flex", gap: 8 },
  encBtn: {
    padding: "8px 16px", borderRadius: 8,
    border: "1px solid rgba(124,58,237,0.3)",
    background: "#241A44", color: "#9B8EC4",
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 600, fontSize: 13, cursor: "pointer",
  },
  encActive: {
    background: "rgba(124,58,237,0.3)",
    color: "#A78BFA",
    borderColor: "#7C3AED",
  },
  uploadZone: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 6, padding: "24px 16px",
    border: "2px dashed rgba(124,58,237,0.35)",
    borderRadius: 14, cursor: "pointer",
    transition: "border-color 0.2s",
  },
  uploadText: { fontSize: 14, color: "#F1F0F8", fontWeight: 500 },
  uploadHint: { fontSize: 12, color: "#9B8EC4" },
  logoPreviewRow: {
    display: "flex", alignItems: "center", gap: 12,
    background: "#241A44", borderRadius: 12, padding: "10px 14px",
  },
  logoThumb: { width: 36, height: 36, objectFit: "contain", borderRadius: 6 },
  logoFileName: { fontSize: 13, color: "#F1F0F8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  removeBtn: {
    background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)",
    color: "#F43F5E", borderRadius: 8, padding: "6px 10px",
    fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
  colorRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  swatches: { display: "flex", gap: 8, flexWrap: "wrap" },
  swatch: {
    width: 28, height: 28, borderRadius: 8, cursor: "pointer",
    transition: "transform 0.15s", flexShrink: 0,
  },
  sizeRow: { display: "flex", gap: 8 },
  sizeBtn: {
    flex: 1, padding: "8px 4px",
    border: "1px solid rgba(124,58,237,0.3)",
    background: "#241A44", color: "#9B8EC4",
    borderRadius: 8, fontSize: 12, fontWeight: 600,
    fontFamily: "'Space Grotesk', sans-serif", cursor: "pointer",
  },
  sizeBtnActive: {
    background: "rgba(6,182,212,0.2)",
    color: "#06B6D4", borderColor: "#06B6D4",
  },
  errorMsg: {
    background: "rgba(244,63,94,0.1)",
    border: "1px solid rgba(244,63,94,0.3)",
    color: "#F43F5E", borderRadius: 10,
    padding: "10px 14px", fontSize: 13,
  },
  genBtn: {
    width: "100%", padding: 16,
    border: "none", borderRadius: 14,
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 16, fontWeight: 700,
    cursor: "pointer",
    background: "linear-gradient(135deg, #7C3AED, #4F46E5, #06B6D4)",
    color: "white",
    boxShadow: "0 4px 24px rgba(124,58,237,0.4)",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  previewCol: {
    display: "flex", flexDirection: "column", gap: 16,
    flex: "1 1 300px", maxWidth: 380,
  },
  previewCard: {
    background: "#1A1235",
    border: "1px solid rgba(124,58,237,0.25)",
    borderRadius: 24, padding: 28,
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: 20,
    minHeight: 320,
  },
  canvasFrame: {
    padding: 16, borderRadius: 16, background: "white",
    boxShadow: "0 0 0 3px rgba(124,58,237,0.4), 0 16px 48px rgba(0,0,0,0.4)",
  },
  previewLabel: {
    fontSize: 12, color: "#9B8EC4",
    textAlign: "center", wordBreak: "break-all", maxWidth: 220,
  },
  dlBtn: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "12px 24px", borderRadius: 12,
    border: "1px solid rgba(132,204,22,0.4)",
    background: "rgba(132,204,22,0.1)", color: "#84CC16",
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 14, fontWeight: 600, cursor: "pointer",
    transition: "background 0.2s",
  },
  emptyState: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 12, padding: "40px 0",
  },
  emptyIcon: { fontSize: 48, opacity: 0.3 },
  emptyText: { fontSize: 15, color: "#9B8EC4", fontWeight: 500 },
  emptyHint: { fontSize: 13, color: "#6B5EA8", textAlign: "center" },
  tipsCard: {
    background: "#1A1235",
    border: "1px solid rgba(124,58,237,0.15)",
    borderRadius: 16, padding: 20,
  },
  tipsTitle: { fontWeight: 600, fontSize: 13, marginBottom: 10, color: "#A78BFA" },
  tipsList: {
    paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6,
    fontSize: 12, color: "#9B8EC4", lineHeight: 1.6,
  },
  footer: {
    marginTop: 48, fontSize: 13, color: "#6B5EA8",
    textAlign: "center", position: "relative", zIndex: 1,
  },
};