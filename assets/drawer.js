// Mobile drawer - shared across all pages
(function() {
  var btn = document.getElementById('hamburger-btn');
  var drawer = document.getElementById('mobile-drawer');
  var backdrop = document.getElementById('drawer-backdrop');
  var closeBtn = document.getElementById('drawer-close');
  function openDrawer() {
    drawer.classList.add('open');
    backdrop.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
  if (btn) btn.addEventListener('click', openDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  document.querySelectorAll('.drawer-link').forEach(function(link) {
    link.addEventListener('click', closeDrawer);
  });
})();
