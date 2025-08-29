
/*!
 * QR Card Generator Widget
 * Minimal embeddable widget that mounts with: window.QRCard.mount(el, options)
 * - Generates vCard text (vCard 4.0) and a QR preview
 * - Downloads: PNG, SVG, VCF
 * - Submits data to backend: POST /api/qr-cards
 * 
 * NOTE: This widget lazy-loads a tiny QR library from CDN if not present (window.QRCode).
 * CDN used: https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js
 * You may self-host this file later and inline the library if desired.
 */
(function(){
  const DEFAULTS = {
    apiBase: "", // e.g., "http://localhost:3000"
    brandName: "QR Card",
    primaryColor: "#0F766E",
    accentColor: "#334155",
    logoUrl: "",
    theme: "auto", // "light" | "dark" | "auto"
    consentText: "I agree to the storage of my information per the Privacy Policy.",
  };

  function loadScriptOnce(src){
    return new Promise((resolve, reject)=>{
      if (window.QRCode) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = ()=> resolve();
      s.onerror = ()=> reject(new Error("Failed to load QR library"));
      document.head.appendChild(s);
    });
  }

  function toE164(phone){
    if (!phone) return "";
    // simple sanitize: strip non-digits, assume US if 10 digits
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return "+1" + digits;
    if (digits.startsWith("00")) return "+" + digits.slice(2);
    if (digits.startsWith("1") && digits.length === 11) return "+" + digits;
    if (digits.startsWith("+")) return digits;
    // fallback as-is with plus
    return "+" + digits;
  }

  function escapeVCardText(s){
    return (s||"")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function buildVCard(data){
    // vCard 4.0 minimal
    const first = data.firstName || "";
    const last = data.lastName || "";
    const org = data.company || "";
    const title = data.title || "";
    const email = data.email || "";
    const mobile = toE164(data.mobile || "");
    const phone = toE164(data.workPhone || "");
    const url = data.website || "";
    const adr = data.address || {};
    const street = adr.street || "", city = adr.city||"", region=adr.state||"", code=adr.postal||"", country=adr.country||"";
    const note = data.notes || "";

    const lines = [
      "BEGIN:VCARD",
      "VERSION:4.0",
      `N:${escapeVCardText(last)};${escapeVCardText(first)};;;`,
      `FN:${escapeVCardText(first + " " + last).trim()}`,
      org ? `ORG:${escapeVCardText(org)}` : "",
      title ? `TITLE:${escapeVCardText(title)}` : "",
      email ? `EMAIL;TYPE=work:${escapeVCardText(email)}` : "",
      mobile ? `TEL;TYPE=cell,voice:${escapeVCardText(mobile)}` : "",
      phone ? `TEL;TYPE=work,voice:${escapeVCardText(phone)}` : "",
      url ? `URL:${escapeVCardText(url)}` : "",
      (street || city || region || code || country) ? `ADR;TYPE=work:;;${escapeVCardText(street)};${escapeVCardText(city)};${escapeVCardText(region)};${escapeVCardText(code)};${escapeVCardText(country)}` : "",
      note ? `NOTE:${escapeVCardText(note)}` : "",
      "END:VCARD"
    ].filter(Boolean);
    return lines.join("\r\n");
  }

  // Create a blob download link
  function triggerDownload(filename, mime, content){
    const blob = new Blob([content], {type: mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  // Convert canvas to PNG download
  function downloadCanvasAsPNG(canvas, filename){
    canvas.toBlob((blob)=>{
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{
        URL.revokeObjectURL(url);
        a.remove();
      }, 0);
    });
  }

  function styleTemplate(colors, theme){
    return `
      :host, .qr-card {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Ubuntu, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
        color: ${theme==="dark" ? "#e5e7eb" : "#111827"};
      }
      .qr-card {
        border: 1px solid ${theme==="dark" ? "#334155" : "#e5e7eb"};
        border-radius: 12px;
        padding: 16px;
        background: ${theme==="dark" ? "#0b1220" : "#ffffff"};
        max-width: 720px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.06);
      }
      .header {
        display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
      }
      .logo { width: 28px; height: 28px; object-fit: contain; }
      .title { font-size: 18px; font-weight: 700; color: ${colors.primary}; }
      .subtitle { font-size: 12px; color: ${theme==="dark" ? "#94a3b8" : "#6b7280"} }
      form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      form .full { grid-column: 1 / -1; }
      label { font-size: 12px; display: block; margin-bottom: 4px; }
      input, textarea, select {
        width: 100%; padding: 8px 10px; border: 1px solid ${theme==="dark" ? "#334155" : "#cbd5e1"};
        border-radius: 8px; background: ${theme==="dark" ? "#0f172a" : "#fff"}; color: inherit;
      }
      .consent { display: flex; align-items: start; gap: 8px; font-size: 12px; grid-column: 1 / -1; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      button {
        border: none; padding: 10px 14px; border-radius: 8px; cursor: pointer; font-weight: 600;
        background: ${colors.primary}; color: #fff;
      }
      button.secondary { background: ${colors.accent}; }
      .preview { display: grid; grid-template-columns: 1fr auto; gap: 16px; margin-top: 12px; align-items: start; }
      .qrbox { border: 1px dashed ${theme==="dark" ? "#334155" : "#cbd5e1"}; border-radius: 8px; padding: 10px; width: 196px; height: 196px; display:flex; align-items:center; justify-content:center; background: ${theme==="dark" ? "#0f172a" : "#fff"}; }
      .help { font-size: 12px; color: ${theme==="dark" ? "#94a3b8" : "#6b7280"}}
      @media (max-width: 720px) {
        form { grid-template-columns: 1fr; }
        .preview { grid-template-columns: 1fr; }
      }
    `;
  }

  async function ensureQR(){
    if (!window.QRCode) {
      await loadScriptOnce("https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js");
    }
  }

  function makeElement(html){
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }

  function mountedUI(shadow, opts){
    const theme = (opts.theme === "auto")
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light")
      : opts.theme;

    const style = document.createElement('style');
    style.textContent = styleTemplate({primary: opts.primaryColor, accent: opts.accentColor}, theme);
    shadow.appendChild(style);

    const container = makeElement(`<div class="qr-card" role="region" aria-label="QR business card generator"></div>`);
    shadow.appendChild(container);

    const header = makeElement(`<div class="header"></div>`);
    if (opts.logoUrl) {
      const img = makeElement(`<img class="logo" alt="${opts.brandName} logo">`);
      img.src = opts.logoUrl;
      header.appendChild(img);
    }
    header.appendChild(makeElement(`<div><div class="title">${opts.brandName} • QR Card</div><div class="subtitle">Create a scannable vCard and save your info.</div></div>`));
    container.appendChild(header);

    const form = makeElement(`<form novalidate>
      <div class="full"><label>First Name*</label><input name="firstName" required aria-required="true"></div>
      <div class="full"><label>Last Name*</label><input name="lastName" required aria-required="true"></div>
      <div><label>Title/Role</label><input name="title"></div>
      <div><label>Company</label><input name="company"></div>
      <div><label>Email*</label><input type="email" name="email" required aria-required="true"></div>
      <div><label>Mobile Phone*</label><input name="mobile" required aria-required="true" placeholder="+11234567890"></div>
      <div><label>Work Phone</label><input name="workPhone" placeholder="+11234567890"></div>
      <div><label>Website</label><input type="url" name="website" placeholder="https://example.com"></div>
      <div><label>LinkedIn</label><input type="url" name="linkedin" placeholder="https://linkedin.com/in/..."></div>
      <div><label>X/Twitter</label><input type="url" name="twitter" placeholder="https://x.com/..."></div>
      <div><label>Instagram</label><input type="url" name="instagram" placeholder="https://instagram.com/..."></div>

      <div class="full"><label>Street</label><input name="street"></div>
      <div><label>City</label><input name="city"></div>
      <div><label>State/Region</label><input name="state"></div>
      <div><label>Postal Code</label><input name="postal"></div>
      <div class="full"><label>Country</label><input name="country"></div>

      <div class="full"><label>Notes</label><textarea name="notes" rows="3" placeholder="Optional notes..."></textarea></div>

      <div class="consent">
        <input type="checkbox" id="consent" required aria-required="true">
        <label for="consent">${opts.consentText}</label>
      </div>
    </form>`);
    container.appendChild(form);

    const preview = makeElement(`<div class="preview">
      <div>
        <div class="help">Live QR Preview</div>
        <div class="qrbox"><canvas id="qrCanvas" width="180" height="180" aria-label="QR preview"></canvas></div>
      </div>
      <div>
        <div class="help">Actions</div>
        <div class="actions">
          <button type="button" id="btnGenerate">Generate</button>
          <button type="button" id="btnPNG" class="secondary" disabled>Download PNG</button>
          <button type="button" id="btnSVG" class="secondary" disabled>Download SVG</button>
          <button type="button" id="btnVCF" class="secondary" disabled>Download .vcf</button>
        </div>
        <div class="help" id="status" style="margin-top:8px;"></div>
      </div>
    </div>`);
    container.appendChild(preview);

    const canvas = preview.querySelector("#qrCanvas");
    const btnGenerate = preview.querySelector("#btnGenerate");
    const btnPNG = preview.querySelector("#btnPNG");
    const btnSVG = preview.querySelector("#btnSVG");
    const btnVCF = preview.querySelector("#btnVCF");
    const status = preview.querySelector("#status");

    let latestVCard = "";
    let latestText = "";

    function collect(){
      const fd = new FormData(form);
      const data = {
        firstName: fd.get("firstName")?.toString().trim(),
        lastName: fd.get("lastName")?.toString().trim(),
        title: fd.get("title")?.toString().trim(),
        company: fd.get("company")?.toString().trim(),
        email: fd.get("email")?.toString().trim(),
        mobile: fd.get("mobile")?.toString().trim(),
        workPhone: fd.get("workPhone")?.toString().trim(),
        website: fd.get("website")?.toString().trim(),
        socials: {
          linkedin: fd.get("linkedin")?.toString().trim(),
          twitter: fd.get("twitter")?.toString().trim(),
          instagram: fd.get("instagram")?.toString().trim(),
        },
        address: {
          street: fd.get("street")?.toString().trim(),
          city: fd.get("city")?.toString().trim(),
          state: fd.get("state")?.toString().trim(),
          postal: fd.get("postal")?.toString().trim(),
          country: fd.get("country")?.toString().trim(),
        },
        notes: fd.get("notes")?.toString().trim(),
        consent: form.querySelector("#consent").checked ? 1 : 0,
      };
      return data;
    }

    function validate(data){
      const errors = [];
      if (!data.firstName) errors.push("First name is required");
      if (!data.lastName) errors.push("Last name is required");
      if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push("Valid email is required");
      if (!data.mobile) errors.push("Mobile phone is required");
      if (!data.consent) errors.push("Consent is required");
      return errors;
    }

    async function renderQR(text){
      await ensureQR();
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width, canvas.height);
      return new Promise((resolve, reject)=>{
        window.QRCode.toCanvas(canvas, text, { errorCorrectionLevel: 'M', margin: 1, width: 180 }, function (err) {
          if (err) reject(err); else resolve();
        });
      });
    }

    async function generate(){
      status.textContent = "Generating…";
      const data = collect();
      const errs = validate(data);
      if (errs.length){
        status.textContent = errs.join(" • ");
        return;
      }
      latestVCard = buildVCard(data);
      latestText = latestVCard; // default: embed vCard payload in the QR

      try {
        await renderQR(latestText);
        btnPNG.disabled = false;
        btnSVG.disabled = false;
        btnVCF.disabled = false;
        status.textContent = "QR ready. You can download or submit.";
        container.dispatchEvent(new CustomEvent("onGenerate", { detail: { data } }));
      } catch (e){
        status.textContent = "Failed to render QR: " + (e?.message || e);
      }
    }

    btnGenerate.addEventListener("click", generate);

    btnPNG.addEventListener("click", ()=>{
      if (!latestText) return;
      downloadCanvasAsPNG(canvas, "qr-card.png");
    });

    btnSVG.addEventListener("click", async ()=>{
      if (!latestText) return;
      await ensureQR();
      window.QRCode.toString(latestText, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 }, function(err, svg){
        if (err) { status.textContent = "SVG error: " + err.message; return; }
        const blob = new Blob([svg], {type: "image/svg+xml"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = "qr-card.svg";
        document.body.appendChild(a); a.click();
        setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
      });
    });

    btnVCF.addEventListener("click", ()=>{
      if (!latestVCard) return;
      triggerDownload("contact.vcf", "text/vcard;charset=utf-8", latestVCard);
    });

    // Submit to backend
    const submitBar = makeElement(`<div class="actions" style="margin-top:12px;">
      <button type="button" id="btnSubmit">Submit to Backend</button>
    </div>`);
    container.appendChild(submitBar);
    const btnSubmit = submitBar.querySelector("#btnSubmit");
    btnSubmit.addEventListener("click", async ()=>{
      status.textContent = "Submitting…";
      const data = collect();
      const errs = validate(data);
      if (errs.length){
        status.textContent = errs.join(" • ");
        return;
      }
      try {
        const res = await fetch((opts.apiBase || "") + "/api/qr-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            contact: {
              firstName: data.firstName, lastName: data.lastName, title: data.title, company: data.company,
              email: data.email, mobile: data.mobile, workPhone: data.workPhone, website: data.website,
              socials: data.socials, address: data.address, notes: data.notes
            },
            consent: { text: opts.consentText },
            qr: { type: "vcard", design: { ecc: "M", margin: 1 }, payload: latestVCard }
          })
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        status.innerHTML = `Saved! Hosted profile: <a href="${(opts.apiBase||"")+json.profileUrl}" target="_blank" rel="noopener"> ${(opts.apiBase||"")+json.profileUrl} </a>`;
        container.dispatchEvent(new CustomEvent("onSubmitSuccess", { detail: json }));
      } catch (e){
        status.textContent = "Submit failed: " + (e?.message || e);
        container.dispatchEvent(new CustomEvent("onError", { detail: e }));
      }
    });

    // Live preview as user types (debounced)
    let t;
    form.addEventListener("input", ()=>{
      clearTimeout(t);
      t = setTimeout(async ()=>{
        const data = collect();
        if (!data.firstName || !data.lastName) return;
        latestVCard = buildVCard(data);
        latestText = latestVCard;
        try { await renderQR(latestText); } catch {}
      }, 300);
    });
  }

  // Public API
  const QRCard = {
    mount: function(elOrSelector, options){
      const el = (typeof elOrSelector === "string") ? document.querySelector(elOrSelector) : elOrSelector;
      if (!el) throw new Error("Mount target not found");
      const opts = Object.assign({}, DEFAULTS, options || {});
      const root = el.attachShadow ? el.attachShadow({mode:"open"}) : el;
      mountedUI(root, opts);
      return { destroy() { /* noop */ } };
    }
  };

  // Web Component wrapper
  class QRCardElement extends HTMLElement {
    constructor(){
      super();
      this._mounted = false;
    }
    connectedCallback(){
      if (this._mounted) return;
      this._mounted = true;
      const opts = {
        apiBase: this.getAttribute("api-base") || DEFAULTS.apiBase,
        brandName: this.getAttribute("brand-name") || DEFAULTS.brandName,
        primaryColor: this.getAttribute("primary-color") || DEFAULTS.primaryColor,
        accentColor: this.getAttribute("accent-color") || DEFAULTS.accentColor,
        logoUrl: this.getAttribute("logo-url") || DEFAULTS.logoUrl,
        theme: this.getAttribute("theme") || DEFAULTS.theme,
        consentText: this.getAttribute("consent-text") || DEFAULTS.consentText,
      };
      QRCard.mount(this, opts);
    }
  }
  if (!customElements.get("qr-card-generator")) {
    customElements.define("qr-card-generator", QRCardElement);
  }
  window.QRCard = QRCard;
})();
