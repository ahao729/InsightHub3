/* ============================================
   InsightHub Data — 独立运行环境 Stub
   原型中的 sendPrompt() 原本用于在 Claude 对话中
   触发下一条消息；脱离该环境后，这里用一个轻量提示
   条代替，方便预览交互而不报错。
   ============================================ */

window.sendPrompt = function (text) {
  showStubToast('（原型提示）将跳转至: ' + text);
};

function showStubToast(msg) {
  var el = document.getElementById('__stub_toast__');
  if (!el) {
    el = document.createElement('div');
    el.id = '__stub_toast__';
    el.style.position = 'fixed';
    el.style.bottom = '20px';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.background = '#1A1A1A';
    el.style.color = '#fff';
    el.style.padding = '10px 18px';
    el.style.borderRadius = '8px';
    el.style.fontSize = '13px';
    el.style.fontFamily = 'sans-serif';
    el.style.zIndex = '9999';
    el.style.opacity = '0';
    el.style.transition = 'opacity .2s';
    el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(window.__stub_toast_timer__);
  window.__stub_toast_timer__ = setTimeout(function () {
    el.style.opacity = '0';
  }, 2200);
}

/* window.storage stub：内存版 key-value 存储，模拟持久化 API */
window.storage = (function () {
  var mem = {};
  return {
    get: async function (key, shared) {
      var k = (shared ? 'shared:' : 'priv:') + key;
      if (!(k in mem)) throw new Error('Key not found: ' + key);
      return { key: key, value: mem[k], shared: !!shared };
    },
    set: async function (key, value, shared) {
      var k = (shared ? 'shared:' : 'priv:') + key;
      mem[k] = value;
      return { key: key, value: value, shared: !!shared };
    },
    delete: async function (key, shared) {
      var k = (shared ? 'shared:' : 'priv:') + key;
      var existed = k in mem;
      delete mem[k];
      return { key: key, deleted: existed, shared: !!shared };
    },
    list: async function (prefix, shared) {
      var p = (shared ? 'shared:' : 'priv:') + (prefix || '');
      var keys = Object.keys(mem).filter(function (k) { return k.indexOf(p) === 0; })
        .map(function (k) { return k.replace(/^shared:|^priv:/, ''); });
      return { keys: keys, prefix: prefix, shared: !!shared };
    }
  };
})();

/* ═══════════════════════════════════════════
   移动端汉堡菜单导航切换
   ═══════════════════════════════════════════ */
(function() {
  function initMobileNav() {
    var btn = document.getElementById('hamburger-btn');
    var drawer = document.getElementById('mobile-drawer');
    var backdrop = document.getElementById('drawer-backdrop');
    if (!btn || !drawer || !backdrop) return;
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var open = drawer.classList.toggle('open');
      backdrop.classList.toggle('open', open);
      btn.classList.toggle('active', open);
      btn.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('drawer-open', open);
    });
    backdrop.addEventListener('click', function() {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('drawer-open');
    });
    // ESC 键关闭
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && drawer.classList.contains('open')) {
        backdrop.click();
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
})();
