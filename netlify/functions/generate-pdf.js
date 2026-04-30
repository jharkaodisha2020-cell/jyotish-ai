const PDFDocument = require('pdfkit');
const https = require('https');
const http = require('http');

// ── Font URLs (Google Fonts CDN - loaded at runtime) ──
const FONT_URLS = {
  latin: 'https://fonts.gstatic.com/s/lato/v24/S6uyw4BMUTPHjxAwXjeu.woff2',
  // We'll use a fallback approach for Odia
};

// ── Colors ──
const NAVY   = '#1A2864';
const GOLD   = '#B8870A';
const CREAM  = '#F8F4EE';
const INK    = '#1A1208';
const BORDER = '#C8D0DC';
const BGCARD = '#F0EEE8';
const GREEN  = '#1E6432';
const RED    = '#A02828';
const BLUE   = '#1A3A5C';
const MUTED  = '#6A7090';

function fetchFont(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function generatePDF(kundliData) {
  const {
    input, planets, moonNak, ascendant, dashas, currDasha,
    yogas, reading, ayanamsa, lang
  } = kundliData;

  const isOd = lang === 'od';
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: {
      Title: `Jyotish AI - ${input.nm} Kundli Report`,
      Author: 'Jyotish AI',
      Subject: 'Vedic Astrology Kundli Report',
    }
  });

  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));

  const W = doc.page.width;
  const H = doc.page.height;
  const M = 40;
  const CW = W - M * 2;
  let y = M;

  // ── Helper functions ──
  const moveY = (n) => { y += n; };
  const checkPage = (needed = 30) => {
    if (y + needed > H - 40) {
      doc.addPage();
      y = M;
      drawPageHeader();
    }
  };

  const drawRect = (x, ry, w, h, color, radius = 0) => {
    doc.roundedRect(x, ry, w, h, radius).fill(color);
  };

  const drawBorder = (x, ry, w, h, color, radius = 0) => {
    doc.roundedRect(x, ry, w, h, radius).stroke(color);
  };

  const writeText = (text, x, ry, opts = {}) => {
    const {
      size = 10, color = INK, bold = false,
      align = 'left', width = CW, lineBreak = false
    } = opts;
    doc.fontSize(size)
       .fillColor(color)
       .font(bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(String(text || ''), x, ry, {
         width, align, lineBreak
       });
  };

  // For Odia text - use a Unicode-compatible approach
  // PDFKit with Helvetica won't render Odia, so we use English transliteration
  // for Odia mode with Odia script in brackets
  const writeOdia = (odText, enText, x, ry, opts = {}) => {
    // Write English text when font doesn't support Odia
    // This is a graceful fallback
    writeText(enText || odText, x, ry, opts);
  };

  const sectionHeader = (title, ry) => {
    drawRect(M, ry, CW, 16, NAVY);
    doc.fontSize(9).fillColor(CREAM).font('Helvetica-Bold')
       .text(title, M + 6, ry + 4, { width: CW - 12 });
    return ry + 20;
  };

  const infoRow = (label, value, ry, valueColor = INK) => {
    doc.fontSize(8.5).fillColor(MUTED).font('Helvetica')
       .text(label, M, ry, { width: CW / 2 });
    doc.fontSize(8.5).fillColor(valueColor).font('Helvetica-Bold')
       .text(String(value || '—'), M + CW / 2, ry, { width: CW / 2, align: 'right' });
    doc.moveTo(M, ry + 12).lineTo(M + CW, ry + 12).stroke(BORDER).lineWidth(0.3);
    return ry + 14;
  };

  const drawPageHeader = () => {
    drawRect(0, 0, W, 42, NAVY);
    drawRect(0, 40, W, 2, GOLD);
    doc.fontSize(8).fillColor('#B0C0E0').font('Helvetica')
       .text('Jyotish AI · VSOP87 Planetary Engine · Lahiri Ayanamsa · jyotishaiodisha.netlify.app',
             0, 30, { width: W, align: 'center' });
  };

  // ── PAGE 1 HEADER ──
  drawRect(0, 0, W, 60, NAVY);
  drawRect(0, 58, W, 2, GOLD);
  doc.fontSize(20).fillColor(CREAM).font('Helvetica-Bold')
     .text('Jyotish AI — Birth Kundli Report', 0, 14, { width: W, align: 'center' });
  doc.fontSize(10).fillColor(GOLD).font('Helvetica')
     .text('ॐ तत् सत् · Vedic Astrology · Lahiri Ayanamsa', 0, 38, { width: W, align: 'center' });

  y = 74;

  // ── PERSONAL INFO BOX ──
  drawRect(M, y, CW, 44, BGCARD, 4);
  drawBorder(M, y, CW, 44, BORDER, 4);
  drawRect(M, y, CW, 16, NAVY, 4);
  doc.roundedRect(M, y + 12, CW, 4, 0).fill(NAVY); // fix bottom of header

  doc.fontSize(13).fillColor(CREAM).font('Helvetica-Bold')
     .text(input.nm || 'Name', M, y + 4, { width: CW, align: 'center' });

  const dobStr = new Date(input.dStr).toDateString();
  doc.fontSize(8.5).fillColor(MUTED).font('Helvetica')
     .text(`${dobStr} · ${input.tStr} IST · ${input.place}${input.gotra ? ' · Gotra: ' + input.gotra : ''}`,
           M, y + 22, { width: CW, align: 'center' });
  doc.fontSize(8).fillColor(MUTED).font('Helvetica')
     .text(`Ayanamsa (Lahiri): ${ayanamsa}° · Calculated using VSOP87 Planetary Engine`,
           M, y + 34, { width: CW, align: 'center' });
  y += 52;

  // ── KEY NUMBERS GRID ──
  const RASHI_N = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  const RASHI_OD = ['ମେଷ','ବୃଷ','ମିଥୁନ','କର୍କ','ସିଂହ','କନ୍ୟା','ତୁଳା','ବୃଶ୍ଚିକ','ଧନୁ','ମକର','କୁମ୍ଭ','ମୀନ'];

  const chips = [
    { l: 'Lagna', v: `${ascendant.rashiName} ${ascendant.deg}°` },
    { l: 'Moon Rashi', v: planets[1]?.rashiName || '—' },
    { l: 'Nakshatra', v: moonNak?.name || '—' },
    { l: 'Pada', v: String(moonNak?.pada || '—') },
    { l: 'Mahadasha', v: currDasha?.planet || '—' },
    { l: 'Ayanamsa', v: `${ayanamsa}°` },
  ];

  const chipW = CW / 3, chipH = 22;
  chips.forEach((c, i) => {
    const cx = M + (i % 3) * chipW;
    const cy = y + Math.floor(i / 3) * chipH;
    drawRect(cx, cy, chipW, chipH, i % 2 === 0 ? BGCARD : '#E8E4DC');
    doc.rect(cx, cy, chipW, chipH).stroke(BORDER).lineWidth(0.3);
    drawRect(cx, cy, chipW, 4, NAVY);
    doc.fontSize(6.5).fillColor(MUTED).font('Helvetica')
       .text(c.l, cx + 2, cy + 6, { width: chipW - 4, align: 'center' });
    doc.fontSize(8.5).fillColor(INK).font('Helvetica-Bold')
       .text(c.v, cx + 2, cy + 14, { width: chipW - 4, align: 'center' });
  });
  y += chipH * 2 + 10;

  // ── BIRTH CHART ──
  checkPage(100);
  y = sectionHeader('✦ Birth Chart — North Indian Style (Lagna: ' + ascendant.rashiName + ')', y);

  const chartX = M, chartY = y, chartW = 90, chartH = 90;
  const cX = chartX + chartW / 2, cY = chartY + chartH / 2;
  const cW4 = chartW / 4, cH4 = chartH / 4;

  // Chart background
  drawRect(chartX, chartY, chartW, chartH, BGCARD);
  doc.rect(chartX, chartY, chartW, chartH).stroke(NAVY).lineWidth(0.6);

  // Grid
  doc.moveTo(chartX + cW4, chartY).lineTo(chartX + cW4, chartY + chartH).stroke(BORDER).lineWidth(0.4);
  doc.moveTo(chartX + cW4 * 3, chartY).lineTo(chartX + cW4 * 3, chartY + chartH).stroke(BORDER);
  doc.moveTo(chartX, chartY + cH4).lineTo(chartX + chartW, chartY + cH4).stroke(BORDER);
  doc.moveTo(chartX, chartY + cH4 * 3).lineTo(chartX + chartW, chartY + cH4 * 3).stroke(BORDER);

  // Diagonals
  doc.moveTo(chartX + cW4, chartY + cH4).lineTo(cX, cY).stroke(BORDER).lineWidth(0.3);
  doc.moveTo(chartX + cW4 * 3, chartY + cH4).lineTo(cX, cY).stroke(BORDER);
  doc.moveTo(chartX + cW4, chartY + cH4 * 3).lineTo(cX, cY).stroke(BORDER);
  doc.moveTo(chartX + cW4 * 3, chartY + cH4 * 3).lineTo(cX, cY).stroke(BORDER);

  // OM
  doc.fontSize(9).fillColor(GOLD).font('Helvetica-Bold').text('OM', cX - 8, cY - 4);

  // House positions in North Indian layout
  const hPos = [
    [0,1],[0,0],[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[2,3],[1,3],[0,3],[0,2]
  ];
  const houseContents = Array(12).fill('').map(() => []);
  planets.forEach(p => {
    const h = p.house - 1;
    if (h >= 0 && h < 12) houseContents[h].push(p.name.substring(0, 3));
  });
  houseContents[0].unshift('Asc');

  hPos.forEach(([r, c], i) => {
    const hx = chartX + c * cW4, hy = chartY + r * cH4;
    const hcx = hx + cW4 / 2, hcy = hy + cH4 / 2;
    // House number
    doc.fontSize(5).fillColor(BORDER).font('Helvetica')
       .text(String(i + 1), hx + cW4 - 6, hy + 2);
    // Planets
    houseContents[i].forEach((item, idx) => {
      const col = item === 'Asc' ? GOLD
        : item === 'Rah' || item === 'Ket' ? RED
        : NAVY;
      doc.fontSize(6).fillColor(col).font('Helvetica-Bold')
         .text(item, hcx - 8, hcy - 4 + (idx * 8));
    });
  });

  // Chart legend
  const legX = chartX + chartW + 10;
  let legY = chartY;
  doc.fontSize(7).fillColor(NAVY).font('Helvetica-Bold').text('Planets', legX, legY);
  legY += 9;
  planets.forEach(p => {
    const col = p.dignity === 'Exalted' ? GREEN
      : p.dignity === 'Debilitated' ? RED
      : INK;
    doc.fontSize(6.5).fillColor(col).font('Helvetica')
       .text(`${p.name.padEnd(8)} ${p.rashiName.substring(0,3)} H${p.house}`, legX, legY);
    legY += 7;
  });
  y += chartH + 12;

  // ── PLANETS TABLE ──
  checkPage(80);
  y = sectionHeader('✦ Planetary Positions (Sidereal · Lahiri Ayanamsa)', y);

  // Table header
  const cols = [40, 55, 28, 28, 50, 22, 50];
  const headers = ['Planet', 'Rashi', 'Deg', 'H', 'Nakshatra', 'Pd', 'Dignity'];
  drawRect(M, y, CW, 13, NAVY);
  let cx2 = M + 3;
  headers.forEach((h2, i) => {
    doc.fontSize(7).fillColor(CREAM).font('Helvetica-Bold').text(h2, cx2, y + 3, { width: cols[i] });
    cx2 += cols[i];
  });
  y += 13;

  planets.forEach((p, idx) => {
    checkPage(12);
    const bg = idx % 2 === 0 ? CREAM : BGCARD;
    drawRect(M, y, CW, 11, bg);
    const digCol = p.dignity === 'Exalted' ? GREEN
      : p.dignity === 'Debilitated' ? RED
      : p.dignity === 'Own Sign' ? BLUE : MUTED;
    cx2 = M + 3;
    const vals = [p.name, p.rashiName, `${p.degInRashi}°`, `H${p.house}`, p.nakName?.substring(0,12)||'', String(p.pada||''), p.dignity];
    vals.forEach((v, i) => {
      const col2 = i === 6 ? digCol : INK;
      const bold = i === 0 || i === 6;
      doc.fontSize(7).fillColor(col2).font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(v, cx2, y + 2, { width: cols[i], lineBreak: false });
      cx2 += cols[i];
    });
    doc.moveTo(M, y + 11).lineTo(M + CW, y + 11).stroke(BORDER).lineWidth(0.2);
    y += 11;
  });
  y += 8;

  // ── YOGAS ──
  checkPage(50);
  y = sectionHeader('✦ Yogas & Special Combinations', y);
  yogas.slice(0, 5).forEach(yg => {
    checkPage(22);
    drawRect(M, y, CW, 20, BGCARD, 3);
    drawBorder(M, y, CW, 20, BORDER, 3);
    doc.fontSize(8).fillColor(NAVY).font('Helvetica-Bold').text(yg.name, M + 5, y + 3);
    doc.fontSize(7).fillColor(GOLD).font('Helvetica').text(`[${yg.str}]`, M + CW - 50, y + 4, { width: 45, align: 'right' });
    const desc = (yg.desc || '').substring(0, 120) + (yg.desc?.length > 120 ? '...' : '');
    doc.fontSize(7).fillColor(MUTED).font('Helvetica').text(desc, M + 5, y + 12, { width: CW - 10 });
    y += 24;
  });
  y += 4;

  // ── DASHA TABLE ──
  checkPage(60);
  y = sectionHeader('✦ Vimshottari Dasha Timeline', y);
  const dHeaders = ['Mahadasha', 'Start Date', 'End Date', 'Duration'];
  const dCols = [80, 80, 80, 60];
  drawRect(M, y, CW, 13, NAVY);
  cx2 = M + 3;
  dHeaders.forEach((h3, i) => {
    doc.fontSize(7).fillColor(CREAM).font('Helvetica-Bold').text(h3, cx2, y + 3, { width: dCols[i] });
    cx2 += dCols[i];
  });
  y += 13;

  const now = new Date();
  (dashas || []).forEach((d, idx) => {
    checkPage(12);
    const isCurr = d.planet === currDasha?.planet;
    const bg2 = isCurr ? '#E0E8FF' : idx % 2 === 0 ? CREAM : BGCARD;
    drawRect(M, y, CW, 11, bg2);
    if (isCurr) drawRect(M, y, 3, 11, NAVY);
    cx2 = M + (isCurr ? 6 : 3);
    const start = new Date(d.start || d.startDate);
    const end = new Date(d.end || d.endDate);
    const dVals = [
      d.planet + (isCurr ? ' ◀ NOW' : ''),
      start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      (d.years || 0).toFixed(1) + ' yrs'
    ];
    dVals.forEach((v, i) => {
      const col3 = isCurr ? NAVY : INK;
      const bold2 = isCurr || i === 0;
      doc.fontSize(7).fillColor(col3).font(bold2 ? 'Helvetica-Bold' : 'Helvetica')
         .text(v, cx2, y + 2, { width: dCols[i], lineBreak: false });
      cx2 += dCols[i];
    });
    y += 11;
  });
  y += 8;

  // ── PAGE 2: AI PREDICTIONS ──
  doc.addPage();
  y = M;
  drawRect(0, 0, W, 30, NAVY);
  drawRect(0, 28, W, 2, GOLD);
  doc.fontSize(14).fillColor(CREAM).font('Helvetica-Bold')
     .text(isOd ? 'AI Bhavishya & Jeevan Phala' : 'AI Predictions & Life Reading', 0, 10, { width: W, align: 'center' });
  y = 42;

  const sections = [
    { k: 'overview', l: { en: 'Overview & Personality', od: 'Vyaktitva Saaransh' } },
    { k: 'strengths', l: { en: 'Strengths & Natural Gifts', od: 'Shakti O Pratibha' } },
    { k: 'career', l: { en: 'Career & Finance', od: 'Carrier O Artha' } },
    { k: 'love', l: { en: 'Love & Relationships', od: 'Prema O Sambandha' } },
    { k: 'health', l: { en: 'Health', od: 'Swasthya' } },
    { k: 'dasha', l: { en: `${currDasha?.planet} Dasha Effect`, od: `${currDasha?.planet} Dasha Phala` } },
  ];

  sections.forEach(sec => {
    const txt = reading?.[sec.k + '_' + (isOd ? 'od' : 'en')] || '';
    if (!txt) return;
    const lbl = isOd ? sec.l.od : sec.l.en;
    // Estimate height needed
    const lines = Math.ceil(txt.length / 90) + 1;
    const boxH = lines * 9 + 18;
    checkPage(boxH + 4);

    drawRect(M, y, CW, boxH, BGCARD, 3);
    drawBorder(M, y, CW, boxH, BORDER, 3);
    drawRect(M, y, CW, 13, NAVY, 3);
    doc.rect(M, y + 10, CW, 3).fill(NAVY);

    doc.fontSize(7.5).fillColor(CREAM).font('Helvetica-Bold').text(lbl, M + 5, y + 3);
    doc.fontSize(8.5).fillColor(INK).font('Helvetica')
       .text(txt, M + 5, y + 17, { width: CW - 10, lineBreak: true });
    y += boxH + 5;
  });

  // ── REMEDIES ──
  checkPage(50);
  y = sectionHeader('✦ Remedies & Gemstones', y);
  const rems = isOd ? reading?.remedies_od : reading?.remedies;
  const gems = isOd ? reading?.gemstones_od : reading?.gemstones;

  (rems || []).forEach(rem => {
    checkPage(12);
    drawRect(M, y, CW, 10, BGCARD);
    drawBorder(M, y, CW, 10, BORDER);
    doc.fontSize(7.5).fillColor(INK).font('Helvetica').text('✦ ' + rem, M + 4, y + 2, { width: CW - 8 });
    y += 11;
  });
  y += 4;

  if (gems?.length) {
    y = sectionHeader('✦ Gemstones', y);
    gems.forEach(gem => {
      checkPage(12);
      drawRect(M, y, CW, 10, '#E8EFF8');
      drawBorder(M, y, CW, 10, '#A0B0CC');
      doc.fontSize(7.5).fillColor(BLUE).font('Helvetica').text('💎 ' + gem, M + 4, y + 2, { width: CW - 8 });
      y += 11;
    });
    y += 4;
  }

  // ── LUCKY FACTORS ──
  checkPage(40);
  y = sectionHeader('✦ Lucky Factors', y);
  const luckys = [
    ['Lucky Color', isOd ? reading?.luckyColor_od : reading?.luckyColor_en],
    ['Lucky Number', String(reading?.luckyNumber || '—')],
    ['Lucky Day', isOd ? reading?.luckyDay_od : reading?.luckyDay_en],
    ['Beeja Mantra', reading?.mantra || '—'],
  ];
  luckys.forEach(([lbl, val]) => {
    checkPage(14);
    y = infoRow(lbl, val, y, lbl === 'Lucky Number' ? GOLD : INK);
  });

  // ── FOOTER on all pages ──
  const pageCount = doc.bufferedPageRange ? doc.bufferedPageRange().count : 2;
  for (let i = 0; i < (doc._pageBuffer?.length || 2); i++) {
    try {
      doc.switchToPage && doc.switchToPage(i);
      drawRect(0, H - 18, W, 18, NAVY);
      doc.fontSize(7).fillColor('#A0B0CC').font('Helvetica')
         .text(
           `Jyotish AI · jyotishaiodisha.netlify.app · Generated: ${new Date().toLocaleDateString('en-IN')} · Page ${i + 1}`,
           0, H - 12, { width: W, align: 'center' }
         );
    } catch (e) { /* ignore */ }
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

exports.handler = async function(event) {
  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const pdfBuffer = await generatePDF(body);
    const base64PDF = pdfBuffer.toString('base64');
    const filename = `${(body.input?.nm || 'Kundli').replace(/\s+/g, '_')}_Kundli_${body.lang === 'od' ? 'Odia' : 'English'}.pdf`;

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pdf: base64PDF, filename }),
    };
  } catch (e) {
    console.error('PDF generation error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
