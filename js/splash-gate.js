/* Splash gate: the animated logo plays once per visit, on whichever page the visitor lands on.
   Loaded as a blocking script right after the splash markup. Already seen this visit: the
   splash is removed before the first paint. First page of the visit: the Lottie player
   (if the page hasn't loaded it) and the splash animation are loaded, in that order.
   data-base: path from this page to the site root ("", "../", "../../"). */
(() => {
  const gate = document.currentScript;
  const splash = document.querySelector(".splash");
  if (!splash) return;
  let seen = false;
  try {
    seen = sessionStorage.getItem("nimaya-splash") === "1";
    sessionStorage.setItem("nimaya-splash", "1");
  } catch {}
  if (seen) return splash.remove();

  const base = gate.dataset.base || "";
  const load = (src) => {
    const s = document.createElement("script");
    s.src = base + src;
    s.async = false; // keep the two in order
    document.head.append(s);
  };
  if (!window.lottie) load("js/vendor/lottie_svg.min.js");
  load("assets/lottie/splash.js");
})();
