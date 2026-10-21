(() => {
  // Steps marked data-hidden are skipped by the wizard (not shown, not counted, not validated),
  // but their fields stay in the page, so the generated document still reads their values.
  const steps = [...document.querySelectorAll('.wizard-step:not([data-hidden])')];
  const stepCount = document.getElementById('stepCount');
  const progressFill = document.getElementById('progressFill');
  const backBtn = document.getElementById('backBtn');
  const nextBtn = document.getElementById('nextBtn');
  const generateBtn = document.getElementById('generateBtn');
  const status = document.getElementById('status');
  const form = document.getElementById('wizardForm');
  let current = 0;
  function showStep(index) {
    current = index;
    steps.forEach((s, i) => s.classList.toggle('active', i === current));
    stepCount.textContent = `Step ${current + 1} of ${steps.length}`;
    progressFill.style.width = `${((current + 1) / steps.length) * 100}%`;
    backBtn.disabled = current === 0;
    nextBtn.classList.toggle('hidden', current === steps.length - 1);
    generateBtn.classList.toggle('hidden', current !== steps.length - 1);
    status.textContent = '';
  }
  function validCurrentStep() {
    const fields = [...steps[current].querySelectorAll('input, textarea')];
    for (const field of fields) {
      if (!field.checkValidity()) { field.reportValidity(); return false; }
    }
    return true;
  }
  nextBtn.addEventListener('click', () => { if (validCurrentStep()) showStep(Math.min(current + 1, steps.length - 1)); });
  backBtn.addEventListener('click', () => showStep(Math.max(current - 1, 0)));
  const val = id => document.getElementById(id).value.trim();

  // ---- Row editors: one card per table row, with a field per column ----
  // <div class="row-editor" data-store="textareaId" data-cols="A|B|C"> reads its rows from the hidden
  // textarea (one "a | b | c" line per row) and writes them back on every edit, so the generators keep
  // reading the textarea with lines()/cols().
  // Split a table row on "|" but keep the "|" inside [[link text|url]] markers
  const splitCols = l => l.split(/\|(?![^[]*\]\])/).map(s => s.trim());
  function rowEditor(ed) {
    const store = document.getElementById(ed.dataset.store);
    const names = ed.dataset.cols.split('|');
    const heights = (ed.dataset.rows || '').split('|').map(Number);
    const defaults = (ed.dataset.defaults || '').split('|');
    const [groupAt, groupName] = (ed.dataset.group || '').split(':');
    const [boxFrom, boxTo] = (ed.dataset.box || '').split('-').filter(Boolean).map(Number);
    // data-checks="6|7": those columns are checkboxes, stored as "x" (ticked) or "" (unticked)
    const checks = new Set((ed.dataset.checks || '').split('|').filter(Boolean).map(Number));
    // data-selects='{"2":[["stored value","Label"],...]}': those columns are dropdowns, stored as the option value
    const selects = JSON.parse(ed.dataset.selects || '{}');
    // data-datetimes="10|11": those columns are date-time pickers, stored as "yyyy-MM-ddTHH:mm" (empty = not set)
    const datetimes = new Set((ed.dataset.datetimes || '').split('|').filter(Boolean).map(Number));
    const sync = () => {
      store.value = [...ed.querySelectorAll('.row-card')]
        .map(card => [...card.querySelectorAll('[data-col]')]
          .map(f => f.type === 'checkbox' ? (f.checked ? 'x' : '') : f.value.replace(/\r?\n/g, ';;').trim()).join(' | '))
        .join('\n');
    };
    const renumber = () => ed.querySelectorAll('.row-card').forEach((card, i) => {
      card.querySelector('.row-title').textContent = `Row ${i + 1}`;
    });
    const addCard = (values = defaults, after) => {
      const card = document.createElement('div');
      card.className = 'row-card';
      card.innerHTML = '<div class="row-card-head"><span class="row-title"></span>' +
        '<span class="row-actions"><button type="button" class="row-btn" data-act="up" title="Move up">↑</button>' +
        '<button type="button" class="row-btn" data-act="down" title="Move down">↓</button>' +
        '<button type="button" class="row-btn danger" data-act="remove" title="Remove row">Remove</button></span></div>' +
        '<div class="row-fields"></div>';
      const fields = card.querySelector('.row-fields');
      let box = null;
      names.forEach((name, i) => {
        const label = document.createElement('label');
        let field;
        if (checks.has(i)) {
          field = document.createElement('input');
          field.type = 'checkbox';
          field.checked = !!(values[i] || '').trim();
          field.addEventListener('change', sync);
          label.className = 'check';
          label.append(field, ' ' + name);
        } else if (datetimes.has(i)) {
          label.textContent = name;
          field = document.createElement('input');
          field.type = 'datetime-local';
          field.value = values[i] || '';
          field.addEventListener('input', sync);
          field.addEventListener('change', sync);
          label.appendChild(field);
        } else if (selects[i]) {
          label.textContent = name;
          field = document.createElement('select');
          selects[i].forEach(([v, text]) => field.add(new Option(text, v)));
          field.value = values[i] || '';
          field.addEventListener('change', sync);
          label.appendChild(field);
        } else {
          label.textContent = name;
          field = document.createElement('textarea');
          field.rows = heights[i] || (i === 0 ? 1 : 3);
          field.value = values[i] || '';
          field.addEventListener('input', sync);
          label.appendChild(field);
          if (i === 0) label.className = 'sn';
        }
        field.dataset.col = i;
        if (groupName && i === +groupAt) {
          const g = document.createElement('div');
          g.className = 'row-group';
          g.textContent = groupName;
          fields.appendChild(g);
        }
        // data-box="9-10": those columns sit together inside one bordered box (layout only; the stored data is unchanged)
        if (boxFrom !== undefined && i >= boxFrom && i <= boxTo) {
          if (i === boxFrom) {
            box = document.createElement('div');
            box.className = 'row-box';
            fields.appendChild(box);
          }
          box.appendChild(label);
        } else {
          fields.appendChild(label);
        }
      });
      if (after) after.after(card); else ed.appendChild(card);
      renumber(); sync();
      return card;
    };
    ed.addEventListener('click', e => {
      const btn = e.target.closest('.row-btn'); if (!btn) return;
      const card = btn.closest('.row-card');
      if (btn.dataset.act === 'remove') {
        if (ed.querySelectorAll('.row-card').length === 1) {
          card.querySelectorAll('[data-col]').forEach(f => { if (f.type === 'checkbox') f.checked = false; else f.value = ''; });
        }
        else card.remove();
      } else if (btn.dataset.act === 'up' && card.previousElementSibling) card.previousElementSibling.before(card);
      else if (btn.dataset.act === 'down' && card.nextElementSibling) card.nextElementSibling.after(card);
      renumber(); sync();
    });
    store.value.split(/\r?\n/).filter(l => l.trim()).forEach(l => addCard(splitCols(l)));
    if (!ed.querySelector('.row-card')) addCard();
    document.querySelector(`.row-add[data-editor="${ed.id}"]`)?.addEventListener('click', () => {
      addCard().querySelector('textarea').focus();
    });
  }
  document.querySelectorAll('.row-editor').forEach(rowEditor);
  // "2025-03-01T00:00" -> "01 March 2025 00:00" (dd MMMM yyyy HH:mm); anything unparseable is returned as typed
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fmtDateTime = v => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || '');
    return m ? `${m[3]} ${MONTHS[+m[2] - 1]} ${m[1]} ${m[4]}:${m[5]}` : (v || '');
  };
  // "2025-03-01" -> "01/03/2025" (dd/MM/yyyy); empty or unparseable input returns ''
  const fmtDate = v => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  };
  // Layout constants measured from the reference pages (A4, twips).
  const PAGE_W = 11906, PAGE_H = 16838, MARGIN_X = 1440, TEXT_W = PAGE_W - 2 * MARGIN_X;
  function logoBytes() {
    const bin = atob(window.SYNAPXE_LOGO || '');
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  }
  function para(d, text, opts = {}) {
    const { Paragraph, TextRun, AlignmentType } = d;
    return new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      pageBreakBefore: !!opts.pageBreakBefore,
      spacing: { before: opts.before ?? 0, after: opts.after ?? 0 },
      indent: opts.indent,
      children: [new TextRun({ text, bold: !!opts.bold, size: opts.size || 20, font: 'Arial' })]
    });
  }
  // Page header (fixed, not in the wizard): "<RESTRICTED, SENSITIVE (NORMAL)>" bottom-left, logo with tagline right, rule underneath.
  // width: usable text width of the section (portrait TEXT_W by default, LAND_TEXT_W for the landscape pages)
  function makeHeader(d, width = TEXT_W) {
    const { Header, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, VerticalAlign, AlignmentType, BorderStyle } = d;
    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const noBorders = { top: none, bottom: none, left: none, right: none };
    const LOGO_W = 3200;                       // twips reserved for the logo cell
    const cell = (children, w, align) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      verticalAlign: VerticalAlign.BOTTOM,
      borders: noBorders,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      children
    });
    const banner = new Table({
      width: { size: width, type: WidthType.DXA },
      columnWidths: [width - LOGO_W, LOGO_W],
      borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
      rows: [new TableRow({ children: [
        cell([new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun({ text: '<RESTRICTED, SENSITIVE (NORMAL)>', size: 14, font: 'Arial', color: '595959' })] })], width - LOGO_W),
        cell([new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 }, children: [new ImageRun({ data: logoBytes(), transformation: { width: 200, height: 71 } })] })], LOGO_W)
      ] })]
    });
    // The rule sits on its own empty paragraph below the banner
    return new Header({ children: [
      banner,
      new Paragraph({ spacing: { before: 0, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000', space: 1 } }, children: [] })
    ] });
  }
  // Page footer (fixed, not in the wizard): grey rule, company line + registration number on the left, "page / total" on the right.
  // width: usable text width of the section (portrait TEXT_W by default, LAND_TEXT_W for the landscape pages)
  function makeFooter(d, width = TEXT_W) {
    const { Footer, Paragraph, TextRun, BorderStyle, TabStopType, PageNumber, Tab } = d;
    const GREY = '7F7F7F';
    const run = (children, o = {}) => new TextRun({ children, size: 16, font: 'Arial', color: GREY, ...o });
    return new Footer({ children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: 'A6A6A6', space: 8 } },
        tabStops: [{ type: TabStopType.RIGHT, position: width }],
        spacing: { before: 0, after: 0 },
        children: [
          run(['SYNAPXE PTE LTD   ']),
          run(['A wholly owned company of MOH Holdings Pte Ltd'], { italics: true })
        ]
      }),
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: width }],
        spacing: { before: 0, after: 0 },
        children: [run(['Reg No. 200814464H', new Tab(), PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES])]
      })
    ] });
  }
  // "8.1    Title......6" -> { level, num, title, page }
  function parseTocLine(line) {
    const m = line.match(/^\s*(.*?)\.{3,}\s*(\d+)\s*$/);
    if (!m) return { level: 3, title: line.trim() };
    const text = m[1].trim(), page = m[2];
    const n = text.match(/^(\d+(?:\.\d+)*)\s+(.*)$/);
    if (n) return { level: n[1].includes('.') ? 2 : 1, num: n[1], title: n[2], page };
    return { level: 3, title: text, page };
  }
  function tocParagraph(d, line) {
    const { Paragraph, TextRun, Tab, TabStopType, LeaderType } = d;
    const e = parseTocLine(line);
    const right = { type: TabStopType.RIGHT, position: TEXT_W, leader: LeaderType.DOT };
    const cfg = {
      1: { left: 0, tabs: [{ type: TabStopType.LEFT, position: 450 }, right], after: 135 },
      2: { left: 210, tabs: [{ type: TabStopType.LEFT, position: 885 }, right], after: 135 },
      3: { left: 450, tabs: [right], after: 115 }
    }[e.level];
    const kids = [];
    if (e.num) kids.push(e.num, new Tab());
    kids.push(e.title);
    if (e.page) kids.push(new Tab(), e.page);
    return new Paragraph({
      spacing: { before: 0, after: cfg.after },
      indent: { left: cfg.left },
      tabStops: cfg.tabs,
      children: [new TextRun({ children: kids, size: 20, font: 'Arial' })]
    });
  }
  // ---- Page 4: sections 1-7 (static template content) ----
  const BODY = 18; // 9pt
  const HEAD = 20; // 10pt
  const TABLE_SHADE = 'DCEEF4'; // light blue used for table header / label cells (pages 4 and 5)
  function heading(d, num, title, first, before) {
    const { Paragraph, TextRun, Tab } = d;
    return new Paragraph({
      pageBreakBefore: !!first,
      keepNext: true,
      spacing: { before: before ?? (first ? 0 : 520), after: 160 },
      indent: { left: 900, hanging: 710 },
      tabStops: [{ type: d.TabStopType.LEFT, position: 900 }],
      children: [new TextRun({ children: [num, new Tab(), title], bold: true, size: HEAD, font: 'Arial' })]
    });
  }
  function bullet(d, text, after = 0) {
    const { Paragraph, TextRun, Tab } = d;
    return new Paragraph({
      spacing: { before: 0, after },
      indent: { left: 1090, hanging: 360 },
      tabStops: [{ type: d.TabStopType.LEFT, position: 1090 }],
      children: [new TextRun({ children: ['\u25AA', new Tab(), text], size: BODY, font: 'Arial' })]
    });
  }
  function lettered(d, letter, text) {
    const { Paragraph, TextRun, Tab } = d;
    return new Paragraph({
      spacing: { before: 0, after: 0 },
      indent: { left: 1280, hanging: 380 },
      tabStops: [{ type: d.TabStopType.LEFT, position: 1280 }],
      children: [new TextRun({ children: [`(${letter})`, new Tab(), text], size: BODY, font: 'Arial' })]
    });
  }
  // cells: array of rows; each row an array of string | {link:string, url:string} | null (empty)
  function gridTable(d, widths, header, rows, opts = {}) {
    const { Table, TableRow, TableCell, Paragraph, TextRun, ExternalHyperlink, WidthType, ShadingType, BorderStyle, HeightRule } = d;
    const line = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const mkCell = (content, w, isHead) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      margins: { top: 30, bottom: 30, left: 80, right: 80 },
      shading: isHead ? { type: ShadingType.CLEAR, color: 'auto', fill: TABLE_SHADE } : undefined,
      children: [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: content == null ? [] : [
          typeof content === 'object'
            ? new ExternalHyperlink({
                link: content.url,
                children: [new TextRun({ text: content.link, size: BODY, font: 'Arial', color: '0563C1', underline: {} })]
              })
            : new TextRun({ text: content, size: BODY, font: 'Arial', bold: isHead, color: '000000' })]
      })]
    });
    const mkRow = (cells, isHead) => new TableRow({
      ...(isHead ? { tableHeader: true } : {}),
      height: { value: isHead ? 340 : 280, rule: HeightRule.ATLEAST },
      children: cells.map((c, i) => mkCell(c, widths[i], isHead))
    });
    return new Table({
      width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
      columnWidths: widths,
      borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: opts.noInnerVertical ? none : line },
      rows: [mkRow(header, true), ...rows.map(r => mkRow(r, false))]
    });
  }
  const lines = id => val(id).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const cols = splitCols;
  // Lines -> rows. Plain: "left | right". Link: "left | link text | URL" (text shown, URL embedded).
  // Without a URL the link text is shown as plain text. Pads with empty rows to minRows.
  function tableRows(id, asLink, minRows) {
    const rows = lines(id).map(l => {
      const [a, b = '', ...rest] = l.split('|').map(s => s.trim());
      const url = rest.join('|');
      let right = b || null;
      if (asLink && b && url) right = { link: b, url: /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}` };
      return [a || null, right];
    });
    while (rows.length < minRows) rows.push([null, null]);
    return rows;
  }
  function page4(d) {
    const half = [4513, 4513];
    return [
      heading(d, '1', 'PURPOSE OF THIS DOCUMENT', true),
      ...lines('purpose').map(t => bullet(d, t)),
      heading(d, '2', 'OBJECTIVES'),
      ...lines('objectives').map(t => bullet(d, t)),
      heading(d, '3', 'SCOPE'),
      bullet(d, val('scopeIntro')),
      ...lines('scopeItems').map((t, i) => lettered(d, String.fromCharCode(97 + i), t)),
      heading(d, '4', 'TERMS AND DEFINITIONS'),
      gridTable(d, [2370, 6656], ['Terms', 'Definitions'], tableRows('termsRows', false, 5), { noInnerVertical: true }),
      heading(d, '5', 'KEY COMPONENTS OF A SIGN OFF FORM'),
      gridTable(d, half, ['Key Components', 'References'], tableRows('keyRows', true, 2)),
      heading(d, '6', 'URL'),
      gridTable(d, half, ['Name', 'URL'], tableRows('urlRows', true, 3)),
      heading(d, '7', 'APPROACH'),
      new d.Paragraph({
        spacing: { before: 0, after: 0 },
        indent: { left: 730 },
        children: [new d.TextRun({ text: val('approach'), size: HEAD, font: 'Arial' })]
      })
    ];
  }
  // ---- Page 5: 8 ARTEFACTS / 8.1 Application In-Scope (form table) ----
  const tick = id => document.getElementById(id).checked ? '\u2612' : '\u2610'; // wizard checkbox -> \u2612 / \u2610
  // Checkbox group (by name) -> ["\u2612 value", "\u2610 value", ...]; text(id) reads a fixed label's text
  const ticks = name => [...document.querySelectorAll(`input[name="${name}"]`)].map(cb => `${cb.checked ? '\u2612' : '\u2610'} ${cb.value}`);
  const text = id => document.getElementById(id).textContent.trim();
  // parts: string | {muted:string} | {link:string, url:string}; opts: {left, after}
  function fpara(d, parts, opts = {}) {
    const { Paragraph, TextRun, ExternalHyperlink } = d;
    const run = (text, extra = {}) => new TextRun({ text, size: BODY, font: 'Arial', ...extra });
    const kids = parts.map(p => typeof p === 'string' ? run(p)
      : p.url ? new ExternalHyperlink({ link: p.url, children: [run(p.link, { color: '0563C1', underline: {} })] })
      : run(p.muted ?? p.link, { color: '7F7F7F' }));
    return new Paragraph({
      spacing: { before: 0, after: opts.after ?? 0 },
      indent: opts.left ? { left: opts.left } : undefined,
      children: kids
    });
  }
  function page5(d) {
    const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, ShadingType, BorderStyle, VerticalAlign } = d;
    const line = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const W = { label: 2250, value: 3500, sid: 1100, sidv: 2176 };
    const W_REST = W.value + W.sid + W.sidv;
    const cell = (paras, w, o = {}) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      columnSpan: o.span,
      verticalAlign: o.label ? VerticalAlign.CENTER : VerticalAlign.TOP,
      margins: { top: 70, bottom: 70, left: 80, right: 80 },
      shading: o.label ? { type: ShadingType.CLEAR, color: 'auto', fill: TABLE_SHADE } : undefined,
      children: paras
    });
    const label = text => cell([fpara(d, [text])], W.label, { label: true });
    const row = (name, paras) => new TableRow({ children: [label(name), cell(paras, W_REST, { span: 3 })] });
    const freqParas = ticks('freq').map(f => fpara(d, [f], { after: 200 }));
    if (val('frequencyOther')) freqParas.push(fpara(d, [{ muted: val('frequencyOther') }]));
    const table = new Table({
      width: { size: W.label + W_REST, type: WidthType.DXA },
      columnWidths: [W.label, W.value, W.sid, W.sidv],
      borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: none },
      rows: [
        new TableRow({ children: [
          label('Name of Maintenance'),
          cell([fpara(d, [val('systemName')])], W.value),
          cell([fpara(d, ['System ID'])], W.sid, { label: true }),
          cell([fpara(d, [val('systemId')])], W.sidv)
        ] }),
        row('BET Request ID', [fpara(d, [val('betRequestId')])]),
        row('System Criticality', [fpara(d, [ticks('criticality').join('     ')])]),
        row('Internet Facing Apps', [
          fpara(d, [`${tick('inetYes')} Yes`]),
          fpara(d, [`${tick('inetNote')} ${text('inetNoteText')}`], { left: 330, after: 200 }),
          fpara(d, [`${tick('inetNo')} No`])
        ]),
        row('Managed by', [
          fpara(d, [ticks('managed').join('     ')], { after: 200 }),
          fpara(d, [`${tick('managedNote')} ${text('managedNoteText')}`])
        ]),
        row('Frequency of Application Monitoring (Preventive)', freqParas),
        row('Declaration', [fpara(d, [`${tick('declChk')} ${text('declChkText')}`])])
      ]
    });
    return [
      heading(d, '8', 'ARTEFACTS', true),
      heading(d, '8.1', 'Application In-Scope', false, 120),
      new Paragraph({ spacing: { before: 0, after: 240 }, children: [] }),
      table
    ];
  }
  // ---- Page 6: 8.2 Capture of Artefacts / Data Points (data dictionary table) ----
  // Cell text syntax: ";;" starts a new paragraph (blank between ";;" = empty line), "- " prefix = bullet,
  // **bold**, ^superscript^.
  // Also supports __underline__; markers can nest, e.g. **bold with __underline__ inside**.
  function rich(d, text, extra = {}) {
    const { TextRun, ExternalHyperlink } = d;
    return text.split(/(\*\*.+?\*\*|__.+?__|~~.+?~~|==.+?==|\/\/.+?\/\/|\{\{.+?\}\}|\[\[.+?\]\]|\^.+?\^)/).filter(s => s !== '').flatMap(s =>
      s.startsWith('**') ? rich(d, s.slice(2, -2), { ...extra, bold: true })
      : s.startsWith('__') ? rich(d, s.slice(2, -2), { ...extra, underline: {} })
      : s.startsWith('~~') ? rich(d, s.slice(2, -2), { ...extra, color: 'FF0000' })
      : s.startsWith('==') ? rich(d, s.slice(2, -2), { ...extra, highlight: 'yellow' })
      : s.startsWith('//') ? rich(d, s.slice(2, -2), { ...extra, italics: true })
      : s.startsWith('{{') ? rich(d, s.slice(2, -2), { ...extra, color: '808080' })
      : s.startsWith('[[') ? (() => { const inner = s.slice(2, -2); const bar = inner.indexOf('|'); const txt = bar >= 0 ? inner.slice(0, bar) : inner; const url = bar >= 0 ? inner.slice(bar + 1) : '#'; return [new ExternalHyperlink({ link: url, children: [new TextRun({ text: txt, color: '0563C1', underline: {}, size: BODY, font: 'Arial', ...extra })] })]; })()
      : s.startsWith('^') ? [new TextRun({ text: s.slice(1, -1), superScript: true, size: BODY, font: 'Arial', ...extra })]
      : [new TextRun({ text: s, size: BODY, font: 'Arial', ...extra })]);
  }
  // run: optional extra TextRun options for every run (e.g. { size: 14 } for 7pt text)
  function cellParas(d, text, align, run = {}) {
    const { Paragraph, TextRun, Tab, TabStopType, BorderStyle } = d;
    // A part that is exactly "---" draws a signature line (bottom-bordered empty paragraph).
    return text.split(';;').map(s => s.trim()).map(s => s === '---'
      ? new Paragraph({
          spacing: { before: 0, after: 60 },
          indent: { right: 3600 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 1 } },
          children: []
        })
      : s.startsWith('- ')
      ? new Paragraph({
          spacing: { before: 0, after: 0 },
          indent: { left: 360, hanging: 280 },
          tabStops: [{ type: TabStopType.LEFT, position: 360 }],
          children: [new TextRun({ children: ['\u2022', new Tab()], size: BODY, font: 'Arial', ...run }), ...rich(d, s.slice(2), run)]
        })
      : new Paragraph({ alignment: align, spacing: { before: 0, after: 0 }, children: rich(d, s, run) }));
  }
  function page6(d) {
    const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, ShadingType, BorderStyle, AlignmentType } = d;
    const line = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
    const W = [2130, 4210, 2686];
    const cell = (paras, w, o = {}) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      columnSpan: o.span,
      rowSpan: o.rowSpan,
      ...(o.borders ? { borders: o.borders } : {}),
      margins: { top: o.pad ?? 50, bottom: o.pad ?? 50, left: 80, right: 80 },
      shading: o.shade ? { type: ShadingType.CLEAR, color: 'auto', fill: TABLE_SHADE } : undefined,
      children: paras
    });
    const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const bold = text => [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text, bold: true, size: BODY, font: 'Arial' })] })];
    const J = AlignmentType.JUSTIFIED;
    const dataRow = l => {
      const [a = '', b = '', c = ''] = l.split('|').map(s => s.trim());
      return new TableRow({ children: [
        cell(cellParas(d, a), W[0]), cell(cellParas(d, b, J), W[1]), cell(cellParas(d, c), W[2])
      ] });
    };
    const healthDescs = lines('healthDescs');
    const healthRows = healthDescs.map((desc, i) => new TableRow({ children: [
      ...(i === 0 ? [cell(cellParas(d, val('healthField')), W[0], { rowSpan: healthDescs.length })] : []),
      cell(cellParas(d, desc, J), W[1]),
      ...(i === 0 ? [cell(cellParas(d, val('healthSample')), W[2], { rowSpan: healthDescs.length })] : [])
    ] }));
    const table = new Table({
      width: { size: W[0] + W[1] + W[2], type: WidthType.DXA },
      columnWidths: W,
      borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
      rows: [
        new TableRow({ children: [
          cell(bold(val('colField')), W[0], { shade: true }),
          cell(bold(val('colDesc')), W[1], { shade: true }),
          cell(bold(val('colSample')), W[2], { shade: true })
        ] }),
        new TableRow({ children: [cell(bold(val('sectionRow')), W[0] + W[1] + W[2], { span: 3, shade: true })] }),
        ...lines('rowsA').map(dataRow),
        ...healthRows,
        ...lines('rowsB').map(dataRow)
      ]
    });
    return [
      heading(d, '8.2', val('section82Title'), true),
      new Paragraph({
        keepNext: true,
        spacing: { before: 200, after: 200 },
        indent: { left: 190 },
        children: [new TextRun({ text: val('dataPointsTitle'), bold: true, size: HEAD, font: 'Arial', color: '2F5496' })]
      }),
      table
    ];
  }
  // ---- Page 8 (landscape): warning box + Section 1: Health Check introduction ----
  const LAND_MARGIN_X = 1140, LAND_TEXT_W = PAGE_H - 2 * LAND_MARGIN_X;
  function page7(d) {
    const { Paragraph, TextRun, AlignmentType, BorderStyle } = d;
    const edge = { style: BorderStyle.DASHED, size: 12, color: 'FF0000', space: 6 };
    const box = { top: edge, bottom: edge, left: edge, right: edge };
    const boxPara = (children, after) => new Paragraph({
      alignment: AlignmentType.CENTER, border: box, spacing: { before: 0, after }, children
    });
    const boldRun = (text, extra = {}) => new TextRun({ text, bold: true, size: HEAD + 2, font: 'Arial', ...extra }); // 11 pt
    return [
      boxPara([boldRun(val('warnMain'))], 0),
      boxPara([boldRun(`${tick('warnCheck')} `), boldRun(text('warnCheckText'), { color: 'FF0000' })], 360),
      boxPara([boldRun(val('warnEscalate'))], 0)
    ];
  }
  // ---- Landscape page: Section 1.0 Application-specific SOP (banner, notes, 1.1 status, document table, declaration) ----
  // sopDocs rows: SN | Document Name | Document Link | Version | "up to date" answer | "using template" answer (answers are dropdowns).
  function page8(d) {
    const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, VerticalAlign, Tab, TabStopType } = d;
    const black = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
    const grey = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const TEAL = '31849B', NAVY = '1F3864', LIGHT = 'DAEEF3', GREEN = '00B050', ORANGE = 'ED7D31';
    const C = AlignmentType.CENTER, J = AlignmentType.JUSTIFIED;
    const p = (text, o = {}) => new Paragraph({
      alignment: o.align, indent: o.indent, spacing: { before: o.before ?? 0, after: o.after ?? 0 },
      children: rich(d, text, o.run || {})
    });
    const cell = (children, w, o = {}) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      columnSpan: o.span, rowSpan: o.rowSpan, borders: o.borders,
      verticalAlign: o.vcenter ? VerticalAlign.CENTER : VerticalAlign.TOP,
      margins: { top: o.pad ?? 60, bottom: o.pad ?? 60, left: 100, right: 100 },
      shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
      children: Array.isArray(children) ? children : cellParas(d, children, o.align)
    });
    const table = (W, rows, borders) => new Table({
      width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: W, borders, rows
    });
    const box = (id, textId) => p(`${tick(id)} ${text(textId)}`, { align: J });

    // Section banner: teal bar with white bold title and a dark rule underneath
    const banner = table([LAND_TEXT_W], [new TableRow({ children: [
      cell([p(val('sopTitle'), { run: { bold: true, color: 'FFFFFF', size: HEAD } })], LAND_TEXT_W, { fill: TEAL, vcenter: true, pad: 120 })
    ] })], { top: none, left: none, right: none, bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000' }, insideHorizontal: none, insideVertical: none });

    // "Application teams to note" + bullets (bold lead-in written with **...**)
    const bullets = lines('sopBullets').map((b, i, all) => new Paragraph({
      alignment: J, spacing: { before: 0, after: i === all.length - 1 ? 0 : 200 },
      indent: { left: 360, hanging: 360 }, tabStops: [{ type: TabStopType.LEFT, position: 360 }],
      children: [new TextRun({ children: ['•', new Tab()], size: BODY, font: 'Arial' }), ...rich(d, b)]
    }));

    // Section 1.1: navy title block | Completed / Not Applicable | checkbox options
    const SW = [5165, 1330, 8063];
    const status = (label, color) => [p(label, { align: C, run: { bold: true, color, size: HEAD } })];
    const s11 = table(SW, [
      new TableRow({ children: [
        cell([p(val('sop11Title'), { run: { bold: true, color: 'FFFFFF', size: HEAD } })], SW[0], { fill: NAVY, rowSpan: 3, pad: 120 }),
        cell(status(val('sopCompleted'), GREEN), SW[1], { rowSpan: 2, vcenter: true }),
        cell([box('sopOptDoc', 'sopOptDocText')], SW[2])
      ] }),
      new TableRow({ children: [cell([box('sopOptWorking', 'sopOptWorkingText')], SW[2])] }),
      new TableRow({ children: [
        cell(status(val('sopNA'), ORANGE), SW[1], { vcenter: true }),
        cell([box('sopOptNA', 'sopOptNAText')], SW[2])
      ] })
    ], { top: none, bottom: none, left: none, right: none, insideHorizontal: grey, insideVertical: grey });

    // Document table: SN | Name | Link | Version span both checklist rows of each document
    const DW = [500, 1645, 3130, 1205, 3555, 4523];
    const H = lines('sopHeaders');
    const noLeft = { left: none }, noRight = { right: none };
    // Two fixed checklist questions per document; each answer is the row's dropdown value (c[4], c[5])
    const questions = [
      'Is the document up to date?',
      'Are you using [[Synapxe document template?|https://policy.intranet.synapxe/Pages/default.aspx]]'
    ];
    const docRows = lines('sopDocs').flatMap(l => {
      const c = splitCols(l);
      return questions.map((q, i) => new TableRow({ cantSplit: true, children: [
        ...(i === 0 ? [
          cell(c[0] || '', DW[0], { rowSpan: questions.length, align: C }),
          cell(c[1] || '', DW[1], { rowSpan: questions.length }),
          cell(c[2] || '', DW[2], { rowSpan: questions.length, borders: noRight }),
          cell(c[3] || '', DW[3], { rowSpan: questions.length, borders: noLeft })
        ] : []),
        cell(q, DW[4], { vcenter: true }),
        // "Choose an item." stays the grey placeholder; a real choice prints as plain text
        cell(c[4 + i] || '{{Choose an item.}}', DW[5], { vcenter: true })
      ] }));
    });
    const docTable = table(DW, [
      new TableRow({ tableHeader: true, children: [
        cell(H[0] || '', DW[0], { fill: LIGHT }),
        cell(H[1] || '', DW[1], { fill: LIGHT }),
        cell(H[2] || '', DW[2], { fill: LIGHT, borders: noRight }),
        cell(H[3] || '', DW[3], { fill: LIGHT, borders: noLeft, align: AlignmentType.RIGHT }),
        cell(H[4] || '', DW[4], { fill: LIGHT, borders: noRight }),
        cell(H[5] || '', DW[5], { fill: LIGHT, borders: noLeft, align: C })
      ] }),
      ...docRows
    ], { top: none, bottom: black, left: none, right: none, insideHorizontal: black, insideVertical: black });

    // Declaration: shaded label | intro line spanning, then checkbox text | attachment note
    const XW = [1380, 9780, 3398];
    const decl = table(XW, [
      new TableRow({ cantSplit: true, children: [
        cell(val('sopDeclLabel'), XW[0], { fill: LIGHT, rowSpan: 2, vcenter: true }),
        cell(val('sopDeclIntro'), XW[1] + XW[2], { span: 2 })
      ] }),
      new TableRow({ children: [
        cell([p(`${tick('sopDeclChk')} ${document.getElementById('sopDeclChkText').dataset.rich}`, { align: J, indent: { left: 360 }, before: 120, after: 120 })], XW[1], { vcenter: true }),
        cell(val('sopDeclAttach'), XW[2], { vcenter: true, align: C })
      ] })
    ], { top: black, bottom: black, left: none, right: none, insideHorizontal: black, insideVertical: black });

    return [
      new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0, line: 20 }, children: [new TextRun({ text: '', size: 2 })] }),
      banner,
      p(val('sopNoteHead'), { before: 160, run: { highlight: 'yellow' } }),
      ...bullets,
      new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }),
      s11,
      new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }),
      docTable,
      new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }),
      decl
    ];
  }
  // ---- Landscape page: Section 2.0 Health Check banner, intro paragraphs and log-review frequency illustration table ----
  // freqRows: Frequency | Logs to review | Period | Duration
  function pageHealth(d) {
    const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, VerticalAlign } = d;
    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const edge = { style: BorderStyle.SINGLE, size: 4, color: '95B3D7' };
    const TEAL = '31849B', BLUE = '4F81BD', YELLOW = 'FFFF00', FREQ_FILL = 'B8CCE4';
    const C = AlignmentType.CENTER, J = AlignmentType.JUSTIFIED;
    const W = [1450, 3200, 2350, 3950, 3608]; // sums to LAND_TEXT_W = 14558
    const para = (text, o = {}) => new Paragraph({
      alignment: o.align, spacing: { before: 0, after: 0 },
      children: rich(d, text, o.run || {})
    });
    const cell = (text, w, o = {}) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      columnSpan: o.span, rowSpan: o.rowSpan,
      verticalAlign: o.vcenter ? VerticalAlign.CENTER : VerticalAlign.TOP,
      margins: { top: o.pad ?? 50, bottom: o.pad ?? 50, left: 80, right: 80 },
      shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
      children: [para(text, o)]
    });
    const head = (text, w, o = {}) => cell(text, w, { fill: BLUE, vcenter: true, run: { bold: true, color: 'FFFFFF', size: HEAD }, ...o });
    const sub = (text, w) => cell(text, w, { fill: YELLOW, vcenter: true, align: C, run: { bold: true, size: HEAD } });
    const tableOf = (W, rows, borders) => new Table({
      width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: W, borders, rows
    });

    // Teal section banner with a dark rule underneath (same style as the Section 1.0 page)
    const banner = tableOf([LAND_TEXT_W], [new TableRow({ children: [
      cell(val('healthTitle'), LAND_TEXT_W, { fill: TEAL, vcenter: true, pad: 120, run: { bold: true, color: 'FFFFFF', size: HEAD } })
    ] })], { top: none, left: none, right: none, bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000' }, insideHorizontal: none, insideVertical: none });

    const data = lines('freqRows').map(l => l.split('|').map(s => s.trim()));
    const dataRows = data.map(([f = '', logs = '', period = '', dur = ''], i) => new TableRow({ children: [
      cell(f, W[0], { fill: FREQ_FILL, run: { bold: true, size: HEAD } }),
      cell(logs, W[1], { align: J, run: { size: HEAD } }),
      cell(period, W[2], { align: C, run: { size: HEAD } }),
      cell(dur, W[3], { align: C, run: { size: HEAD } }),
      ...(i === 0 ? [cell(val('freqRemark'), W[4], { rowSpan: data.length, vcenter: true, run: { size: HEAD } })] : [])
    ] }));
    const table = tableOf(W, [
      new TableRow({ children: [
        head(val('colFreq'), W[0], { rowSpan: 2 }),
        head(val('colLogs'), W[1], { rowSpan: 2 }),
        head(val('colIllus'), W[2] + W[3] + W[4], { span: 3, align: C })
      ] }),
      new TableRow({ children: [sub(val('colPeriod'), W[2]), sub(val('colDuration'), W[3]), sub(val('colRemark'), W[4])] }),
      ...dataRows
    ], { top: edge, bottom: edge, left: edge, right: edge, insideHorizontal: edge, insideVertical: edge });

    const body = id => new Paragraph({ alignment: J, spacing: { before: 0, after: 240 }, children: rich(d, val(id), { size: HEAD }) });
    return [
      new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0, line: 20 }, children: [new TextRun({ text: '', size: 2 })] }),
      banner,
      new Paragraph({ spacing: { before: 0, after: 240 }, children: [] }),
      body('healthPara1'),
      body('healthPara2'),
      body('freqIntro'),
      table
    ];
  }
  // ---- Pages 10-11 (landscape): Date of Execution box + A. Essential health-check table + footnotes ----
  // Row syntax (execRows): SN | Means | Name/Location | Server(s) | Health Status | Remark | No errors tick (x) | Errors found tick (x) |
  //   Errors text | ServiceNow ticket number | Duration From | Duration To   (yyyy-MM-ddTHH:mm, printed as dd MMMM yyyy HH:mm)
  //   A row with an empty SN continues the previous SN (the SN cell spans both rows).
  //   Every row gets the standard "errors found" choice block and the stacked artefact block.
  // Markers: **bold** __underline__ ~~red~~ //italic// ==highlight== {{grey placeholder}} [[blue link]] ^superscript^ ;; new paragraph - bullet
  // Shared cell / artefact-block helpers for the landscape execution tables (pages 10-12)
  function execKit(d) {
    const { Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, VerticalAlign } = d;
    const line  = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
    const tline = { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' };
    const HEAD_FILL = 'B7DEE8', LABEL_FILL = 'DCEEF4', GREY_FILL = 'D9D9D9';
    // Column widths must sum to LAND_TEXT_W = 14558 (batch job table, page 12)
    // SN | Name | Path | Server(s) | Errors | Escalated | HealthStatus | Remark | Artefact
    const W = [380, 1900, 1650, 1500, 880, 2008, 1500, 2000, 2740];
    const C = AlignmentType.CENTER;
    // Main outer-table cell
    const cell = (paras, w, o = {}) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      margins: { top: 50, bottom: 50, left: 80, right: 80 },
      verticalAlign: o.vcenter ? VerticalAlign.CENTER : VerticalAlign.TOP,
      rowSpan: o.rowSpan,
      columnSpan: o.span,
      borders: o.borders,
      shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
      children: Array.isArray(paras) ? paras : cellParas(d, paras, o.align, o.run)
    });
    // Inner artefact sub-table cell
    // AW[0]+AW[1] must fit inside the artefact cell (cell width - 2*80 margins)
    const AW = [680, 1900];
    const artBorders = { top: tline, bottom: tline, left: tline, right: tline, insideHorizontal: tline, insideVertical: tline };
    const tcell = (text, w, o = {}) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      columnSpan: w === AW[0] + AW[1] ? 2 : undefined,
      margins: { top: 30, bottom: 30, left: 60, right: 60 },
      shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
      children: cellParas(d, text, o.align, o.run)
    });
    function artTable(rows) {
      return new Table({
        width: { size: AW[0] + AW[1], type: WidthType.DXA },
        columnWidths: AW,
        borders: artBorders,
        rows
      });
    }
    // Duration header row: shaded, full-width label
    function durationHeader(mark = '*a,b') {
      return new TableRow({ children: [tcell(`**Duration of Entries Reviewed**^${mark}^`, AW[0] + AW[1], { fill: HEAD_FILL })] });
    }
    const fromTo = (run, from = '{{Eg.01 March 2025 0000}}', to = '{{Eg.01 March 2025 2359}}') => [
      new TableRow({ children: [tcell('**From**', AW[0], { run }), tcell(from, AW[1], { run })] }),
      new TableRow({ children: [tcell('**To**', AW[0], { run }), tcell(to, AW[1], { run })] })
    ];
    // Artefact block for the batch job table: Attachment | placeholder, shaded duration header, From / To
    function artShort(mark, from, to) {
      return artTable([
        new TableRow({ children: [tcell('__Attachment__', AW[0], { align: C }), tcell('{{<<Attach Artefact Here>>}}', AW[1])] }),
        durationHeader(mark),
        ...fromTo(undefined, from, to)
      ]);
    }
    // Artefact block for the health-check table: centred Attachment title, placeholder, duration label, From / To
    function artStacked(mark, run, from, to) {
      const full = AW[0] + AW[1];
      return artTable([
        new TableRow({ children: [tcell('**__Attachment__**', full, { align: C, run })] }),
        new TableRow({ children: [tcell('{{<<Attach Artefact Here>>}}', full, { align: C, run })] }),
        new TableRow({ children: [tcell(`**Duration of Entries Reviewed**^${mark}^`, full, { align: C, run })] }),
        ...fromTo(run, from, to)
      ]);
    }
    // "Any Application Errors found in logs" block, shared by the health-check and batch job tables:
    // ☐ No errors found / ☐ Errors found + ticket text / ServiceNow Ticket No + number.
    // opts: noTick / errTick ("x" = ticked), errText, ticket; run = text size options (e.g. { size: 14 })
    const GREEN_FILL = 'EBF1DE', PINK_FILL = 'F2DCDB';
    function errBlock(opts, run) {
      const { Paragraph, TextRun } = d;
      const EW = [890, 1701];
      const ecell = (children, w, fill) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
        children
      });
      const r = (text, o = {}) => new TextRun({ text, size: (run && run.size) || BODY, font: 'Arial', ...o });
      const p = (children, align) => new Paragraph({ alignment: align, children });
      const mark = v => (v || '').trim() ? '☒' : '☐';
      return new Table({
        width: { size: EW[0] + EW[1], type: WidthType.DXA },
        columnWidths: EW,
        borders: { top: tline, bottom: tline, left: tline, right: tline, insideHorizontal: tline, insideVertical: tline },
        rows: [
          new TableRow({ children: [
            ecell([p([r(mark(opts.noTick), { size: 24 })], C)], EW[0], GREEN_FILL),
            ecell([p([r('No errors found.', { bold: true, color: '00B050' })])], EW[1])
          ] }),
          new TableRow({ children: [
            ecell([p([r(mark(opts.errTick), { size: 24 })], C)], EW[0], PINK_FILL),
            ecell([p([r('Errors found.', { bold: true, color: 'FF0000' }), r(' ' + (opts.errText || ''))])], EW[1])
          ] }),
          new TableRow({ children: [
            ecell([p([r('ServiceNow Ticket No', { bold: true })], C)], EW[0], PINK_FILL),
            ecell([p(opts.ticket ? [r(opts.ticket)] : [])], EW[1])
          ] })
        ]
      });
    }
    return { line, HEAD_FILL, LABEL_FILL, GREY_FILL, W, cell, artShort, artStacked, errBlock };
  }
  function page9(d) {
    const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, VerticalAlign } = d;
    const { line, HEAD_FILL, LABEL_FILL, cell, artStacked, errBlock } = execKit(d);
    const C = AlignmentType.CENTER, J = AlignmentType.JUSTIFIED;
    const grey = { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' };
    // SN | Means | Name/Location | Server(s) | Errors found | Health Status | Remark | Artefact  (sums to LAND_TEXT_W = 14558)
    const W = [537, 1409, 1369, 2013, 2751, 1584, 2107, 2788];
    const SMALL = { size: 14 }; // 7pt, as in the source table

    // Date of Execution box: shaded label | white value (no right edge, as in the source)
    const noEdge = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const box = new Table({
      width: { size: 4600, type: WidthType.DXA },
      columnWidths: [2200, 2400],
      borders: { top: line, bottom: line, left: line, right: noEdge, insideHorizontal: line, insideVertical: line },
      rows: [new TableRow({ children: [
        cell([new Paragraph({ children: rich(d, '**Date of Execution**', { size: 22 }) })], 2200, { fill: HEAD_FILL, vcenter: true }),
        // Date of Execution comes from the date picker (yyyy-MM-dd -> dd/MM/yyyy); an unset picker keeps the grey placeholder
        cell([new Paragraph({ children: rich(d, fmtDate(val('execValue')) || '{{Enter a date}}', { size: 22 }) })], 2400, { vcenter: true })
      ]})]
    });

    // Header row: one row, all headings centred
    const headers = ["**SN**","**Means**;; ;;~~**__Note:__**~~;;~~//Refer to//~~;;~~==__Preventive Monitoring Guide for Application Log__==~~;;~~//diagram in AOPG main page under Monitoring (Preventive)//~~","**Name / Location**;; ;;~~Input \"N/A\" if the Means is not applicable.~~;;~~__Note:__~~;;~~Any additional Means can be recorded in Section C~~","**Server(s) / Component(s)**;; ;;~~Input \"N/A\" if the \"Means\" field is empty.~~","**Any Application Errors found in logs**;; ;;~~Ticket must be created in ServiceNow.~~","**Health Status**;;- Good (No Error Found);;- Fair (Minor Errors Found);;- Bad (Errors Found);;- Unknown","**Remark**;; ;;~~Quality rating would reflect accordingly if the status stated (e.g. errors found or health status) **__is deviated__** from what is found in the artefacts.~~;; ;;~~Provide input in **Remark** if \"Means\" field is stated as \"N/A\" (Not Applicable)~~","**Artefact(s)**;; ;;~~Please provide error details in Section D if error is found~~;; ;;**Duration of Entries Captured in the Logs for Review**^#A4^"];
    // Header row appears once, on the first page only (not repeated on continuation pages)
    const hdrRow = new TableRow({ children: W.map((w, i) =>
      cell(headers[i] || '', w, { fill: HEAD_FILL, align: C, run: SMALL })) });

    // Name / Location: the chosen value (or the grey placeholder) followed by the fixed red note; an empty value leaves the cell empty
    const nameLoc = v => v ? `${v};; ;;~~If Dynatrace is not used for monitoring, provide reasons in "Remark" column, and proceed to use app log files as your mean to analyse~~` : '';
    // Data rows; an empty SN merges into the SN cell above
    // Means text per row, fixed (by row position); rows added in the wizard get an empty Means cell
    const MEANS = [
      "**Application Logs**^#1^;;//Identify errors or exceptions for follow-up//;; ;;~~**Top 3**~~ errors or exceptions of;;**Data Processing Errors** determined by FA",
      "**Application Logs**^#1^;;//Identify errors or exceptions for follow-up//;; ;;~~**Top 3**~~ errors or exceptions of;;**Connectivity Failures** determined by FA",
      "**[[Dynatrace – Problem Alerts|https://apm-prod.healthgrp.com.sg/e/719e4dbc-e68d-4817-b532-1451d4d39554/ui/problems?gtf=p_159923042909647161_1617087360000V2&gf=all]]**^#2^;; ;;~~**Top 3**~~ problems determined by FA",
      "**Interface Logs**;;//Log all application interface-related errors or exceptions//;; ;;~~**Top 3**~~ errors or exceptions of;;**Data Processing Errors** determined by FA",
      "**Interface Logs**;;//Log all application interface-related errors or exceptions//;; ;;~~**Top 3**~~ errors or exceptions of;;**Connectivity Failures** determined by FA",
      "**DB Replication, where DB is managed by vendor**^#3^;; ;;//Confirm DB replication process is successfully completed//"
    ];
    const parsed = lines('execRows').map(cols);
    const spans = parsed.map((c, i) => {
      if (!c[0] && i > 0) return 0;
      let n = 1; while (i + n < parsed.length && !parsed[i + n][0]) n++;
      return n;
    });
    const dataRows = parsed.map((c, i) => new TableRow({ cantSplit: true, children: [
      ...(spans[i] ? [cell(c[0] || '', W[0], { rowSpan: spans[i], vcenter: true, run: SMALL })] : []),
      cell(MEANS[i] || '', W[1], { align: C, run: SMALL }),
      cell(nameLoc(c[1]), W[2], { align: C, run: SMALL }),
      cell(c[2] || '', W[3], { run: SMALL }),
      cell([errBlock({ noTick: c[5], errTick: c[6], errText: "ServiceNow ticket has been raised for internal tracking and assigned to the appropriate action party.", ticket: c[7] }, SMALL)], W[4]),
      cell(c[3] || '', W[5], { vcenter: true, run: SMALL }),
      cell(c[4] || '', W[6], { vcenter: true, run: SMALL }),
      // Duration From / To come from the date-time pickers; an unset picker keeps the grey example text
      cell([artStacked('#A4', SMALL,
        c[8] ? fmtDateTime(c[8]) : undefined,
        c[9] ? fmtDateTime(c[9]) : undefined)], W[7])
    ] }));

    const table = new Table({
      width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA },
      columnWidths: W,
      borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
      rows: [hdrRow, ...dataRows]
    });
    return [
      new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0, line: 20 }, children: [new TextRun({ text: '', size: 2 })] }),
      box,
      new Paragraph({ alignment: J, indent: { left: 720, hanging: 360 }, spacing: { before: 240, after: 200 }, children: rich(d, "A. **Essential:** The following health checks need to be performed, which is to ensure that any errors in application logs do not go unnoticed and problems captured covers key areas of application issues.", { size: HEAD }) }),
      table,
      // Footnotes as one tight block directly under the table; keepNext holds the block together on one page
      ...["^#1^: //For applications that do not have application log, please provide any equivalent means that serves similar purpose where information of application errors can be found.//","^#2^: //For applications that do not have Dynatrace installed, please provide other means that meets similar purpose where performance anomalies in your applications, services, and infrastructure such as such as performance degradations, improper functionality, or lack of availability, can be detected.//","^#3^: //DAM alert monitoring is NOT part of Application Monitoring (Preventive) activities.//","^#A4^: //Additional fields are added due to Audit Findings across multiple apps. Application team to ensure you are clear of the meaning of the fields and update appropriately.//"].map((n, i, all) => new Paragraph({ keepNext: i < all.length - 1, keepLines: true, spacing: { before: 0, after: 0 }, children: rich(d, n) }))
    ];
  }
  // ---- Page 12 (landscape): B. Essential batch-job / scheduled-job checks table + footnotes ----
  // Row syntax (batchRows): SN | Name of Batch Job | Logs File Path | Server(s) | Health Status | Remark | No errors tick (x) |
  //   Errors found tick (x) | Errors text | ServiceNow ticket number | Duration From | Duration To   (yyyy-MM-ddTHH:mm)
  // Every row gets the shared "errors found" block and the stacked artefact block.
  function page10(d) {
    const { Paragraph, Table, TableRow, WidthType, AlignmentType } = d;
    const { line, HEAD_FILL, cell, artStacked, errBlock } = execKit(d);
    const C = AlignmentType.CENTER, J = AlignmentType.JUSTIFIED;
    const SMALL = { size: 14 }; // 7pt, as in the source table
    // SN | Name | Logs path | Server(s) | Errors found | Health Status | Remark | Artefact  (sums to LAND_TEXT_W = 14558)
    const W = [450, 1500, 1650, 1900, 2751, 1650, 2107, 2550];
    const headers = ["**SN**","**Name of Batch Job**","**Batch Job Logs File Path**","**Server(s) / Component(s)**;; ;;~~Input \"N/A\" if the \"Name of Batch Job\" field is empty.~~","**Any Application Errors found in logs**;; ;;~~Ticket must be created in ServiceNow.~~","**Health Status**;;- Good (No Error Found);;- Fair (Minor Errors Found);;- Bad (Errors Found);;- Unknown","**Remark**;; ;;~~Quality rating would reflect accordingly if the status stated (e.g. errors found or health status) **__is deviated__** from what is found in the artefacts.~~;; ;;~~Provide input in **Remark** if Batch Job is stated as \"N/A\" (Not Applicable)~~","**Artefact(s)**;; ;;~~Please provide error details in Section C if error is found~~;; ;;**Duration of Entries Captured in the Logs for Review**^#A4^"];
    // Header row appears once, on the first page only
    const hdrRow = new TableRow({ children: W.map((w, i) =>
      cell(headers[i] || '', w, { fill: HEAD_FILL, align: C, run: SMALL })) });
    const dataRows = lines('batchRows').map(l => {
      const c = cols(l);
      return new TableRow({ cantSplit: true, children: [
        cell(c[0] || '', W[0], { vcenter: true, run: SMALL }),
        cell(c[1] || '', W[1], { vcenter: true, run: SMALL }),
        cell(c[2] || '', W[2], { vcenter: true, run: SMALL }),
        cell(c[3] || '', W[3], { vcenter: true, run: SMALL }),
        cell([errBlock({ noTick: c[6], errTick: c[7], errText: 'ServiceNow ticket has been raised for internal tracking and assigned to the appropriate action party.', ticket: c[8] }, SMALL)], W[4]),
        cell(c[4] || '', W[5], { vcenter: true, run: SMALL }),
        cell(c[5] || '', W[6], { vcenter: true, run: SMALL }),
        // Duration From / To come from the date-time pickers; an unset picker keeps the grey example text
        cell([artStacked("#A4", SMALL,
          c[9] ? fmtDateTime(c[9]) : undefined,
          c[10] ? fmtDateTime(c[10]) : undefined)], W[7])
      ] });
    });
    const table = new Table({
      width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA },
      columnWidths: W,
      borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
      rows: [hdrRow, ...dataRows]
    });
    return [
      new Paragraph({ pageBreakBefore: true, alignment: J, indent: { left: 720, hanging: 360 }, spacing: { before: 0, after: 200 }, children: rich(d, "B. **Essential:** The following **__Batch Jobs__** and **__Scheduled Jobs__** check is to ensure that **__all logs__** are monitored closely so that no errors or exceptions go unnoticed.", { size: HEAD }) }),
      new Paragraph({ indent: { left: 720 }, spacing: { before: 0, after: 200 }, children: rich(d, "**Please note** for all application interface-related errors or exceptions, details to be captured in \"Section A – Interface Logs\"", { size: HEAD }) }),
      table,
      // Footnotes as one tight block directly under the table
      ...['^#A4^: //Additional fields are added due to Audit Findings across multiple apps. Application team to ensure you are clear of the meaning of the fields and update appropriately.//']
        .map((n, i, all) => new Paragraph({ keepNext: i < all.length - 1, keepLines: true, spacing: { before: 0, after: 0 }, children: rich(d, n) }))
    ];
  }
  // ---- Page 16 (landscape): Section 3.0 – Declaration for use of EVMS tool(s) ----
  // Tool choices (evmsTools): Tenable, NGESS, AWS Inspector and "Others, <Please Specify>" each have a wizard checkbox.
  function page12(d) {
    const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, VerticalAlign } = d;
    const { line, LABEL_FILL } = execKit(d);
    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const lite = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
    const TEAL = '31849B';
    const J = AlignmentType.JUSTIFIED, C = AlignmentType.CENTER;
    const p = (text, o = {}) => new Paragraph({
      alignment: o.align, indent: o.indent, spacing: { before: o.before ?? 0, after: o.after ?? 0 },
      children: rich(d, text, o.run || {})
    });
    const cell = (children, w, o = {}) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      columnSpan: o.span, rowSpan: o.rowSpan, borders: o.borders,
      verticalAlign: o.vcenter ? VerticalAlign.CENTER : VerticalAlign.TOP,
      margins: { top: o.pad ?? 80, bottom: o.pad ?? 80, left: 100, right: 100 },
      shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
      children
    });
    const tableOf = (W, rows, borders) => new Table({
      width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: W, borders, rows
    });

    // Teal section banner with a dark rule underneath (same style as the other section pages)
    const banner = tableOf([LAND_TEXT_W], [new TableRow({ children: [
      cell([p('Section 3.0: Declaration for Use of Enterprise Vulnerability Management System (EVMS) Tool', { run: { bold: true, color: 'FFFFFF', size: HEAD } })], LAND_TEXT_W, { fill: TEAL, vcenter: true, pad: 120 })
    ] })], { top: none, left: none, right: none, bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000' }, insideHorizontal: none, insideVertical: none });

    // Declaration table: shaded label | option label | text. Option 1 lists the tools as indented checkboxes; option 2 carries an attachment note.
    const W = [1650, 1650, 8350, 2908]; // sums to LAND_TEXT_W = 14558
    const sub = (id, label, extra = '') => p(`${tick(id)} ${label}${extra}`, { indent: { left: 720 }, after: 60 });
    const decl = tableOf(W, [
      new TableRow({ children: [
        cell(cellParas(d, '**__Declaration__**;;//__(check box one only)__//', C), W[0], { fill: LABEL_FILL, rowSpan: 3, vcenter: true }),
        cell([p('I declare and confirm that')], W[1] + W[2] + W[3], { span: 3 })
      ] }),
      new TableRow({ children: [
        cell([p('Option 1')], W[1], { vcenter: true }),
        cell([
          p(`${tick('evmsOpt1')} ${text('evmsOpt1Text')}`, { after: 60 }),
          sub('evmsTenable', 'Tenable'),
          sub('evmsNgess', 'NGESS'),
          sub('evmsAws', 'AWS Inspector'),
          // What was typed replaces the grey "<Please Specify>" placeholder; empty keeps the placeholder
          sub('evmsOthers', 'Others,', ` ${val('evmsOthersNote') || '{{<Please Specify>}}'}`)
        ], W[2] + W[3], { span: 2 })
      ] }),
      new TableRow({ cantSplit: true, children: [
        cell([p('Option 2')], W[1], { vcenter: true }),
        cell([p(`${tick('evmsOpt2')} ${text('evmsOpt2Text')}`, { align: J })], W[2], { vcenter: true }),
        cell(cellParas(d, "{{<Attach detail with reason and PD's Approval / Acknowledgement. >}}", C), W[3], { vcenter: true })
      ] })
    ], { top: line, bottom: line, left: line, right: line, insideHorizontal: lite, insideVertical: lite });

    return [
      new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0, line: 20 }, children: [new TextRun({ text: '', size: 2 })] }),
      banner,
      new Paragraph({ spacing: { before: 0, after: 240 }, children: [] }),
      new Paragraph({ alignment: J, spacing: { before: 0, after: 240 }, children: rich(d, 'This is to ensure that all Synapxe-managed servers are onboarded or installed with any EVMS tool(s) such as Tenable, NGESS, AWS Inspector or/and others. This is not only to ensure that periodic vulnerability scan is performed but also to ensure there are no audit breaches.', { size: HEAD }) }),
      decl
    ];
  }
  // ---- Page 17 (landscape): Section 4.0 – Application Monitoring Declaration and Acknowledgement ----
  // Two tables: Declaration (Option 1 = three checks + non-compliance check, Option 2) and Acknowledgement (three checks + verify check).
  // Every sentence is a wizard checkbox (fixed text, read with tick()/text()); ticked boxes print as ☒.
  function page13(d) {
    const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, VerticalAlign } = d;
    const { line, LABEL_FILL } = execKit(d);
    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const lite = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
    const TEAL = '31849B';
    const J = AlignmentType.JUSTIFIED, C = AlignmentType.CENTER;
    const p = (text, o = {}) => new Paragraph({
      alignment: o.align, indent: o.indent, spacing: { before: o.before ?? 0, after: o.after ?? 0 },
      children: rich(d, text, o.run || {})
    });
    const cell = (children, w, o = {}) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      columnSpan: o.span, rowSpan: o.rowSpan, borders: o.borders,
      verticalAlign: o.vcenter ? VerticalAlign.CENTER : VerticalAlign.TOP,
      margins: { top: o.pad ?? 80, bottom: o.pad ?? 80, left: 100, right: 100 },
      shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
      children
    });
    const tableOf = (W, rows, borders) => new Table({
      width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: W, borders, rows
    });
    // One checkbox sentence: ☐/☒ + the label text; spacing keeps the gap between sentences seen in the source
    const check = (id, o = {}) => p(`${tick(id)} ${text(id + 'Text')}`, { align: J, after: o.after ?? 160, indent: o.indent });

    // Teal section banner with a dark rule underneath
    const banner = tableOf([LAND_TEXT_W], [new TableRow({ children: [
      cell([p('Section 4.0: Application Monitoring Declaration and Acknowledgement', { run: { bold: true, color: 'FFFFFF', size: HEAD } })], LAND_TEXT_W, { fill: TEAL, vcenter: true, pad: 120 })
    ] })], { top: none, left: none, right: none, bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000' }, insideHorizontal: none, insideVertical: none });

    // Declaration table: label | option label | text | attachment note
    const W = [1650, 1650, 8350, 2908]; // sums to LAND_TEXT_W = 14558
    const decl = tableOf(W, [
      new TableRow({ children: [
        cell(cellParas(d, '**__Declaration__**;;//__(check box one only)__//', C), W[0], { fill: LABEL_FILL, rowSpan: 4, vcenter: true }),
        cell([p('I declare and confirm that')], W[1] + W[2] + W[3], { span: 3 })
      ] }),
      new TableRow({ children: [
        cell(cellParas(d, 'Option 1;; ;;(Non-compliance if not all are ticked)', C), W[1], { rowSpan: 2, vcenter: true }),
        cell([check('decA1'), check('decA2'), check('decA3', { after: 0 })], W[2] + W[3], { span: 2 })
      ] }),
      new TableRow({ cantSplit: true, children: [
        cell([check('decA4', { after: 0 })], W[2], { vcenter: true }),
        cell(cellParas(d, "{{<Attach detail with reason and Service Lead's Approval / Acknowledgement. >}}", C), W[3], { rowSpan: 2, vcenter: true, borders: { left: none } })
      ] }),
      new TableRow({ cantSplit: true, children: [
        cell(cellParas(d, 'Option 2', C), W[1], { vcenter: true }),
        cell([check('decB1', { after: 0 })], W[2], { vcenter: true })
      ] })
    ], { top: line, bottom: line, left: line, right: line, insideHorizontal: lite, insideVertical: lite });

    // Acknowledgement table: shaded label | three checks, then a "please verify" row
    const AW = [2780, 11778]; // sums to LAND_TEXT_W = 14558
    const ack = tableOf(AW, [
      new TableRow({ children: [
        cell(cellParas(d, '**__Acknowledgement__**', C), AW[0], { fill: LABEL_FILL, vcenter: true }),
        cell([check('ackA1'), check('ackA2'), check('ackA3', { after: 0 })], AW[1], { vcenter: true })
      ] }),
      new TableRow({ cantSplit: true, children: [
        cell(cellParas(d, '//__Please verify and tick the check box__//', C), AW[0], { fill: LABEL_FILL, vcenter: true }),
        cell([check('ackV1', { after: 0 })], AW[1], { vcenter: true })
      ] })
    ], { top: line, bottom: line, left: line, right: line, insideHorizontal: lite, insideVertical: lite });

    return [
      new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0, line: 20 }, children: [new TextRun({ text: '', size: 2 })] }),
      banner,
      new Paragraph({ spacing: { before: 0, after: 200 }, children: [] }),
      decl,
      new Paragraph({ spacing: { before: 0, after: 200 }, children: [] }),
      ack
    ];
  }
  // ---- Portrait page: 9 Application monitoring sign-off (three fully boxed blocks) ----
  // Each block is a 2-column table: shaded label | value. Value text is plain/marked-up; the two signature rows carry a
  // grey attach placeholder, a signature line and a real wizard checkbox sentence.
  function pageSignoff(d) {
    const { Paragraph, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, VerticalAlign } = d;
    const black = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
    const W = [1450, TEXT_W - 1450];
    const cell = (children, w, fill) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      margins: { top: 70, bottom: 70, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
      children
    });
    const lab = text => cell(cellParas(d, text), W[0], TABLE_SHADE);
    const blank = () => cell([new Paragraph({ children: [] })], W[1]);
    // Name / Designation / Email rows: fixed label cell + the value typed in the wizard (empty box when nothing is entered)
    const valueCell = v => v ? cell(cellParas(d, v), W[1]) : blank();
    const simpleRows = n => [['Name:', 'Name'], ['Designation:', 'Des'], ['Email:', 'Email']]
      .map(([label, key]) => new TableRow({ children: [lab(label), valueCell(val(`sign${n}${key}`))] }));
    // Signature row: placeholder, signature line and the checkbox sentence
    const sigRow = (label, sentence) => new TableRow({ cantSplit: true, children: [
      lab(label),
      cell([
        ...cellParas(d, '{{<Attach Sign-off Email>}};;---'),
        new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { before: 0, after: 0 }, children: rich(d, `☐ ${sentence}`) })
      ], W[1])
    ] });
    const feedback = () => new TableRow({ children: [lab('Improvement Feedback:'), blank()] });
    const block = rows => new Table({
      width: { size: TEXT_W, type: WidthType.DXA },
      columnWidths: W,
      borders: { top: black, bottom: black, left: black, right: black, insideHorizontal: black, insideVertical: black },
      rows
    });
    return [
      heading(d, '9', 'APPLICATION MONITORING SIGN-OFF', true),
      heading(d, '9.1', 'Completed by FA', false, 120),
      block(simpleRows(1)),
      new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { before: 240, after: 0 }, children: rich(d, '~~**__Sign-off Templates will be sampled by Service Lead for review. Only sampled templates will need to fill up the following Section 9.2 and 9.3:__**~~') }),
      heading(d, '9.2', 'Reviewed by Team Lead or Manager (JG6 and Above)', false, 240),
      block([...simpleRows(2), sigRow('Signature:', 'I agree that all the information in the below mentioned sections are complete and accurate.'), feedback()]),
      heading(d, '9.3', 'Approved by Service Lead', false, 360),
      block([...simpleRows(3), sigRow('Signature:', 'I agree that the application status with relevant supporting information and artefact captured correctly.'), feedback()])
    ];
  }
  // ---- Revision history (fixed content, not in the wizard): document information + Version / Date / Summary / Documented by / Approved by ----
  // Cell text uses the same markers as elsewhere: ";;" new paragraph, " ;;" blank line between paragraphs.
  function pageRevisionHistory(d) {
    const { Paragraph, TextRun, Tab, TabStopType, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, VerticalAlign } = d;
    const C = AlignmentType.CENTER;
    const black = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
    const OWNER = 'MSO Business Mgmt-Apps Governance and Compliance';
    const info = [
      ['Document Title', 'Sign-off Template for Monitoring (Preventive)'],
      ['Document Number', 'SYNAPXE-TMPL_MSO_AGC_GOV-0004'],
      ['Document Owner', OWNER],
      ['Document Approver', 'Director, ' + OWNER],
      ['Information Classification', 'Restricted, Sensitive (Normal)'],
      ['Special Instructions', 'Nil']
    ].map(([label, value], i) => new Paragraph({
      pageBreakBefore: i === 0,
      spacing: { before: 0, after: 60 },
      tabStops: [{ type: TabStopType.LEFT, position: 2600 }, { type: TabStopType.LEFT, position: 2800 }],
      children: [
        new TextRun({ text: label, bold: true, size: BODY, font: 'Arial' }),
        new TextRun({ children: [new Tab(), ':', new Tab()], bold: true, size: BODY, font: 'Arial' }),
        new TextRun({ text: value, size: BODY, font: 'Arial' })
      ]
    }));

    const DOC = (n) => `${n} (${OWNER})`;               // "Name (MSO Business Mgmt-Apps Governance and Compliance)"
    const APPROVER = 'Christopher Chia Choon Meng (Director, ' + OWNER + ')';
    const REVIEW = 'Reviewed by: Lim Seng Guan (' + OWNER + ')';
    const appr = (reviewed = true) => reviewed ? `${APPROVER};; ;;${REVIEW}` : APPROVER;
    // [version, date, summary, documented by (name only), approved-by has reviewer?]
    const rows = [
      ['1.0', '31/3/2022', 'Baseline Version', 'Lim Seng Guan', false],
      ['2.0', '14/4/2022', 'Improved Version', 'Lim Seng Guan', false],
      ['4.0', '02/08/2023', 'Update to new Synapxe identity', 'Nur Syafinah', true],
      ['4.1', '07/02/2024', 'Added additional data point to be captured.', 'Alfred Neo', true],
      ['4.2', '12/03/2024', 'Uplifted interface logs, batch jobs, and DB Replication (managed by vendor) from optional to essential means for preventive monitoring task', 'Lim Seng Guan', false],
      ['4.3', '04/04/2024', 'Update ebudget number to Demand ID', 'Chong Wei Cong', true],
      ['4.4', '07/05/2024', 'Removal of Budget ID from Application In-Scope;; ;;Added “UNCLASSIFIED” for System Critically', 'Chong Wei Cong', true],
      ['4.5', '15/05/2024', 'Updated Frequency Table and added Weekly option', 'Alfred Neo', true],
      ['4.6', '01/06/2024', 'Change dropdown list from “Uknown” to “Unknown.;; ;;Updated End-user Managed Apps in Application in scope to be aligned with CMDB.;; ;;Added comment for Remark section.', 'Alfred Neo', true],
      ['4.7', '07/06/2024', 'Incorporate brief action guidance for each mean to better guide the FA on what to look for when performing the analysis or review of each mean.;; ;;List Health Status options as ODC team is unable to use drop-down list feature in M365.;; ;;Indicate screenshot images to be placed in the appendix session for M365, primarily used by ODC team.', 'Lim Seng Guan', false],
      ['4.8', '02/09/2024', 'Removal of System Criticality under Frequency in Application In-Scope and added necessary frequencies;; ;;Updated Sign off Template folder link in Declaration column in Application In-Scope;; ;;Removal of Document Number on first page and on Revision History;; ;;Update footer on Revision History page to standardize footer for the whole document', 'Chong Wei Cong', true],
      ['4.9', '01/11/2024', 'Added EVMS Section 2 EVMS onboarding check', 'Alfred Neo', true],
      ['5.0', '06/01/2025', 'Remove Remark column, added Errors found and Vendor info to the HealthCheck table.', 'Alfred Neo', true],
      ['5.1', '15/01/2025', 'Reinstated Remark column', 'Alfred Neo', true],
      ['5.2', '14/04/2025', 'Updated URL links in the following:;; ;;1. Key Components of a Sign off form;; ;;2. URL - App Ops Practice & Governance site;; ;;3. Application in-scope’s Declaration.', 'Chong Wei Cong', true],
      ['5.3', '19/06/2025', 'Added Artefact Provided Start Date and End Date Range;; ;;Added Duration of Entries Captured in the Logs for Review;; ;;Updated Section 1 Part B table with the same as Part A;; ;;Added Note for Name / Locations', 'Alfred Neo', true],
      ['5.4', '01/10/2025', 'Update Duration of extract and review to 1 day.;; ;;Specifically highlight application log is performed using Dynatrace or review of logs in server.;; ;;Removed Duration of Artefact Captured;; ;;Split Batch job out of the main table into a separate section.', 'Alfred Neo', true],
      ['5.41', '10/12/2025', 'Updated the link to Application Log decision tree to the new site;; ;;Resize the Version History table', 'Alfred Neo', true],
      ['5.5', '28/1/2026', 'Updated additional “Means” Data Processing Error and Connectivity Failures for application log and interface log.;; ;;Added instructions for “Means” under section A Applications Logs and Interface Logs “Top 3 errors or exceptions of errors determined by FA”;; ;;Updated Section A – Interface Log description to “Log all application interface-related errors or exceptions”;; ;;Updated Section B – “Essential Batch Jobs” to “Essential Batch Jobs and Scheduled Jobs check”;; ;;Updated all tables “Any Application Error found in logs” with options to select “No errors found” or “Errors found. ServiceNow ticket has been raised for internal tracking and assigned to the appropriate action party.” Also included ServiceNow Ticket No.;; ;;Added Declaration “I have confirmed that I have reviewed the relevant logs to identify any errors or exceptions. The supporting artefacts I have attached are complete and accurate, and I understand their purpose and how do they fulfil the defined monitoring requirements.”;; ;;Added Declaration” I am able to explain what each artefact about and the data point represents, including how do these artefacts support the review of required error logs, anomalies, and exceptions.”;; ;;Added Acknowledgment” I acknowledged that I would follow up on the application errors and in situations where I am uncertain who will follow up, then I am responsible to escalate my reporting FA chain of command until I am informed on the assigned FA to follow up.”;; ;;Added Acknowledgment” I acknowledged my responsibility to ensure that any identified issues or exceptions are clearly documented and followed up in accordance with established procedures as part of the AMS management.”;; ;;Removed Section E: Error details.;; ;;Removed Section 10 Appendix.', 'Alfred Neo', true],
      ['6.0', '31/3/2026', 'Aligned to Synapxe PnP provided Template', 'Alfred Neo', true],
      ['6.1', '30/4/2026', '1. Updated 8.1 Application In-Scope Request ID to BET Request ID.;; ;;2. Updated 8.1 Application In-Scope Declaration to “I confirm that I am using the latest version template available in the Synapxe Policies & Procedures Portal for the current KTLO activity to ensure latest standard is adhered to.”;; ;;3. Added Section 1.0 Application Specific SOP for Preventive Monitoring;; ;;4. Updated Section 1.0 Health Check to Section 2.0;; ;;5. Updated entire Section 3.0: Declaration for Use of Enterprise Vulnerability Management System (EVMS) Tool', 'Alfred Neo', true]
    ];

    // The source table is wider than the text block (about 10300 twips), so it is centred and overhangs both margins equally
    const W = [700, 1000, 4350, 1500, 1750, 1000];
    const total = W.reduce((a, b) => a + b, 0);
    const shift = { left: -((total - TEXT_W) / 2) };       // the source table is wider than the text block; centre it
    const cell = (children, w, o = {}) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      verticalAlign: o.vcenter ? VerticalAlign.CENTER : VerticalAlign.TOP,
      margins: { top: 50, bottom: 50, left: 70, right: 70 },
      shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
      children
    });
    const para = (text, align) => cellParas(d, text, align, { size: 16 });
    const head = [['Version', C], ['Effective Date', C], ['Summary of Changes', C], ['Documented By', C], ['Approved By', C], ['Change Ref', C]];
    const hdrRow = new TableRow({ tableHeader: true, children: head.map(([t, al], i) =>
      cell(para(`**${t}**`, al), W[i], { fill: 'D9D9D9', vcenter: true })) });
    const dataRows = rows.map(([ver, date, sum, who, reviewed]) => new TableRow({ children: [
      cell(para(ver, C), W[0]),
      cell(para(date, C), W[1]),
      cell(para(sum), W[2]),
      cell(para(`${who} (${OWNER})`, C), W[3]),
      cell(para(appr(reviewed), C), W[4]),
      cell([new Paragraph({ children: [] })], W[5])
    ] }));
    const table = new Table({
      width: { size: total, type: WidthType.DXA },
      columnWidths: W,
      indent: { size: shift.left, type: WidthType.DXA },
      borders: { top: black, bottom: black, left: black, right: black, insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '000000' }, insideVertical: black },
      rows: [hdrRow, ...dataRows]
    });
    return [
      ...info,
      new Paragraph({ spacing: { before: 360, after: 160 }, children: rich(d, '**Revision History**') }),
      table
    ];
  }
  // ---- Page 15 (landscape): C. Optional – additional means table ----
  // Row syntax (errRows): SN | Means | Name / Location | Server(s) / Component(s) | Health Status | Remark | No errors tick (x) |
  //   Errors found tick (x) | ServiceNow ticket number | Duration From | Duration To   (yyyy-MM-ddTHH:mm)
  // Every row gets the shared "errors found" block and the stacked artefact block.
  function page11(d) {
    const { Paragraph, Table, TableRow, WidthType, AlignmentType } = d;
    const { line, HEAD_FILL, cell, artStacked, errBlock } = execKit(d);
    const C = AlignmentType.CENTER, J = AlignmentType.JUSTIFIED;
    const SMALL = { size: 14 }; // 7pt, as in the source table
    // SN | Means | Name / Location | Server(s) / Component(s) | Errors found | Health Status | Remark | Artefact  (sums to LAND_TEXT_W = 14558)
    const W = [507, 1700, 1250, 1300, 2751, 1550, 2107, 3393];
    const headers = ["**SN**","**Means**","**Name / Location**","**Server(s) / Component(s)**","**Any Application Errors found in logs**;; ;;~~Ticket must be created in ServiceNow.~~","**Health Status**;;- Good (No Error Found);;- Fair (Minor Errors Found);;- Bad (Errors Found);;- Unknown","**Remark**;; ;;~~Quality rating would reflect accordingly if the status stated (e.g. errors found or health status) **__is deviated__** from what is found in the artefacts.~~","**Artefact(s)**;; ;;~~Please provide error details in Section D if error is found~~;; ;;**Duration of Entries Captured in the Logs for Review**^#A4^"];
    const hdrRow = new TableRow({ children: W.map((w, i) =>
      cell(headers[i] || '', w, { fill: HEAD_FILL, align: C, run: SMALL })) });
    const dataRows = lines('errRows').map(l => {
      const c = cols(l);
      return new TableRow({ cantSplit: true, children: [
        cell(c[0] || '', W[0], { vcenter: true, run: SMALL }),
        cell(c[1] || '', W[1], { vcenter: true, run: SMALL }),
        cell(c[2] || '', W[2], { vcenter: true, run: SMALL }),
        cell(c[3] || '', W[3], { vcenter: true, run: SMALL }),
        cell([errBlock({ noTick: c[6], errTick: c[7], errText: 'ServiceNow ticket has been raised for internal tracking and assigned to the appropriate action party.', ticket: c[8] }, SMALL)], W[4]),
        cell(c[4] || '', W[5], { vcenter: true, run: SMALL }),
        cell(c[5] || '', W[6], { vcenter: true, run: SMALL }),
        // Duration From / To come from the date-time pickers; an unset picker keeps the grey example text
        cell([artStacked("#A4", SMALL,
          c[9] ? fmtDateTime(c[9]) : undefined,
          c[10] ? fmtDateTime(c[10]) : undefined)], W[7])
      ] });
    });
    const table = new Table({
      width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA },
      columnWidths: W,
      borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
      rows: [hdrRow, ...dataRows]
    });
    return [
      new Paragraph({ pageBreakBefore: true, alignment: J, indent: { left: 720, hanging: 360 }, spacing: { before: 0, after: 200 }, children: rich(d, "C. **Optional:** If your application has more means to perform your health check, you can record the details in the table below.", { size: HEAD }) }),
      table,
      ...['^#A4^: //Additional fields are added due to Audit Findings across multiple apps. Application team to ensure you are clear of the meaning of the fields and update appropriately.//']
        .map((n, i, all) => new Paragraph({ keepNext: i < all.length - 1, keepLines: true, spacing: { before: 0, after: 0 }, children: rich(d, n) }))
    ];
  }
  async function generateDocx() {
    status.className = 'status'; status.textContent = 'Preparing the Word document…';
    generateBtn.disabled = true; generateBtn.textContent = 'Generating…';
    try {
      if (!window.docx) throw new Error('The DOCX library could not load. Reload the page and try again.');
      const d = window.docx;
      const { Document, Packer, AlignmentType } = d;
      const title = val('docTitle'), docNumber = val('docNumber'), version = val('version'), date = val('effectiveDate'), approved = val('approvedBy');
      const confidentiality = val('confidentiality');
      const tocLines = val('tocEntries').split(/\r?\n/).filter(Boolean);
      const R = AlignmentType.RIGHT, C = AlignmentType.CENTER, J = AlignmentType.JUSTIFIED;
      // Pages 1-2: cover. Spacing values reproduce the vertical positions of the reference page.
      const cover = [
        para(d, 'For MSO Applications only', { align: R, size: 40, bold: true, after: 3570 }),
        // Title wraps within a narrower column (right-aligned), as in the source; the block below stays right-aligned
        new d.Paragraph({ alignment: R, indent: { left: 3200 }, spacing: { before: 0, after: 200 }, children: [new d.TextRun({ text: title, bold: true, size: 48, font: 'Arial' })] }),
        para(d, `${docNumber} | Version <${version}>`, { align: R, bold: true, after: 90 }),
        para(d, `Effective Date: <${date}>`, { align: R, bold: true, after: 90 }),
        para(d, `Approved By: ${approved}`, { align: R, bold: true }),
        // Confidentiality notice pinned to the bottom of page 1 (a frame anchored to the bottom margin),
        // so it stays at the foot of the page however long the cover text is.
        new d.Paragraph({
          alignment: J,
          frame: {
            type: 'alignment', width: TEXT_W, wrap: d.FrameWrap.NOT_BESIDE,
            anchor: { horizontal: d.FrameAnchorType.MARGIN, vertical: d.FrameAnchorType.MARGIN },
            alignment: { x: d.HorizontalPositionAlign.LEFT, y: d.VerticalPositionAlign.BOTTOM }
          },
          children: [new d.TextRun({ text: confidentiality, size: 20, font: 'Arial' })]
        })
      ];
      // Page 3: table of contents.
      const toc = [
        para(d, 'Table of Contents', { align: C, bold: true, after: 220 }),
        ...tocLines.map(line => tocParagraph(d, line)),
        ...page4(d),
        ...page5(d),
        ...page6(d)
      ];
      const pageProps = {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: 2100, right: MARGIN_X, bottom: 1520, left: MARGIN_X, header: 500, footer: 500 }
        }
      };
      const doc = new Document({
        creator: 'Preventive Monitoring Template', title,
        styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
        sections: [
          { properties: pageProps, headers: { default: makeHeader(d) }, footers: { default: makeFooter(d) }, children: cover },
          { properties: pageProps, headers: { default: makeHeader(d) }, footers: { default: makeFooter(d) }, children: toc },
          {
            properties: { page: {
              size: { width: PAGE_W, height: PAGE_H, orientation: d.PageOrientation.LANDSCAPE },
              margin: { top: 1950, right: LAND_MARGIN_X, bottom: 1520, left: LAND_MARGIN_X, header: 450, footer: 500 }
            } },
            headers: { default: makeHeader(d, LAND_TEXT_W) },
            footers: { default: makeFooter(d, LAND_TEXT_W) },
            children: [...page7(d), ...page8(d), ...pageHealth(d), ...page9(d), ...page10(d), ...page11(d), ...page12(d), ...page13(d)]
          },
          { properties: pageProps, headers: { default: makeHeader(d) }, footers: { default: makeFooter(d) }, children: [...pageSignoff(d), ...pageRevisionHistory(d)] }
        ]
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'Application_Monitoring_Editable_Pages_1-9.docx'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status.textContent = 'Your editable DOCX download has started. Check the generated file in Word and adjust page breaks if your Word environment renders differently.';
    } catch (err) {
      status.className = 'status error'; status.textContent = err.message || 'Could not generate the document.';
    } finally { generateBtn.disabled = false; generateBtn.textContent = 'Generate editable DOCX'; }
  }
  form.addEventListener('submit', event => { event.preventDefault(); if (validCurrentStep()) generateDocx(); });
  showStep(0);
})();
