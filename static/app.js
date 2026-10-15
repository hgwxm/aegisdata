/* ══════════════════════════════════════════════════════════════
   AegisData · 企业数据安全管理平台
   第一阶段前端初稿 · 共享数据层 + 页面控制器
   ──────────────────────────────────────────────────────────────
   ⚠️ 本文件只负责「呈现」，不实现任何权限判断规则。
      DEMO_DECISIONS 是纯前端预置的演示数据，用于固定信息层级；
      接入后端统一入口 check_permission(user_role, file_id, action)
      之后，必须整体删除 DEMO_DECISIONS 与 resolve()，改为请求
      POST /api/access 获取 { request_id, decision, reason, executed }。

   页面通过 <body data-page="..."> 声明身份：
     console → 访问控制台      audit → 审计日志
     rules   → 权限规则（只读） about → 系统说明（只读）
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ══════════ 1. 字典：只能来自 docs/file_list.md 与 docs/permission_rules.md ══════════ */

  const ROLES = {
    employee: '普通员工 · employee',
    finance:  '财务人员 · finance',
    admin:    '管理员 · admin',
    hr:       '人事专员 · hr',
    auditor:  '内部审计 · auditor'
  };

  /* 表格等窄栏位使用的角色简称 */
  const ROLE_SHORT = {
    employee: '普通员工',
    finance:  '财务人员',
    admin:    '管理员',
    hr:       '人事专员',
    auditor:  '内部审计'
  };

  const FILES = {
    F001: 'F001 · 普通业务报告',
    F002: 'F002 · 内部财务报告',
    F003: 'F003 · 敏感工资表'
  };

  const ACTIONS = {
    read:   '读取',
    export: '导出'
  };

  /* ══════════ 2. 演示数据（接入后端后整体删除） ══════════ */

  const DEMO_DECISIONS = {
    'employee|F001|read':   { decision: 'ALLOW',            reason: '该角色对该文件有读取权限' },
    'employee|F001|export': { decision: 'ALLOW',            reason: '该角色对该文件有导出权限' },
    'employee|F002|read':   { decision: 'DENY',             reason: '普通员工无权访问内部财务报告' },
    'employee|F002|export': { decision: 'PENDING_APPROVAL', reason: '导出内部财务报告需要审批' },
    'employee|F003|read':   { decision: 'DENY',             reason: '普通员工无权访问敏感工资数据' },
    'employee|F003|export': { decision: 'DENY',             reason: '普通员工无权导出敏感工资数据' },
    'finance|F001|read':    { decision: 'ALLOW',            reason: '该角色对该文件有读取权限' },
    'finance|F001|export':  { decision: 'ALLOW',            reason: '该角色对该文件有导出权限' },
    'finance|F002|read':    { decision: 'ALLOW',            reason: '该角色对该文件有读取权限' },
    'finance|F002|export':  { decision: 'ALLOW',            reason: '该角色对该文件有导出权限' },
    'finance|F003|read':    { decision: 'DENY',             reason: '财务人员无权访问敏感工资数据' },
    'finance|F003|export':  { decision: 'DENY',             reason: '财务人员无权导出敏感工资数据' },
    'admin|F001|read':      { decision: 'ALLOW',            reason: '该角色对该文件有读取权限' },
    'admin|F001|export':    { decision: 'ALLOW',            reason: '该角色对该文件有导出权限' },
    'admin|F002|read':      { decision: 'ALLOW',            reason: '该角色对该文件有读取权限' },
    'admin|F002|export':    { decision: 'ALLOW',            reason: '该角色对该文件有导出权限' },
    'admin|F003|read':      { decision: 'ALLOW',            reason: '该角色对该文件有读取权限' },
    'admin|F003|export':    { decision: 'ALLOW',            reason: '该角色对该文件有导出权限' }
  };

  const UNKNOWN_REASON = {
    role:   '未知用户角色，按安全策略默认拒绝',
    file:   '未知文件编号，按安全策略默认拒绝',
    action: '未知操作类型，按安全策略默认拒绝'
  };

  /* 判定结果的呈现文案与图标 */
  const ICONS = {
    ALLOW:            '<path d="M5 12.6l4.4 4.4L19 7.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    DENY:             '<circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="2"/><path d="M6.4 17.6 17.6 6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    PENDING_APPROVAL: '<circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="2"/><path d="M12 7.4V12l3.2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  const VERDICT = {
    ALLOW: {
      cls:        'is-allow',
      title:      '操作允许',
      sub:        '权限检查通过，文件操作已在受控流程中执行',
      proofTitle: '文件操作已执行',
      proofDesc:  '判定为 ALLOW，操作已在受控流程中完成，实际结果已写入审计日志。',
      executed:   true
    },
    DENY: {
      cls:        'is-deny',
      title:      '操作拒绝',
      sub:        '权限规则不允许该操作，已在文件操作之前拦截',
      proofTitle: '已证明：文件操作没有执行',
      proofDesc:  '判定为 DENY，系统在真实文件操作之前完成拦截，未读取、未导出目标文件。',
      executed:   false
    },
    PENDING_APPROVAL: {
      cls:        'is-pending',
      title:      '待审批',
      sub:        '该操作需要人工审批，审批完成前不得执行',
      proofTitle: '已证明：审批完成前没有执行',
      proofDesc:  '判定为 PENDING_APPROVAL，操作进入审批流程，审批通过前未读取、未导出目标文件。',
      executed:   false
    }
  };

  /* ══════════ 3. 唯一"规则"来源：查表。未知组合一律不放行 ══════════ */

  function resolve(role, fileId, action) {
    if (!Object.prototype.hasOwnProperty.call(ROLES, role)) {
      return { decision: 'DENY', reason: UNKNOWN_REASON.role };
    }
    if (!Object.prototype.hasOwnProperty.call(FILES, fileId)) {
      return { decision: 'DENY', reason: UNKNOWN_REASON.file };
    }
    if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) {
      return { decision: 'DENY', reason: UNKNOWN_REASON.action };
    }
    return DEMO_DECISIONS[role + '|' + fileId + '|' + action] ||
           { decision: 'DENY', reason: '未匹配到任何授权规则，按安全策略默认拒绝' };
  }

  /* ══════════ 4. 存储：记录跨页面共享（演示用 localStorage） ══════════ */

  const STORE_KEY = 'aegisdata.records.v1';

  const store = (function () {
    let memory = [];
    let usable = false;
    try {
      window.localStorage.setItem('__t', '1');
      window.localStorage.removeItem('__t');
      usable = true;
    } catch (e) {
      usable = false;   /* file:// 下某些浏览器禁用 localStorage，退回内存存储 */
    }
    return {
      all: function () {
        if (!usable) return memory;
        try {
          const raw = window.localStorage.getItem(STORE_KEY);
          return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
      },
      save: function (list) {
        if (!usable) { memory = list; return; }
        try {
          window.localStorage.setItem(STORE_KEY, JSON.stringify(list));
        } catch (e) { memory = list; }
      },
      clear: function () {
        memory = [];
        if (!usable) return;
        try { window.localStorage.removeItem(STORE_KEY); } catch (e) { /* 忽略 */ }
      },
      persistent: usable
    };
  })();

  /* ══════════ 5. 工具 ══════════ */

  const $ = function (id) { return document.getElementById(id); };

  function pad(n) { return String(n).padStart(2, '0'); }

  function stamp(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
           ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function makeRequestId(d, n) {
    return 'REQ' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
           pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) +
           String(n).padStart(2, '0');
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  const ICON_EXEC_YES = '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.2" stroke="currentColor" stroke-width="1.6"/><path d="M6.8 10.2l2.3 2.3 4.1-4.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_EXEC_NO  = '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.2" stroke="currentColor" stroke-width="1.6"/><path d="M7.2 10h5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  /* 表格里的判定徽标：PENDING_APPROVAL 太长，窄栏位显示为"待审批" */
  function decisionTag(decision) {
    const map = {
      ALLOW:            ['tag--allow',   'ALLOW'],
      DENY:             ['tag--deny',    'DENY'],
      PENDING_APPROVAL: ['tag--pending', '待审批']
    };
    const item = map[decision] || ['tag--deny', decision];
    return '<span class="tag ' + item[0] + '" title="' + esc(decision) + '">' + item[1] + '</span>';
  }

  function execCell(decision) {
    const v = VERDICT[decision] || VERDICT.DENY;
    return v.executed
      ? '<span class="exec exec--yes">' + ICON_EXEC_YES + '已执行</span>'
      : '<span class="exec exec--no">'  + ICON_EXEC_NO  + '未执行</span>';
  }

  /* 只显示 时:分:秒 —— 控制台表格列较窄 */
  function shortTime(t) {
    const s = String(t || '');
    const sp = s.indexOf(' ');
    return sp >= 0 ? s.slice(sp + 1) : s;
  }

  function todayCount() {
    const d = new Date();
    const today = stamp(d).slice(0, 10);
    return store.all().filter(function (r) { return String(r.time).slice(0, 10) === today; }).length;
  }

  /* 审计日志表格行（完整 8 列） */
  function historyRow(r) {
    return '<tr' + (r.isNew ? ' class="is-new"' : '') + '>' +
      '<td class="mono c-time">' + esc(r.time) + '</td>' +
      '<td class="mono c-req" title="' + esc(r.requestId) + '">' + esc(r.requestId) + '</td>' +
      '<td title="' + esc(ROLES[r.role] || r.role) + '">' + esc(ROLE_SHORT[r.role] || r.role) + '</td>' +
      '<td><span class="tag-code">' + esc(r.fileId) + '</span></td>' +
      '<td class="c-act">' + esc(ACTIONS[r.action] || r.action) + '</td>' +
      '<td>' + decisionTag(r.decision) + '</td>' +
      '<td class="reason" title="' + esc(r.reason) + '">' + esc(r.reason) + '</td>' +
      '<td class="ta-c">' + execCell(r.decision) + '</td>' +
    '</tr>';
  }

  /* 控制台「最近访问记录」：时间 / 用户 / 资源 / 操作 / 结果 */
  function recentRow(r) {
    return '<tr' + (r.isNew ? ' class="is-new"' : '') + '>' +
      '<td class="mono c-time">' + esc(shortTime(r.time)) + '</td>' +
      '<td class="c-user">' + esc(ROLE_SHORT[r.role] || r.role) + '</td>' +
      '<td class="c-res" title="' + esc(FILES[r.fileId] || r.fileId) + '">' +
        esc(FILES[r.fileId] || r.fileId) + '</td>' +
      '<td>' + esc(ACTIONS[r.action] || r.action) + '</td>' +
      '<td>' + decisionTag(r.decision) + '</td>' +
    '</tr>';
  }

  function emptyRow(text, cols) {
    return '<tr><td colspan="' + (cols || 8) + '" class="empty">' + text + '</td></tr>';
  }

  function updateNavCount() {
    const n = $('navCount');
    if (n) n.textContent = String(store.all().length);
  }

  /* ── 轻提示 ── */
  let toastTimer = null;
  function toast(message, decision) {
    let t = $('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      t.innerHTML = '<svg viewBox="0 0 24 24" fill="none">' +
        '<path d="M5 12.6l4.4 4.4L19 7.4" stroke="currentColor" stroke-width="2.4" ' +
        'stroke-linecap="round" stroke-linejoin="round"/></svg><span></span>';
      document.body.appendChild(t);
    }
    t.className = 'toast' + (decision === 'DENY' ? ' is-deny'
                           : decision === 'PENDING_APPROVAL' ? ' is-pending' : '');
    t.lastChild.textContent = message;
    /* 强制重排后再加 is-show，保证过渡生效 */
    void t.offsetWidth;
    t.classList.add('is-show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { t.classList.remove('is-show'); }, 2600);
  }

  /* ══════════ 6. 控制台页 ══════════ */

  function initConsole() {
    let seq = 0;

    const el = {
      form:        $('requestForm'),
      role:        $('role'),
      file:        $('file'),
      action:      $('action'),
      submitBtn:   $('submitBtn'),
      result:      $('result'),
      badge:       $('decisionBadge'),
      verdictIcon: document.querySelector('.verdict__icon svg'),
      vTitle:      $('verdictTitle'),
      vSub:        $('verdictSub'),
      kvRequestId: $('kvRequestId'),
      kvDecision:  $('kvDecision'),
      kvRole:      $('kvRole'),
      kvReason:    $('kvReason'),
      kvFile:      $('kvFile'),
      kvExecuted:  $('kvExecuted'),
      kvAction:    $('kvAction'),
      kvTime:      $('kvTime'),
      proofTitle:  $('proofTitle'),
      proofDesc:   $('proofDesc'),
      btnView:     $('btnView'),
      btnExport:   $('btnExport'),
      resultNote:  $('resultNote'),
      historyBody: $('historyBody'),
      search:      $('search'),
      statToday:   $('statToday'),
      statLogs:    $('statLogs'),
      live:        $('live')
    };

    /* 把最近一次记录渲染进结果卡片 */
    function renderResult(rec) {
      const v = VERDICT[rec.decision] || VERDICT.DENY;

      el.result.classList.remove('is-allow', 'is-deny', 'is-pending');
      el.result.classList.add(v.cls);
      el.result.dataset.decision = rec.decision;

      el.badge.textContent = rec.decision;
      el.vTitle.textContent = v.title;
      el.vSub.textContent = v.sub;
      if (el.verdictIcon) el.verdictIcon.innerHTML = ICONS[rec.decision] || ICONS.DENY;

      el.kvRequestId.textContent = rec.requestId;
      el.kvDecision.textContent = rec.decision;
      el.kvRole.textContent = ROLES[rec.role] || rec.role;
      el.kvReason.textContent = rec.reason;
      el.kvFile.textContent = FILES[rec.fileId] || rec.fileId;
      el.kvAction.textContent = ACTIONS[rec.action] || rec.action;
      el.kvTime.textContent = rec.time;
      el.kvExecuted.textContent = v.executed ? '已执行' : '未执行';
      el.kvExecuted.style.color = v.executed ? 'var(--allow)' : 'var(--ink-2)';
      el.kvExecuted.style.fontWeight = '600';

      el.proofTitle.textContent = v.proofTitle;
      el.proofDesc.textContent = v.proofDesc;

      el.btnView.disabled = !v.executed;
      el.btnExport.disabled = !(v.executed && rec.action === 'export');
      /* 读取请求没有可下载的产物，直接不显示下载按钮 */
      el.btnExport.hidden = (rec.action !== 'export');
      el.resultNote.textContent = '判定时间 ' + rec.time;

      el.result.classList.remove('is-flash');
      void el.result.offsetWidth;
      el.result.classList.add('is-flash');
    }

    function renderHistory() {
      const kw = (el.search && el.search.value || '').trim().toLowerCase();
      const all = store.all();
      const rows = all.filter(function (r) {
        if (!kw) return true;
        return (r.requestId + ' ' + r.fileId + ' ' + r.role + ' ' + r.decision)
          .toLowerCase().indexOf(kw) !== -1;
      }).slice(0, 6);

      el.historyBody.innerHTML = rows.length
        ? rows.map(recentRow).join('')
        : emptyRow(all.length ? '没有匹配的记录' : '暂无访问记录，提交一次访问申请试试', 5);

      /* 概览统计 */
      if (el.statToday) el.statToday.textContent = String(todayCount());
      if (el.statLogs)  el.statLogs.textContent  = String(all.length);
      if (all.length) {
        Array.prototype.forEach.call(document.querySelectorAll('.foot__time'), function (n) { n.textContent = all[0].time; });
      }

      updateNavCount();
    }

    /* 首屏那次自动判定不算用户操作，不触发滚动 */
    let userInitiated = false;

    function submit(role, fileId, action) {
      const now = new Date();

      fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ file_id: fileId, action: action })
      })
      .then(function (resp) {
        if (resp.status === 401) { window.location.href = '/login'; throw new Error('未登录'); }
        return resp.json();
      })
      .then(function (data) {
        const rec = {
          requestId: data.request_id || makeRequestId(now, ++seq),
          time:      data.timestamp || stamp(now),
          role:      role,
          fileId:    fileId,
          action:    action,
          decision:  data.decision,
          reason:    data.reason,
          isNew:     true
        };

        renderResult(rec);

        const all = store.all();
        all.forEach(function (r) { r.isNew = false; });
        all.unshift(rec);
        while (all.length > 200) all.pop();
        store.save(all);
        renderHistory();

        if (el.live) {
          el.live.textContent = rec.requestId + ' ' + rec.decision + '：' + rec.reason;
        }

        if (userInitiated) {
          const tip = {
            ALLOW:            '操作允许 · 文件操作已执行',
            DENY:             '操作拒绝 · 文件操作未执行',
            PENDING_APPROVAL: '待审批 · 审批完成前不得执行'
          };
          toast(tip[rec.decision] || rec.decision, rec.decision);
        }

        /* 窄屏时结果区在表单下方，滚动过去 */
        if (userInitiated && window.innerWidth < 1220) {
          el.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      })
      .catch(function (err) {
        if (err && err.message === '未登录') return;
        /* 网络错误时用本地兜底，保证页面不空白 */
        const verdict = resolve(role, fileId, action);
        const rec = {
          requestId: makeRequestId(now, ++seq),
          time:      stamp(now),
          role:      role,
          fileId:    fileId,
          action:    action,
          decision:  verdict.decision,
          reason:    '后端不可达，本地兜底：' + verdict.reason,
          isNew:     true
        };
        renderResult(rec);
      });
    }

    /* ── 事件 ── */
    el.form.addEventListener('submit', function (e) {
      e.preventDefault();
      userInitiated = true;
      const btn = el.submitBtn;
      btn.disabled = true;
      window.setTimeout(function () {
        submit(el.role.value, el.file.value, el.action.value);
        btn.disabled = false;
      }, 240);
    });

    Array.prototype.forEach.call(document.querySelectorAll('.tbtn'), function (b) {
      b.addEventListener('click', function () {
        el.role.value = b.dataset.r;
        el.file.value = b.dataset.f;
        el.action.value = b.dataset.a;
        el.form.dispatchEvent(new Event('submit', { cancelable: true }));
      });
    });

    if (el.search) el.search.addEventListener('input', renderHistory);

    /* ── 首次进入：补四条演示记录（已存在记录则不重复播种） ── */
    if (store.all().length === 0) {
      const seedRows = [
        { role: 'employee', fileId: 'F003', action: 'read'   },
        { role: 'employee', fileId: 'F002', action: 'export' },
        { role: 'finance',  fileId: 'F002', action: 'read'   },
        { role: 'employee', fileId: 'F001', action: 'read'   }
      ];
      const base = new Date(Date.now() - 12 * 60 * 1000);
      const seeded = seedRows.map(function (row, i) {
        const t = new Date(base.getTime() + i * 190000);
        const v = resolve(row.role, row.fileId, row.action);
        seq += 1;
        return {
          requestId: makeRequestId(t, seq),
          time:      stamp(t),
          role:      row.role,
          fileId:    row.fileId,
          action:    row.action,
          decision:  v.decision,
          reason:    v.reason,
          isNew:     false
        };
      }).reverse();
      store.save(seeded);
    }

    /* 初始展示一次判定，避免结果卡空白（使用当前登录用户角色） */
    renderHistory();
    submit(currentUser ? currentUser.role : 'employee', 'F001', 'read');
    const all = store.all();
    if (all[0]) { all[0].isNew = false; store.save(all); }
    renderHistory();

    return {
      refresh: function () {
        renderHistory();
      }
    };
  }

  /* ══════════ 7. 审计日志页 ══════════ */

  function initAudit() {
    const state = { decision: 'ALL', exec: 'ALL', kw: '' };

    const el = {
      body:        $('auditBody'),
      search:      $('search'),
      segDecision: $('segDecision'),
      segExec:     $('segExec'),
      btnClear:    $('btnClear'),
      scrim:       $('scrim'),
      drawer:      $('drawer'),
      drawerClose: $('drawerClose'),
      drawerTitle: $('drawerTitle'),
      drawerSub:   $('drawerSub'),
      drawerVerdict: $('drawerVerdict'),
      drawerFields:  $('drawerFields'),
      drawerProof:   $('drawerProof'),
      drawerProofTitle: $('drawerProofTitle'),
      drawerProofDesc:  $('drawerProofDesc'),
      statTotal:   $('statTotal'),
      statAllow:   $('statAllow'),
      statDeny:    $('statDeny'),
      statPending: $('statPending')
    };

    let openId = null;
    let started = false;

    /* 单文件版：审计页区块初始是 hidden，首次进入该页时才真正渲染 */
    function start() {
      if (started) return;
      started = true;
      render();
    }

    function filtered() {
      const kw = state.kw.toLowerCase();
      return store.all().filter(function (r) {
        if (state.decision !== 'ALL' && r.decision !== state.decision) return false;

        const v = VERDICT[r.decision] || VERDICT.DENY;
        if (state.exec === 'yes' && !v.executed) return false;
        if (state.exec === 'no'  &&  v.executed) return false;

        if (!kw) return true;
        return (r.requestId + ' ' + r.fileId + ' ' + r.role + ' ' + r.decision + ' ' + r.reason)
          .toLowerCase().indexOf(kw) !== -1;
      });
    }

    function renderStats() {
      const all = store.all();
      el.statTotal.textContent = String(all.length);
      el.statAllow.textContent = String(all.filter(function (r) { return r.decision === 'ALLOW'; }).length);
      el.statDeny.textContent  = String(all.filter(function (r) { return r.decision === 'DENY'; }).length);
      el.statPending.textContent = String(all.filter(function (r) { return r.decision === 'PENDING_APPROVAL'; }).length);
      updateNavCount();
    }

    function renderTable() {
      const rows = filtered();
      if (!rows.length) {
        el.body.innerHTML = emptyRow(store.all().length ? '没有符合筛选条件的记录' : '暂无日志，去访问控制台发起一次申请');
        return;
      }
      el.body.innerHTML = rows.map(function (r) {
        return historyRow(r)
          .replace(' class="is-new"', '')
          .replace('<tr', '<tr data-id="' + esc(r.requestId) + '" tabindex="0" class="is-row' +
                   (r.isNew ? ' is-new' : '') + '"');
      }).join('');

      Array.prototype.forEach.call(el.body.querySelectorAll('tr[data-id]'), function (tr) {
        tr.setAttribute('aria-selected', String(tr.dataset.id === openId));
        tr.addEventListener('click', function () { openDrawer(tr.dataset.id); });
        tr.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(tr.dataset.id); }
        });
      });
    }

    function render() { renderStats(); renderTable(); }

    /* ── 详情抽屉 ── */
    function openDrawer(id) {
      const rec = store.all().filter(function (r) { return r.requestId === id; })[0];
      if (!rec) return;

      const v = VERDICT[rec.decision] || VERDICT.DENY;
      openId = id;

      el.drawerTitle.textContent = rec.requestId;
      el.drawerSub.textContent = rec.time + ' · ' + (ACTIONS[rec.action] || rec.action) +
                                 ' · ' + (FILES[rec.fileId] || rec.fileId);

      el.drawerVerdict.innerHTML =
        '<span class="badge" style="border-color:' +
        (rec.decision === 'ALLOW' ? 'var(--allow-line)' : rec.decision === 'DENY' ? 'var(--deny-line)' : 'var(--pending-line)') +
        ';color:' +
        (rec.decision === 'ALLOW' ? 'var(--allow)' : rec.decision === 'DENY' ? 'var(--deny)' : 'var(--pending)') +
        '">' + esc(rec.decision) + '</span>' +
        '<p style="margin-top:10px;font-size:13px;color:var(--ink-2)">' + esc(v.sub) + '</p>';

      const fields = [
        ['id',         rec.requestId],
        ['timestamp',  rec.time],
        ['request_id', rec.requestId],
        ['user_role',  rec.role],
        ['file_id',    rec.fileId],
        ['action',     rec.action],
        ['decision',   rec.decision],
        ['reason',     rec.reason],
        ['executed',   v.executed ? 'true' : 'false']
      ];
      el.drawerFields.innerHTML = fields.map(function (f) {
        return '<div class="dl__row"><dt>' + f[0] + '</dt><dd class="mono">' + esc(f[1]) + '</dd></div>';
      }).join('');

      el.drawerProof.classList.remove('is-allow');
      el.drawerProof.className = 'proof ' + v.cls;
      el.drawerProofTitle.textContent = v.proofTitle;
      el.drawerProofDesc.textContent = v.proofDesc;

      el.drawer.classList.add('is-open');
      el.drawer.setAttribute('aria-hidden', 'false');
      el.scrim.classList.add('is-open');
      renderTable();
    }

    function closeDrawer() {
      openId = null;
      el.drawer.classList.remove('is-open');
      el.drawer.setAttribute('aria-hidden', 'true');
      el.scrim.classList.remove('is-open');
      renderTable();
    }

    el.drawerClose.addEventListener('click', closeDrawer);
    el.scrim.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    /* ── 筛选事件 ── */
    el.segDecision.addEventListener('click', function (e) {
      const b = e.target.closest('.seg__btn');
      if (!b) return;
      start();
      state.decision = b.dataset.d;
      Array.prototype.forEach.call(el.segDecision.querySelectorAll('.seg__btn'), function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      renderTable();
    });

    el.segExec.addEventListener('click', function (e) {
      const b = e.target.closest('.seg__btn');
      if (!b) return;
      start();
      state.exec = b.dataset.e;
      Array.prototype.forEach.call(el.segExec.querySelectorAll('.seg__btn'), function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      renderTable();
    });

    el.search.addEventListener('input', function () {
      start();
      state.kw = el.search.value || '';
      renderTable();
    });

    el.btnClear.addEventListener('click', function () {
      start();
      if (!store.all().length) return;
      if (window.confirm('确定清空全部审计日志记录吗？（仅影响本机演示数据）')) {
        store.clear();
        closeDrawer();
        render();
      }
    });

    render();

    return {
      refresh: function () {
        if (started) render();
      }
    };
  }

  /* ══════════ 8. 登录用户信息 + 顶部栏更新 ══════════ */

  let currentUser = null;  /* { account, name, role, role_label, department, employee_id } */

  /* 更新顶部栏用户区域 + 登出按钮 */
  function updateTopBar(user) {
    currentUser = user;
    /* 更新头像 */
    var avatars = document.querySelectorAll('.top__avatar');
    avatars.forEach(function (el) { el.textContent = user.name ? user.name.charAt(0) : '?'; });
    /* 更新用户名和角色 */
    var whoB = document.querySelectorAll('.top__who b');
    whoB.forEach(function (el) { el.textContent = user.name || user.account; });
    var whoSpan = document.querySelectorAll('.top__who span');
    whoSpan.forEach(function (el) { el.textContent = user.role_label || ROLE_SHORT[user.role] || user.role; });
    /* 锁定角色选择器为当前用户角色 */
    var roleSelect = document.getElementById('role');
    if (roleSelect) {
      roleSelect.value = user.role;
      roleSelect.disabled = true;
    }
    /* 同步"当前用户"卡片 */
    var cardName = document.getElementById('currentUserName');
    if (cardName) cardName.textContent = user.name || user.account;
    var cardRole = document.getElementById('currentUserRole');
    if (cardRole) cardRole.textContent = (user.role_label || ROLE_SHORT[user.role] || user.role) + ' · ' + user.role;
  }

  /* 从后端获取当前登录用户信息 */
  function fetchCurrentUser() {
    return fetch('/api/me', { credentials: 'same-origin' })
      .then(function (resp) {
        if (resp.status === 401) {
          window.location.href = '/login';
          return null;
        }
        return resp.json();
      })
      .then(function (data) {
        if (data && data.user) {
          updateTopBar(data.user);
          return data.user;
        }
        return null;
      })
      .catch(function () {
        window.location.href = '/login';
        return null;
      });
  }

  /* 登出 */
  function setupLogout() {
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
          .then(function () { window.location.href = '/login'; })
          .catch(function () { window.location.href = '/login'; });
      });
    }
  }

  /* ══════════ 9. 页面初始化 ══════════
   多文件版：一个文档就是一个页面，按 body[data-page] 初始化。
   单文件版：四个页面区块同时在文档里（由 CSS radio 切换显示），
             因此四个都要初始化；各自只操作自己区块内的元素。
   ------------------------------------------------ */

  const ROUTES = ['console', 'audit', 'rules', 'about'];

  function routeFromHash() {
    const h = (window.location.hash || '').replace(/^#/, '');
    return ROUTES.indexOf(h) !== -1 ? h : 'console';
  }

  /* 单文件版：四个页面区块同在一个文档，明確切换 is-shown */
  function showPage(route) {
    Array.prototype.forEach.call(document.querySelectorAll('.page'), function (s) {
      const m = String(s.className).match(/page--(\w+)/);
      const on = !!(m && m[1] === route);
      if (on) { s.classList.add('is-shown'); } else { s.classList.remove('is-shown'); }
      s.style.display = on ? 'flex' : 'none';
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (a) {
      const on = a.dataset.nav === route;
      a.classList.toggle('is-active', on);
      if (on) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); }
    });
    window.scrollTo(0, 0);
  }

  function boot() {
    updateNavCount();
    setupLogout();

    /* 先获取当前登录用户信息，再初始化页面 */
    fetchCurrentUser().then(function (user) {
      if (!user) return;  /* 未登录已跳转到 /login */

      if (document.body.dataset.single) {
        /* 单文件版：初始化全部区块，并按 hash 切页 */
        if ($('requestForm')) initConsole();
        if ($('auditBody')) initAudit();

        if (!window.location.hash) {
          try { window.history.replaceState(null, '', '#console'); } catch (e) { /* 忽略 */ }
        }
        window.addEventListener('hashchange', function () { showPage(routeFromHash()); });
        showPage(routeFromHash());
        return;
      }
      /* 多文件版 */
      const page = document.body.dataset.page || '';
      if (page === 'console') initConsole();
      else if (page === 'audit') initAudit();
    });
  }

  window.__aegis = window.__aegis || {};

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();