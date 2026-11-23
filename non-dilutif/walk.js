/* Insights French Tech, section non dilutive : « La promenade » : une caméra avance dans une allée de cyprès.
 * Projection perspective simple : chaque objet a une position (x, z) dans le monde ;
 * à chaque défilement, la caméra avance en z et l'on recalcule échelle et position écran. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const W = 1600, H = 900, HOR = 455, F = 820, EYE = 34;
  const Z_END = 1520; // distance parcourue par la caméra
  const STAGE_Z = [400, 700, 1000, 1300];

  const C = {
    sky: "#1f5a5d", skyLow: "#2a6b6b", sun: "#f3e6c4", far: "#9fb3a6", far2: "#c7c4a6", city: "#b9b294",
    cloud: "#f4ead3", cloudSh: "#d8cfb4", ground: "#c9b98f", grass: "#7f8a55", grassDk: "#5f6b40",
    path: "#e7dcc0", pathLine: "#cbbd98", cyp: "#2d4630", cypLt: "#4a6845", stone: "#f1e7d0", stoneSh: "#d4c4a0", ink: "#3a3a2e",
  };

  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  const DEFS = `
    <pattern id="wk-dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#f3e6c4" opacity=".22"/></pattern>
    <pattern id="wk-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="5" stroke="#1b2a1c" stroke-width="1.4" opacity=".35"/></pattern>
    <pattern id="wk-hatch-l" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><line x1="0" y1="0" x2="0" y2="4" stroke="#9c8a62" stroke-width=".8" opacity=".45"/></pattern>
    <symbol id="wk-cypress" overflow="visible">
      <ellipse cx="4" cy="0" rx="13" ry="2.6" fill="#000" opacity=".16"/>
      <rect x="-1.4" y="-7" width="2.8" height="7" fill="#5b4630"/>
      <path d="M0,-4 C-13,-26 -14,-78 -2,-150 C-.6,-157 .6,-157 2,-150 C14,-78 13,-26 0,-4Z" fill="${C.cyp}"/>
      <path d="M0,-4 C-13,-26 -14,-78 -2,-150 C-6,-96 -7,-42 0,-4Z" fill="${C.cypLt}"/>
      <path d="M0,-4 C13,-26 14,-78 2,-150 C1,-100 3,-40 0,-4Z" fill="url(#wk-hatch)"/>
    </symbol>
    <symbol id="wk-column" overflow="visible">
      <ellipse cx="6" cy="0" rx="20" ry="3" fill="#000" opacity=".14"/>
      <rect x="-16" y="-26" width="32" height="26" fill="${C.stone}"/><rect x="8" y="-26" width="8" height="26" fill="${C.stoneSh}"/>
      <rect x="-16" y="-26" width="32" height="26" fill="none" stroke="${C.ink}" stroke-width=".5" opacity=".5"/>
      <rect x="-12" y="-31" width="24" height="5" fill="${C.stone}" stroke="${C.ink}" stroke-width=".4" stroke-opacity=".4"/>
      <rect x="-8.5" y="-131" width="17" height="100" fill="${C.stone}"/>
      <rect x="3" y="-131" width="5.5" height="100" fill="${C.stoneSh}"/>
      <rect x="3" y="-131" width="5.5" height="100" fill="url(#wk-hatch-l)"/>
      <g stroke="${C.ink}" stroke-width=".35" opacity=".45"><line x1="-5" y1="-129" x2="-5" y2="-33"/><line x1="-1.5" y1="-129" x2="-1.5" y2="-33"/><line x1="2" y1="-129" x2="2" y2="-33"/><line x1="5.5" y1="-129" x2="5.5" y2="-33"/></g>
      <rect x="-12" y="-137" width="24" height="6" fill="${C.stone}" stroke="${C.ink}" stroke-width=".4" stroke-opacity=".5"/>
      <circle cx="-12" cy="-134" r="3" fill="${C.stone}" stroke="${C.ink}" stroke-width=".4" stroke-opacity=".6"/>
      <circle cx="12" cy="-134" r="3" fill="${C.stoneSh}" stroke="${C.ink}" stroke-width=".4" stroke-opacity=".6"/>
      <rect x="-15" y="-142" width="30" height="5" fill="${C.stone}" stroke="${C.ink}" stroke-width=".4" stroke-opacity=".5"/>
    </symbol>
    <symbol id="wk-hedge" overflow="visible">
      <rect x="-30" y="-14" width="60" height="14" rx="5" fill="${C.grassDk}"/>
      <rect x="-30" y="-14" width="60" height="6" rx="4" fill="${C.grass}"/>
    </symbol>
    <symbol id="wk-urn" overflow="visible">
      <rect x="-7" y="-22" width="14" height="22" fill="${C.stone}"/><rect x="2" y="-22" width="5" height="22" fill="${C.stoneSh}"/>
      <path d="M-8,-22 C-10,-30 -6,-38 -3,-40 L3,-40 C6,-38 10,-30 8,-22Z" fill="${C.stone}" stroke="${C.ink}" stroke-width=".4" stroke-opacity=".5"/>
      <path d="M-6,-41 L6,-41 L4,-45 L-4,-45Z" fill="${C.stoneSh}"/>
      <path d="M-4,-45 C-8,-52 -2,-60 0,-58 C3,-62 9,-52 4,-45Z" fill="${C.grass}"/>
    </symbol>
    <symbol id="wk-temple" overflow="visible">
      <ellipse cx="0" cy="2" rx="150" ry="8" fill="#000" opacity=".12"/>
      <rect x="-130" y="-10" width="260" height="10" fill="${C.stoneSh}"/>
      <rect x="-120" y="-20" width="240" height="10" fill="${C.stone}"/>
      <rect x="-110" y="-28" width="220" height="8" fill="${C.stoneSh}"/>
      <rect x="-96" y="-150" width="192" height="122" fill="#d9ccab"/>
      <rect x="-96" y="-150" width="192" height="122" fill="url(#wk-hatch-l)"/>
      ${[-88, -60, -32, -4, 24, 52, 80].map((x) => `<rect x="${x}" y="-150" width="12" height="122" fill="${C.stone}"/><rect x="${x + 8}" y="-150" width="4" height="122" fill="${C.stoneSh}"/>`).join("")}
      <rect x="-104" y="-166" width="208" height="16" fill="${C.stone}" stroke="${C.ink}" stroke-width=".6" stroke-opacity=".4"/>
      <rect x="-100" y="-172" width="200" height="6" fill="${C.stoneSh}"/>
      <path d="M-92,-172 C-90,-250 90,-250 92,-172Z" fill="${C.stone}"/>
      <path d="M10,-243 C60,-232 88,-205 92,-172 L40,-172 C40,-200 30,-228 10,-243Z" fill="${C.stoneSh}"/>
      <path d="M-92,-172 C-90,-250 90,-250 92,-172" fill="none" stroke="${C.ink}" stroke-width=".7" stroke-opacity=".45"/>
      <g stroke="${C.ink}" stroke-width=".5" opacity=".3" fill="none"><path d="M-60,-172 C-58,-225 -20,-242 0,-243"/><path d="M60,-172 C58,-225 20,-242 0,-243"/><path d="M-30,-172 C-28,-232 -8,-243 0,-243"/><path d="M30,-172 C28,-232 8,-243 0,-243"/></g>
      <rect x="-9" y="-268" width="18" height="24" fill="${C.stone}" stroke="${C.ink}" stroke-width=".5" stroke-opacity=".4"/>
      <path d="M-11,-268 C-10,-282 10,-282 11,-268Z" fill="${C.stoneSh}"/>
      <circle cx="0" cy="-286" r="3.5" fill="#b59a5a"/>
    </symbol>`;

  function cloud(g, cx, cy, s, flip) {
    const parts = [[0, 0, 60], [55, -18, 52], [105, 4, 46], [-50, 8, 44], [150, 18, 34], [-92, 22, 30], [30, -55, 40], [80, -48, 34]];
    const grp = svgEl("g", { transform: `translate(${cx},${cy}) scale(${flip ? -s : s},${s})` }, g);
    parts.forEach(([x, y, r]) => svgEl("circle", { cx: x, cy: y + 10, r, fill: C.cloudSh }, grp));
    parts.forEach(([x, y, r]) => svgEl("circle", { cx: x - 4, cy: y, r: r * 0.94, fill: C.cloud }, grp));
    svgEl("rect", { x: -130, y: 30, width: 300, height: 40, fill: C.cloudSh, opacity: 0.0 }, grp);
    return grp;
  }

  function build(host) {
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid slice", class: "wk-svg", "aria-hidden": "true" });
    svg.innerHTML = `<defs>${DEFS}</defs>`;
    // ciel
    svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: C.sky }, svg);
    svgEl("rect", { x: 0, y: 250, width: W, height: 220, fill: C.skyLow }, svg);
    svgEl("rect", { x: 0, y: 180, width: W, height: 290, fill: "url(#wk-dots)" }, svg);
    const sun = svgEl("g", {}, svg);
    svgEl("circle", { cx: 800, cy: 330, r: 120, fill: "none", stroke: C.sun, "stroke-width": 1, opacity: 0.25 }, sun);
    svgEl("circle", { cx: 800, cy: 330, r: 92, fill: "none", stroke: C.sun, "stroke-width": 1, opacity: 0.35 }, sun);
    svgEl("circle", { cx: 800, cy: 330, r: 66, fill: C.sun, opacity: 0.92 }, sun);
    // nuages lointains
    const cloudsFar = svgEl("g", {}, svg);
    cloud(cloudsFar, 210, 300, 0.9, false); cloud(cloudsFar, 1380, 280, 1.0, true); cloud(cloudsFar, 560, 220, 0.55, true); cloud(cloudsFar, 1060, 200, 0.6, false);
    // montagnes et cité lointaine
    const far = svgEl("g", {}, svg);
    svgEl("path", { d: `M0,${HOR} L0,390 L120,360 L230,395 L360,340 L470,380 L560,350 L680,392 L760,${HOR}Z`, fill: C.far }, far);
    svgEl("path", { d: `M840,${HOR} L900,388 L1010,348 L1110,380 L1230,335 L1340,372 L1450,350 L1600,385 L1600,${HOR}Z`, fill: C.far }, far);
    svgEl("path", { d: `M0,${HOR} L0,420 L200,405 L420,425 L640,410 L800,${HOR - 8} L1000,412 L1250,402 L1600,418 L1600,${HOR}Z`, fill: C.far2 }, far);
    const city = svgEl("g", { fill: C.city }, far);
    [[300, 36, 8], [316, 58, 7], [330, 30, 10], [1230, 44, 8], [1246, 70, 6], [1258, 38, 10], [1274, 52, 7]].forEach(([x, h, w]) => svgEl("rect", { x, y: 420 - h, width: w, height: h }, city));
    svgEl("path", { d: "M1246,350 L1249,338 L1252,350Z" }, city);
    svgEl("path", { d: "M316,362 L319,350 L322,362Z" }, city);
    // nuages proches
    const cloudsNear = svgEl("g", {}, svg);
    cloud(cloudsNear, -40, 360, 1.5, false); cloud(cloudsNear, 1640, 340, 1.65, true);
    // sol
    const ground = svgEl("g", {}, svg);
    svgEl("rect", { x: 0, y: HOR, width: W, height: H - HOR, fill: C.grass }, ground);
    const pathPoly = svgEl("polygon", { fill: C.path }, ground);
    const lines = svgEl("g", { stroke: C.pathLine, "stroke-width": 1.2 }, ground);
    const lineEls = Array.from({ length: 34 }, () => svgEl("line", {}, lines));
    const edgeL = svgEl("line", { stroke: C.stoneSh, "stroke-width": 2 }, ground);
    const edgeR = svgEl("line", { stroke: C.stoneSh, "stroke-width": 2 }, ground);
    svgEl("rect", { x: 0, y: HOR, width: W, height: 3, fill: C.grassDk, opacity: 0.5 }, ground);

    // objets du monde
    const objs = [];
    const add = (sym, x, z, extra) => objs.push({ sym, x, z, ...extra });
    add("wk-temple", 0, 2380, { k: 1.25 });
    for (let z = 140; z <= 2280; z += 70) {
      add("wk-cypress", -150 - ((z / 70) % 2) * 14, z, { k: 1 });
      add("wk-cypress", 150 + ((z / 70 + 1) % 2) * 14, z, { k: 1 });
    }
    for (let z = 175; z <= 2260; z += 70) { add("wk-hedge", -100, z, { k: 1 }); add("wk-hedge", 100, z, { k: 1 }); }
    for (let z = 550; z <= 1900; z += 300) { add("wk-urn", -72, z, { k: 0.9 }); add("wk-urn", 72, z, { k: 0.9 }); }
    STAGE_Z.forEach((z, i) => { add("wk-column", -62, z, { k: 1, label: i, side: -1 }); add("wk-column", 62, z, { k: 1, label: i, side: 1 }); });
    objs.sort((a, b) => b.z - a.z);
    const objLayer = svgEl("g", {}, svg);
    objs.forEach((o) => {
      o.g = svgEl("g", {}, objLayer);
      svgEl("use", { href: "#" + o.sym }, o.g);
      if (o.label != null && o.side < 0) {
        const t = svgEl("text", { x: 0, y: -10, "text-anchor": "middle", "font-family": "Instrument Serif, Georgia, serif", "font-size": 7, fill: C.ink }, o.g);
        t.textContent = ["I", "II", "III", "IV"][o.label];
      }
    });
    host.appendChild(svg);

    function render(p) {
      const cz = p * Z_END;
      // ciel & lointain : parallaxe légère
      sun.setAttribute("transform", `translate(0,${p * 40}) scale(1)`);
      cloudsFar.setAttribute("transform", `translate(${-p * 30},${-p * 12})`);
      far.setAttribute("transform", `translate(800,${HOR}) scale(${1 + p * 0.06}) translate(-800,${-HOR})`);
      cloudsNear.setAttribute("transform", `translate(800,${HOR}) scale(${1 + p * 0.35}) translate(-800,${-HOR}) translate(0,${-p * 30})`);
      // allée
      const proj = (x, z) => { const s = F / Math.max(z - cz, 1); return [800 + x * s, HOR + EYE * s, s]; };
      const near = 18, farZ = 2380;
      const [lx0, y0] = proj(-46, cz + near), [rx0] = proj(46, cz + near);
      const [lx1, y1] = proj(-46, farZ), [rx1] = proj(46, farZ);
      pathPoly.setAttribute("points", `${lx0},${Math.min(y0, H + 400)} ${rx0},${Math.min(y0, H + 400)} ${rx1},${y1} ${lx1},${y1}`);
      edgeL.setAttribute("x1", lx0); edgeL.setAttribute("y1", y0); edgeL.setAttribute("x2", lx1); edgeL.setAttribute("y2", y1);
      edgeR.setAttribute("x1", rx0); edgeR.setAttribute("y1", y0); edgeR.setAttribute("x2", rx1); edgeR.setAttribute("y2", y1);
      const step = 30, first = Math.ceil((cz + near) / step) * step;
      lineEls.forEach((l, i) => {
        const z = first + i * step;
        const [a, y] = proj(-46, z), [b] = proj(46, z);
        l.setAttribute("x1", a); l.setAttribute("x2", b); l.setAttribute("y1", y); l.setAttribute("y2", y);
        l.setAttribute("opacity", Math.max(0, Math.min(1, (F / (z - cz)) * 1.2)));
      });
      objs.forEach((o) => {
        const dz = o.z - cz;
        if (dz < 12) { o.g.setAttribute("display", "none"); return; }
        const s = (F / dz) * o.k;
        const [sx, sy] = proj(o.x, o.z);
        o.g.setAttribute("display", "inline");
        o.g.setAttribute("transform", `translate(${sx.toFixed(1)},${sy.toFixed(1)}) scale(${s.toFixed(4)})`);
        o.g.setAttribute("opacity", dz < 60 ? Math.max(0, (dz - 12) / 48).toFixed(2) : "1");
      });
    }
    return { render, svg };
  }

  window.DZWalk = {
    STAGE_Z, Z_END,
    mount(section, onProgress) {
      const stage = section.querySelector(".wk-stage");
      const scene = build(stage.querySelector(".wk-scene"));
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      let raf = 0, last = -1;
      const tick = () => {
        raf = 0;
        const r = section.getBoundingClientRect();
        const total = section.offsetHeight - innerHeight;
        const p = reduce ? 0.18 : Math.min(1, Math.max(0, -r.top / Math.max(total, 1)));
        if (Math.abs(p - last) < 0.0004) return;
        last = p;
        scene.render(p);
        onProgress && onProgress(p);
      };
      const req = () => { if (!raf) raf = requestAnimationFrame(tick); };
      addEventListener("scroll", req, { passive: true });
      addEventListener("resize", req);
      tick();
      return () => { removeEventListener("scroll", req); removeEventListener("resize", req); if (raf) cancelAnimationFrame(raf); };
    },
  };
})();
