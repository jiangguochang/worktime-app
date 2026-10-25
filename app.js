(function () {
  'use strict';

  var STORE_KEY = 'worktime.days.v2';
  var OLD_KEY = 'worktime.records.v1';

  var $ = function (id) { return document.getElementById(id); };
  var view = $('view');
  var sheet = $('sheet');
  var sheetMask = $('sheetMask');
  var form = $('entryForm');
  var fDate = $('fDate');
  var fAmStart = $('fAmStart');
  var fAmEnd = $('fAmEnd');
  var fPmStart = $('fPmStart');
  var fPmEnd = $('fPmEnd');
  var fNote = $('fNote');
  var sumAm = $('sumAm');
  var sumPm = $('sumPm');
  var previewValue = $('previewValue');
  var previewHint = $('previewHint');
  var btnDelete = $('btnDelete');
  var toastEl = $('toast');

  var days = [];          // [{ id, date, am:{start,end} | null, pm:{start,end} | null, note }]
  var editingId = null;
  var currentView = 'list';

  var HALVES = ['am', 'pm'];
  var HALF_NAME = { am: '上午', pm: '下午' };

  /* ---------------- 数据 ---------------- */

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      days = Array.isArray(list) ? list.map(normalizeDay).filter(Boolean) : [];
      if (!days.length) migrateFromV1();
    } catch (e) {
      days = [];
    }
  }

  // 旧的「一条记录」数据迁移成「一天上午/下午」；同一天合并，按时间先后归入上午/下午
  function migrateFromV1() {
    var old;
    try { old = JSON.parse(localStorage.getItem(OLD_KEY) || '[]'); } catch (e) { old = []; }
    if (!Array.isArray(old) || !old.length) return;

    var byDate = {};
    old.forEach(function (r) {
      if (!isHHMM(r.start) || !isHHMM(r.end) || !isYmd(r.date)) return;
      (byDate[r.date] = byDate[r.date] || []).push(r);
    });

    var migrated = Object.keys(byDate).map(function (date) {
      var list = byDate[date].slice().sort(function (a, b) { return toMinutes(a.start) - toMinutes(b.start); });
      var day = { id: uid(), date: date, am: null, pm: null, note: '' };
      list.forEach(function (r) {
        var seg = { start: r.start, end: r.end };
        if (!day.am) day.am = seg;
        else if (!day.pm) day.pm = seg;
        if (r.note && !day.note) day.note = r.note;
      });
      // 只有一条且跨中午：不自行拆分（会改变工时），但提醒去改
      if (!day.pm && day.am) {
        var s = toMinutes(day.am.start);
        var e = toMinutes(day.am.end);
        if (s < 720 && e > 780) {
          day.note = (day.note ? day.note + '；' : '') + '旧记录跨了中午，点开可拆成上午和下午';
        }
      }
      return day;
    });

    if (migrated.length) {
      days = migrated;
      save();
      toast('已把旧记录整理成上午/下午');
    }
  }

  function isHHMM(s) { return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s); }
  function isYmd(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

  function normalizeHalf(h) {
    if (!h || !isHHMM(h.start) || !isHHMM(h.end)) return null;
    return { start: h.start, end: h.end };
  }

  function normalizeDay(d) {
    if (!d || !isYmd(d.date)) return null;
    var am = normalizeHalf(d.am);
    var pm = normalizeHalf(d.pm);
    if (!am && !pm) return null;
    return {
      id: typeof d.id === 'string' ? d.id : uid(),
      date: d.date,
      am: am,
      pm: pm,
      note: typeof d.note === 'string' ? d.note : ''
    };
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(days));
      return true;
    } catch (e) {
      toast('保存失败，存储空间可能已满');
      return false;
    }
  }

  /* ---------------- 时间工具 ---------------- */

  function toMinutes(hhmm) {
    var p = hhmm.split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  // 一段的分钟数，跨天按次日
  function segMinutes(seg) {
    if (!seg) return 0;
    var s = toMinutes(seg.start);
    var e = toMinutes(seg.end);
    return e >= s ? e - s : e + 1440 - s;
  }

  function segOvernight(seg) {
    return !!seg && toMinutes(seg.end) < toMinutes(seg.start);
  }

  function dayMinutes(d) {
    return segMinutes(d.am) + segMinutes(d.pm);
  }

  function humanDuration(min) {
    var h = Math.floor(min / 60);
    var m = min % 60;
    if (h && m) return h + ' 小时 ' + m + ' 分';
    if (h) return h + ' 小时';
    return m + ' 分';
  }

  function decimalHours(min) {
    return (Math.round((min / 60) * 100) / 100).toFixed(2).replace(/\.?0+$/, '') || '0';
  }

  function todayStr() {
    return ymd(new Date());
  }

  function ymd(d) {
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function parseYmd(s) {
    var p = s.split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }

  function weekdayName(s) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][parseYmd(s).getDay()];
  }

  function friendlyDate(s) {
    var t = todayStr();
    if (s === t) return '今天';
    var y = new Date();
    y.setDate(y.getDate() - 1);
    if (s === ymd(y)) return '昨天';
    return (parseYmd(s).getMonth() + 1) + '月' + parseYmd(s).getDate() + '日';
  }

  function startOfWeek(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var w = (x.getDay() + 6) % 7; // 周一为一周起点
    x.setDate(x.getDate() - w);
    return x;
  }

  /* ---------------- 统计 ---------------- */

  function sumMinutes(list) {
    return list.reduce(function (n, d) { return n + dayMinutes(d); }, 0);
  }

  function sortedDays() {
    return days.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  /* ---------------- 提示 ---------------- */

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-show'); }, 2200);
  }

  /* ---------------- 渲染：记录列表 ---------------- */

  function renderList() {
    var t = todayStr();
    var list = sortedDays();
    var today = list.filter(function (d) { return d.date === t; })[0] || null;
    var html = '';

    if (!list.length) {
      html += '<div class="empty empty-first">' +
        '<div class="empty-ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2"/><path d="M12 7.6V12l3 1.9"/></svg></div>' +
        '<h3>从今天开始记吧</h3>' +
        '<p>上午、下午分开填上下班时间，<br>当天总共多久会自动算好。</p>' +
        '<button class="btn btn-primary empty-cta" type="button" id="btnFirstEntry">记第一天</button>' +
      '</div>';
      view.innerHTML = html;
      var cta = $('btnFirstEntry');
      if (cta) cta.addEventListener('click', function () { openSheet(null); });
      return;
    }

    // 今日概览
    if (today) {
      html += '<section class="hero">' +
        '<div class="hero-label">今天已工作</div>' +
        '<div class="hero-value">' + decimalHours(dayMinutes(today)) + '<small>小时</small></div>' +
        '<div class="hero-meta">' +
          halfChip('am', today.am) +
          halfChip('pm', today.pm) +
          '<span class="chip">' + humanDuration(dayMinutes(today)) + '</span>' +
        '</div>' +
      '</section>';
    } else {
      html += '<section class="hero hero-empty">' +
        '<div class="hero-label">今天</div>' +
        '<div class="hero-value">还没记录</div>' +
        '<div class="hero-meta"><span class="chip">点右下角添加今天的上午、下午</span></div>' +
      '</section>';
    }

    html += '<div class="section-title"><h2>工作日历</h2><span>共 ' + list.length + ' 天</span></div>';

    list.forEach(function (d) {
      var label = friendlyDate(d.date);
      var sub = label === '今天' || label === '昨天'
        ? d.date.slice(5).replace('-', '/') + ' ' + weekdayName(d.date)
        : weekdayName(d.date);
      html += '<section class="day-group">' +
        '<header class="day-head">' +
          '<div class="d-left"><span class="d-date">' + label + '</span>' +
          '<span class="d-week">' + sub + '</span></div>' +
          '<span class="d-total">' + humanDuration(dayMinutes(d)) + '</span>' +
        '</header>' +
        rowHtml(d, 'am') +
        rowHtml(d, 'pm') +
        (d.note ? '<p class="day-note">' + escapeHtml(d.note) + '</p>' : '') +
      '</section>';
    });

    view.innerHTML = html;
    bindEntries();
  }

  function halfChip(key, seg) {
    if (!seg) return '<span class="chip is-muted">' + HALF_NAME[key] + '未填</span>';
    return '<span class="chip">' + HALF_NAME[key] + ' ' + seg.start + '–' + seg.end + '</span>';
  }

  function rowHtml(d, key) {
    var seg = d[key];
    var name = HALF_NAME[key];
    if (!seg) {
      return '<div class="entry is-empty" data-id="' + d.id + '" data-half="' + key + '" role="button" tabindex="0">' +
        '<span class="entry-tag is-empty">' + name + '</span>' +
        '<span class="entry-main"><span class="entry-none">未填，点这里补上</span></span>' +
      '</div>';
    }
    var min = segMinutes(seg);
    // 上午一段却跨过中午：提醒可拆成上午/下午（不改工时，只提示）
    var spansNoon = key === 'am' && !d.pm && toMinutes(seg.start) < 720 && toMinutes(seg.end) > 780;
    return '<div class="entry" data-id="' + d.id + '" data-half="' + key + '" role="button" tabindex="0">' +
      '<span class="entry-tag">' + name + '</span>' +
      '<span class="entry-main">' +
        '<span class="entry-time">' +
          seg.start +
          '<svg class="entry-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8h11M9.5 4l4 4-4 4"/></svg>' +
          seg.end +
          (segOvernight(seg) ? '<i class="entry-overnight">跨天</i>' : '') +
          (spansNoon ? '<i class="entry-overnight">跨中午</i>' : '') +
        '</span>' +
      '</span>' +
      '<span class="entry-dur">' + humanDuration(min) + '</span>' +
      '<span class="entry-chevron"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span>' +
    '</div>';
  }

  function bindEntries() {
    Array.prototype.forEach.call(view.querySelectorAll('.entry'), function (el) {
      el.addEventListener('click', function () { openSheet(el.getAttribute('data-id')); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openSheet(el.getAttribute('data-id'));
        }
      });
    });
  }

  /* ---------------- 渲染：统计 ---------------- */

  function renderStats() {
    var now = new Date();
    var t = todayStr();
    var weekStart = ymd(startOfWeek(now));
    var monthKey = t.slice(0, 7);

    var todayMin = sumMinutes(days.filter(function (d) { return d.date === t; }));
    var weekMin = sumMinutes(days.filter(function (d) { return d.date >= weekStart && d.date <= t; }));
    var monthMin = sumMinutes(days.filter(function (d) { return d.date.slice(0, 7) === monthKey; }));
    var allMin = sumMinutes(days);
    var count = days.length;
    var avg = count ? Math.round(allMin / count) : 0;

    var html = '<div class="stat-grid">' +
      '<div class="stat-card is-accent"><div class="s-label">今天</div>' +
        '<div class="s-value">' + decimalHours(todayMin) + '<small>小时</small></div></div>' +
      '<div class="stat-card"><div class="s-label">本周</div>' +
        '<div class="s-value">' + decimalHours(weekMin) + '<small>小时</small></div></div>' +
      '<div class="stat-card"><div class="s-label">本月</div>' +
        '<div class="s-value">' + decimalHours(monthMin) + '<small>小时</small></div></div>' +
      '<div class="stat-card"><div class="s-label">日均（' + count + ' 天）</div>' +
        '<div class="s-value">' + decimalHours(avg) + '<small>小时</small></div></div>' +
    '</div>';

    // 最近 7 天，按上午/下午堆叠
    var last7 = [];
    for (var i = 6; i >= 0; i--) {
      var dd = new Date();
      dd.setDate(dd.getDate() - i);
      var ds = ymd(dd);
      var day = days.filter(function (x) { return x.date === ds; })[0] || null;
      last7.push({
        date: ds,
        am: day ? segMinutes(day.am) : 0,
        pm: day ? segMinutes(day.pm) : 0,
        min: day ? dayMinutes(day) : 0
      });
    }
    var maxMin = Math.max.apply(null, last7.map(function (x) { return x.min; }).concat([480]));

    html += '<div class="section-title"><h2>最近 7 天</h2><span>上午 / 下午分别多长</span></div>' +
      '<section class="card bars">';
    last7.forEach(function (x) {
      var isToday = x.date === t;
      var amPct = Math.round((x.am / maxMin) * 100);
      var pmPct = Math.round((x.pm / maxMin) * 100);
      html += '<div class="bar-row' + (isToday ? ' is-today' : '') + '">' +
        '<span class="bar-day">' + (isToday ? '今天' : weekdayName(x.date).replace('周', '')) + '</span>' +
        '<span class="bar-track">' +
          (x.am ? '<span class="bar-seg bar-am" style="width:' + Math.max(amPct, 2) + '%"></span>' : '') +
          (x.pm ? '<span class="bar-seg bar-pm" style="width:' + Math.max(pmPct, 2) + '%"></span>' : '') +
        '</span>' +
        '<span class="bar-val">' + (x.min ? decimalHours(x.min) + 'h' : '—') + '</span>' +
      '</div>';
    });
    html += '</section>' +
      '<p class="legend-note legend-bars"><span class="dot dot-am"></span>上午　<span class="dot dot-pm"></span>下午　' +
      '柱长按这 7 天里最长的一天等比缩放，满格代表 ' + decimalHours(maxMin) + ' 小时。</p>';

    // 导出与数据
    html += '<div class="section-title"><h2>导出与数据</h2><span>共 ' + count + ' 天</span></div>' +
      '<section class="card" style="padding:14px 16px">' +
        '<button class="btn btn-primary" type="button" id="btnExportCsv">一键导出 Excel（CSV）</button>' +
        '<div style="height:10px"></div>' +
        '<button class="btn btn-ghost" type="button" id="btnCopy">复制成表格，粘到微信或备忘录</button>' +
        '<p class="legend-note" style="margin-top:12px">导出的文件用 Excel、WPS 或「数字」打开都是中文表头，不会乱码。' +
          '在 iPhone 上导出后会进入「文件」App。</p>' +
      '</section>' +
      '<div class="section-title"><h2>备份</h2><span>防止数据丢失</span></div>' +
      '<section class="card" style="padding:14px 16px">' +
        '<button class="btn btn-ghost" type="button" id="btnBackup">导出备份（JSON）</button>' +
        '<div style="height:10px"></div>' +
        '<button class="btn btn-ghost" type="button" id="btnRestore">从备份恢复</button>' +
        '<input type="file" id="fileRestore" accept=".json,application/json" hidden>' +
        '<p class="legend-note" style="margin-top:12px">记录保存在这台设备的浏览器里。' +
          '换手机、清理浏览器数据前建议先导出一份备份，恢复时选择那个文件即可。</p>' +
      '</section>';

    view.innerHTML = html;

    var b1 = $('btnExportCsv');
    var b2 = $('btnCopy');
    if (b1) b1.addEventListener('click', exportCsv);
    if (b2) b2.addEventListener('click', copyTable);
    var b3 = $('btnBackup');
    var b4 = $('btnRestore');
    var fi = $('fileRestore');
    if (b3) b3.addEventListener('click', exportBackup);
    if (b4) b4.addEventListener('click', function () { fi.click(); });
    if (fi) fi.addEventListener('change', importBackup);
  }

  /* ---------------- 导入导出 ---------------- */

  var HEADERS = ['日期', '星期', '上午上班', '上午下班', '上午工时', '下午上班', '下午下班', '下午工时', '全天工时', '是否跨天', '备注'];

  function buildRows() {
    var list = sortedDays().slice().reverse(); // 从早到晚
    return list.map(function (d) {
      var amOvernight = segOvernight(d.am);
      var pmOvernight = segOvernight(d.pm);
      return [
        d.date,
        weekdayName(d.date),
        d.am ? d.am.start : '',
        d.am ? d.am.end : '',
        d.am ? decimalHours(segMinutes(d.am)) : '',
        d.pm ? d.pm.start : '',
        d.pm ? d.pm.end : '',
        d.pm ? decimalHours(segMinutes(d.pm)) : '',
        decimalHours(dayMinutes(d)),
        (amOvernight || pmOvernight) ? '是' : '否',
        d.note || ''
      ];
    });
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportCsv() {
    if (!days.length) { toast('还没有记录可以导出'); return; }
    var rows = buildRows();
    var total = sumMinutes(days);
    var amTotal = days.reduce(function (n, d) { return n + segMinutes(d.am); }, 0);
    var pmTotal = days.reduce(function (n, d) { return n + segMinutes(d.pm); }, 0);
    var lines = [HEADERS.join(',')];
    rows.forEach(function (r) { lines.push(r.map(csvCell).join(',')); });
    lines.push('');
    lines.push([
      '合计', rows.length + ' 天', '', '', decimalHours(amTotal),
      '', '', decimalHours(pmTotal), decimalHours(total), '', ''
    ].map(csvCell).join(','));
    download('工时记录_' + todayStr() + '.csv', '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8;');
    toast('已导出 ' + rows.length + ' 天');
  }

  function copyTable() {
    if (!days.length) { toast('还没有记录可以复制'); return; }
    var rows = buildRows();
    var total = sumMinutes(days);
    var text = HEADERS.join('\t') + '\n' +
      rows.map(function (r) { return r.join('\t'); }).join('\n') +
      '\n合计\t' + rows.length + ' 天\t\t\t\t\t\t' + decimalHours(total);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('已复制，可以直接粘贴');
      }, function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    toast(ok ? '已复制，可以直接粘贴' : '复制失败，请长按选择文字');
  }

  /* ---------------- 备份与恢复 ---------------- */

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function exportBackup() {
    if (!days.length) { toast('还没有记录可以备份'); return; }
    var payload = { app: 'worktime', version: 2, exportedAt: new Date().toISOString(), days: days };
    download('工时记录备份_' + todayStr() + '.json', JSON.stringify(payload, null, 2), 'application/json');
    toast('备份已导出');
  }

  function importBackup(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var incoming = null;
      try {
        var data = JSON.parse(reader.result);
        if (data && Array.isArray(data.days)) {
          incoming = data.days.map(normalizeDay).filter(Boolean);           // v2 备份
        } else {
          var raw = Array.isArray(data) ? data : (data && data.records);
          if (Array.isArray(raw)) {
            // v1 备份：按日期合并成上午/下午
            var byDate = {};
            raw.forEach(function (r) {
              if (!isHHMM(r.start) || !isHHMM(r.end) || !isYmd(r.date)) return;
              (byDate[r.date] = byDate[r.date] || []).push(r);
            });
            incoming = Object.keys(byDate).map(function (date) {
              var list = byDate[date].slice().sort(function (a, b) { return toMinutes(a.start) - toMinutes(b.start); });
              var day = { id: uid(), date: date, am: null, pm: null, note: '' };
              list.forEach(function (r) {
                var seg = { start: r.start, end: r.end };
                if (!day.am) day.am = seg; else if (!day.pm) day.pm = seg;
                if (r.note && !day.note) day.note = r.note;
              });
              return day;
            }).filter(Boolean);
          }
        }
      } catch (err) { incoming = null; }

      if (!incoming || !incoming.length) { toast('这个文件读不出来，确认是备份文件'); return; }

      // 同一天以后导入的为准
      var byDate = {};
      days.forEach(function (d) { byDate[d.date] = d; });
      incoming.forEach(function (d) { byDate[d.date] = d; });
      days = Object.keys(byDate).map(function (k) { return byDate[k]; });

      if (save()) {
        render();
        toast('已恢复，现在共 ' + days.length + ' 天');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  /* ---------------- 录入面板 ---------------- */

  function openSheet(id) {
    editingId = id || null;
    var d = id ? days.filter(function (x) { return x.id === id; })[0] : null;

    $('sheetTitle').textContent = d ? '修改这一天' : '记一天工时';
    $('btnSave').textContent = d ? '保存修改' : '保存';
    btnDelete.hidden = !d;

    if (d) {
      fDate.value = d.date;
      fAmStart.value = d.am ? d.am.start : '';
      fAmEnd.value = d.am ? d.am.end : '';
      fPmStart.value = d.pm ? d.pm.start : '';
      fPmEnd.value = d.pm ? d.pm.end : '';
      fNote.value = d.note || '';
    } else {
      fDate.value = todayStr();
      fAmStart.value = '09:00';
      fAmEnd.value = '12:00';
      fPmStart.value = '13:30';
      var now = new Date();
      fPmEnd.value = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
      fNote.value = '';
    }

    updatePreview();
    sheet.hidden = false;
    sheetMask.hidden = false;
    requestAnimationFrame(function () {
      sheet.classList.add('is-open');
      sheetMask.classList.add('is-open');
    });
  }

  function closeSheet() {
    sheet.classList.remove('is-open');
    sheetMask.classList.remove('is-open');
    setTimeout(function () {
      sheet.hidden = true;
      sheetMask.hidden = true;
      editingId = null;
    }, 300);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  // 从表单里读出一段；start/end 都空 -> null；只填一个 -> undefined（不完整）
  function readHalf(startEl, endEl) {
    var s = startEl.value;
    var e = endEl.value;
    if (!s && !e) return null;
    if (!s || !e) return undefined;
    return { start: s, end: e };
  }

  function updatePreview() {
    var am = readHalf(fAmStart, fAmEnd);
    var pm = readHalf(fPmStart, fPmEnd);
    var hints = [];

    sumAm.textContent = am === undefined ? '没填完' : (am ? humanDuration(segMinutes(am)) : '未填');
    sumPm.textContent = pm === undefined ? '没填完' : (pm ? humanDuration(segMinutes(pm)) : '未填');

    if (am === undefined || pm === undefined) {
      previewValue.textContent = '—';
      previewHint.hidden = false;
      previewHint.textContent = '每一段的上班、下班时间要成对填写。' +
        (am === undefined ? '上午缺一个时间；' : '') +
        (pm === undefined ? '下午缺一个时间。' : '');
      return;
    }

    if (!am && !pm) {
      previewValue.textContent = '—';
      previewHint.hidden = false;
      previewHint.textContent = '上午和下午至少填一段。';
      return;
    }

    var total = segMinutes(am) + segMinutes(pm);
    previewValue.textContent = humanDuration(total);

    if (segOvernight(am)) hints.push('上午下班早于上班，按跨天算。');
    if (segOvernight(pm)) hints.push('下午下班早于上班，按跨天算。');

    // 上午/下午有重叠或顺序反了，给个提醒但不阻止保存
    if (am && pm) {
      var amStart = toMinutes(am.start), amEnd = toMinutes(am.end);
      var pmStart = toMinutes(pm.start), pmEnd = toMinutes(pm.end);
      if (!segOvernight(am) && !segOvernight(pm)) {
        if (pmStart < amStart) hints.push('下午上班时间比上午还早，确认一下是不是填反了。');
        else if (pmStart < amEnd) hints.push('下午上班早于上午下班，两段时间有重叠。');
        if (pmEnd < amEnd && pmStart < amEnd) hints.push('下午下班早于上午下班，确认一下。');
      }
    }

    previewHint.hidden = !hints.length;
    previewHint.textContent = hints.join(' ');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var date = fDate.value;
    var am = readHalf(fAmStart, fAmEnd);
    var pm = readHalf(fPmStart, fPmEnd);
    var note = fNote.value.trim();

    if (!date) { toast('请选择日期'); fDate.focus(); return; }
    if (am === undefined) { toast('上午的上下班时间要填完整'); fAmStart.focus(); return; }
    if (pm === undefined) { toast('下午的上下班时间要填完整'); fPmStart.focus(); return; }
    if (!am && !pm) { toast('上午和下午至少填一段'); fAmStart.focus(); return; }

    // 同一天已有别的记录时，视为修改那一天，避免出现重复日期
    var dup = days.filter(function (d) { return d.date === date && d.id !== editingId; })[0];
    if (dup) {
      var ok = window.confirm(friendlyDate(date) + ' 已经记过了，要覆盖成这次填的时间吗？');
      if (!ok) return;
    }

    if (editingId) {
      days = days.map(function (d) {
        return d.id === editingId ? { id: d.id, date: date, am: am, pm: pm, note: note } : d;
      });
      toast('已修改');
    } else if (dup) {
      days = days.map(function (d) {
        return d.id === dup.id ? { id: d.id, date: date, am: am, pm: pm, note: note } : d;
      });
      toast('已覆盖 ' + friendlyDate(date) + ' 的记录');
    } else {
      days.push({ id: uid(), date: date, am: am, pm: pm, note: note });
      toast('已记下 ' + friendlyDate(date) + ' ' + humanDuration(segMinutes(am) + segMinutes(pm)));
    }

    if (save()) {
      closeSheet();
      render();
    }
  });

  function uid() {
    return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  $('sheetClose').addEventListener('click', closeSheet);
  sheetMask.addEventListener('click', closeSheet);

  btnDelete.addEventListener('click', function () {
    if (!editingId) return;
    var target = days.filter(function (d) { return d.id === editingId; })[0];
    var label = target ? friendlyDate(target.date) : '这一天';
    if (!window.confirm('确定删除' + label + '的工时记录吗？删除后不能恢复。')) return;
    days = days.filter(function (d) { return d.id !== editingId; });
    if (save()) {
      closeSheet();
      render();
      toast('已删除');
    }
  });

  [fAmStart, fAmEnd, fPmStart, fPmEnd, fDate].forEach(function (el) {
    el.addEventListener('input', updatePreview);
    el.addEventListener('change', updatePreview);
  });

  /* ---------------- 导航 ---------------- */

  function render() {
    if (currentView === 'list') renderList(); else renderStats();
    $('topbarSub').textContent = currentView === 'list'
      ? '上午、下午分开记上下班时间'
      : '看看这段时间的工作节奏';
    $('btnAdd').hidden = currentView !== 'list';
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-view') === currentView);
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () {
      currentView = t.getAttribute('data-view');
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  $('btnAdd').addEventListener('click', function () { openSheet(null); });
  $('btnExportTop').addEventListener('click', exportCsv);

  /* ---------------- 启动 ---------------- */

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  load();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
