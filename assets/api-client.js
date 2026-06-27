/* ============================================
   InsightHub Data — 前端 API 客户端
   封装所有后端 API 调用、JWT 管理、错误处理
   ============================================ */

(function () {
  'use strict';

  // 自动检测环境：开发模式(Vite :3000)用独立后端端口，生产(nginx)用同域代理
  var API_BASE = (function () {
    if (window.location.port === '3000') {
      return 'http://localhost:4000/api/v1';
    }
    return '/api/v1';
  })();

  // ---- Token 管理 ----
  var TOKEN_KEY = 'ih_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function isAuthenticated() {
    return !!getToken();
  }

  // ---- 通用请求 ----
  function request(method, path, body) {
    var headers = {
      'Content-Type': 'application/json',
    };
    var token = getToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    var opts = {
      method: method,
      headers: headers,
    };
    if (body !== undefined && body !== null) {
      opts.body = JSON.stringify(body);
    }

    var url = API_BASE + path;

    return fetch(url, opts)
      .then(function (resp) {
        // 尝试解析 JSON
        return resp.json().then(function (json) {
          if (!resp.ok) {
            var err = new Error(
              (json.error && json.error.message) || '请求失败 (' + resp.status + ')'
            );
            err.status = resp.status;
            err.code = (json.error && json.error.code) || 'UNKNOWN';
            err.response = json;
            throw err;
          }
          return json;
        }).catch(function (parseErr) {
          // 如果 JSON 解析失败但请求成功
          if (resp.ok) {
            return { success: true, data: null };
          }
          // 非 JSON 响应
          var err = new Error('请求失败 (' + resp.status + ')');
          err.status = resp.status;
          err.code = 'PARSE_ERROR';
          throw err;
        });
      });
  }

  // ---- 公开 API ----
  window.API = {
    // === 认证 ===
    auth: {
      login: function (email, password) {
        return request('POST', '/auth/login', { email: email, password: password })
          .then(function (res) {
            setToken(res.data.token);
            return res.data;
          });
      },
      register: function (email, password, name) {
        return request('POST', '/auth/register', { email: email, password: password, name: name })
          .then(function (res) {
            setToken(res.data.token);
            return res.data;
          });
      },
      me: function () {
        return request('GET', '/auth/me').then(function (res) { return res.data; });
      },
      logout: function () {
        clearToken();
      },
      getToken: getToken,
      isAuthenticated: isAuthenticated,
    },

    // === API 密钥 ===
    apiKeys: {
      list: function () {
        return request('GET', '/api-keys').then(function (res) { return res.data; });
      },
      create: function (name) {
        return request('POST', '/api-keys', { name: name }).then(function (res) { return res.data; });
      },
      revoke: function (id) {
        return request('DELETE', '/api-keys/' + encodeURIComponent(id)).then(function (res) { return res.data; });
      },
    },

    // === 订阅 ===
    subscriptions: {
      plans: function () {
        return request('GET', '/subscriptions/plans').then(function (res) { return res.data; });
      },
      current: function () {
        return request('GET', '/subscriptions/current').then(function (res) { return res.data; });
      },
      subscribe: function (planCode) {
        return request('POST', '/subscriptions/subscribe', { plan_code: planCode }).then(function (res) { return res.data; });
      },
      cancel: function () {
        return request('POST', '/subscriptions/cancel').then(function (res) { return res.data; });
      },
    },

    // === 数据包 ===
    data: {
      stats: function (pkg) {
        return request('GET', '/data/' + encodeURIComponent(pkg) + '/stats').then(function (res) { return res.data; });
      },
      search: function (pkg, params) {
        var qs = [];
        if (params) {
          Object.keys(params).forEach(function (k) {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
              qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
            }
          });
        }
        var qstr = qs.length ? '?' + qs.join('&') : '';
        return request('GET', '/data/' + encodeURIComponent(pkg) + '/search' + qstr);
      },
      getById: function (pkg, id) {
        return request('GET', '/data/' + encodeURIComponent(pkg) + '/' + encodeURIComponent(id)).then(function (res) { return res.data; });
      },
    },

    // === 仪表盘 ===
    dashboard: {
      stats: function () {
        return request('GET', '/dashboard/stats').then(function (res) { return res.data; });
      },
    },

    // === 管理后台 ===
    admin: {
      getStats: function () {
        return request('GET', '/admin/stats').then(function (res) { return res.data; });
      },
      getUsers: function (params) {
        var qs = [];
        if (params) {
          Object.keys(params).forEach(function (k) {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
              qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
            }
          });
        }
        var qstr = qs.length ? '?' + qs.join('&') : '';
        return request('GET', '/admin/users' + qstr).then(function (res) { return res; });
      },
      getUserDetail: function (id) {
        return request('GET', '/admin/users/' + encodeURIComponent(id)).then(function (res) { return res.data; });
      },
      updateUser: function (id, body) {
        return request('PATCH', '/admin/users/' + encodeURIComponent(id), body).then(function (res) { return res.data; });
      },
      getApiKeys: function () {
        return request('GET', '/admin/api-keys').then(function (res) { return res; });
      },
      updateApiKey: function (id, body) {
        return request('PATCH', '/admin/api-keys/' + encodeURIComponent(id), body).then(function (res) { return res.data; });
      },
      getSubscriptions: function () {
        return request('GET', '/admin/subscriptions').then(function (res) { return res; });
      },
      getLogs: function (params) {
        var qs = [];
        if (params) {
          Object.keys(params).forEach(function (k) {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
              qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
            }
          });
        }
        var qstr = qs.length ? '?' + qs.join('&') : '';
        return request('GET', '/admin/logs' + qstr).then(function (res) { return res; });
      },
      getHealth: function () {
        return request('GET', '/admin/health').then(function (res) { return res.data; });
      },
    },

    // === 健康检查 ===
    health: function () {
      return fetch('http://localhost:4000/api/health').then(function (r) { return r.json(); });
    },
  };

  // ---- 页面工具：显示错误 ----
  window.showApiError = function (err, containerId) {
    var msg = err.message || '未知错误';
    var el = document.getElementById(containerId);
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    } else {
      alert(msg);
    }
  };

  // ---- 页面工具：显示加载状态 ----
  window.showLoading = function (containerId, show) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.style.display = show ? 'block' : 'none';
  };

  // ---- 页面工具：获取认证头（供 fetch 直接使用） ----
  window.authHeaders = function () {
    var h = { 'Content-Type': 'application/json' };
    var t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  };

})();
