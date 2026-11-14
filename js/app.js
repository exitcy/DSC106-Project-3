(() => {
  const COLORS = {
    Historical: "#6b7c86",
    "SSP1-2.6": "#2c7bb6",
    "SSP2-4.5": "#d08a2c",
    "SSP5-8.5": "#d7191c",
  };
  const FUTURE = ["SSP1-2.6", "SSP2-4.5", "SSP5-8.5"];

  const state = {
    year: 2100,
    focus: "SSP5-8.5",
    compareA: "SSP1-2.6",
    compareB: "SSP5-8.5",
    data: [],
    summary: null,
    models: [],
  };

  const els = {
    chart: document.getElementById("chart"),
    endChart: document.getElementById("end-century-chart"),
    modelChart: document.getElementById("model-chart"),
    slider: document.getElementById("year-slider"),
    yearDisplay: document.getElementById("year-display"),
    tooltip: document.getElementById("tooltip"),
    scenarioPlain: document.getElementById("scenario-plain"),
    compareA: document.getElementById("compare-a"),
    compareB: document.getElementById("compare-b"),
    compareReadout: document.getElementById("compare-readout"),
    annotation: document.getElementById("annotation-caption"),
    buttons: Array.from(document.querySelectorAll(".scenario-btn")),
  };

  function byScenario(rows) {
    return d3.group(rows, (d) => d.scenario);
  }

  function valueAt(scenario, year) {
    const row = state.data.find((d) => d.scenario === scenario && d.year === year);
    return row ? row.anomaly_c : null;
  }

  function clampTooltip(x, y, width, height) {
    const pad = 12;
    let left = x + 14;
    let top = y + 14;
    if (left + width > window.innerWidth - pad) left = x - width - 14;
    if (top + height > window.innerHeight - pad) top = y - height - 14;
    left = Math.max(pad, left);
    top = Math.max(pad, top);
    return { left, top };
  }

  function showTooltip(event, html) {
    const tip = els.tooltip;
    tip.hidden = false;
    tip.innerHTML = html;
    const rect = tip.getBoundingClientRect();
    const pos = clampTooltip(event.clientX, event.clientY, rect.width, rect.height);
    tip.style.left = `${pos.left}px`;
    tip.style.top = `${pos.top}px`;
  }

  function hideTooltip() {
    els.tooltip.hidden = true;
  }

  function updateCompareReadout() {
    const a = valueAt(state.compareA, state.year);
    const b = valueAt(state.compareB, state.year);
    if (a == null || b == null) {
      els.compareReadout.textContent = "No values available for this year.";
      return;
    }
    const diff = b - a;
    const sign = diff > 0 ? "+" : "";
    els.compareReadout.textContent =
      `${state.year}: ${state.compareA} ${a.toFixed(2)} °C · ` +
      `${state.compareB} ${b.toFixed(2)} °C · difference ${sign}${diff.toFixed(2)} °C`;
  }

  function updateScenarioPlain() {
    const plain = state.summary?.scenario_plain || {};
    if (state.focus === "all") {
      els.scenarioPlain.textContent = "All three pathways shown at equal emphasis.";
      return;
    }
    const key = Object.entries({
      "SSP1-2.6": "ssp126",
      "SSP2-4.5": "ssp245",
      "SSP5-8.5": "ssp585",
    }).find(([label]) => label === state.focus)?.[1];
    els.scenarioPlain.textContent = plain[key] || "";
  }

  function updateAnnotations() {
    const s = state.summary;
    if (!s) return;
    const parts = [];
    if (s.divergence) {
      parts.push(
        `Annotation: ${s.divergence.high_scenario} first exceeds ${s.divergence.low_scenario} by ` +
          `${s.divergence.threshold_c.toFixed(1)} °C in ${s.divergence.year} ` +
          `(gap ${s.divergence.gap_c.toFixed(2)} °C in the CanESM5 series).`
      );
    }
    if (s.gap_2100_high_minus_low_c != null) {
      parts.push(
        `By 2100, SSP5-8.5 is ${s.gap_2100_high_minus_low_c.toFixed(2)} °C warmer than SSP1-2.6 ` +
          `in this CanESM5 run (${s.year_2100_c["SSP5-8.5"]} °C vs ${s.year_2100_c["SSP1-2.6"]} °C).`
      );
    }
    els.annotation.textContent = parts.join(" ");
  }

  function drawMainChart() {
    const host = els.chart;
    host.innerHTML = "";
    const width = host.clientWidth || 900;
    const height = Math.max(420, Math.min(520, width * 0.52));
    const margin = { top: 16, right: 24, bottom: 48, left: 58 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([1850, 2100]).range([0, innerW]);
    const yExtent = d3.extent(state.data, (d) => d.anomaly_c);
    const yPad = 0.35;
    const y = d3
      .scaleLinear()
      .domain([Math.min(yExtent[0], -0.5) - yPad, yExtent[1] + yPad])
      .nice()
      .range([innerH, 0]);

    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y).ticks(6).tickSize(-innerW).tickFormat(""))
      .select(".domain")
      .remove();

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues([1850, 1900, 1950, 2000, 2015, 2050, 2100]).tickFormat(d3.format("d")));

    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(6).tickFormat((d) => `${d}`));

    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#4d5d68")
      .attr("font-size", 13)
      .text("Year");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -44)
      .attr("text-anchor", "middle")
      .attr("fill", "#4d5d68")
      .attr("font-size", 13)
      .text("Temperature anomaly (°C)");

    g.append("line")
      .attr("class", "baseline-line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y(0))
      .attr("y2", y(0));

    const grouped = byScenario(state.data);
    const line = d3
      .line()
      .x((d) => x(d.year))
      .y((d) => y(d.anomaly_c));

    const seriesOrder = ["Historical", ...FUTURE];
    seriesOrder.forEach((scenario) => {
      const rows = (grouped.get(scenario) || []).slice().sort((a, b) => a.year - b.year);
      if (!rows.length) return;
      const focused = state.focus === "all" || state.focus === scenario;
      g.append("path")
        .datum(rows)
        .attr("class", `series-line${focused ? " is-focus" : " is-dim"}`)
        .attr("stroke", COLORS[scenario])
        .attr("d", line);
    });

    // Divergence marker only — label lives in the caption below to avoid chart clutter
    const div = state.summary?.divergence;
    if (div) {
      g.append("line")
        .attr("x1", x(div.year))
        .attr("x2", x(div.year))
        .attr("y1", 0)
        .attr("y2", innerH)
        .attr("stroke", "rgba(20,33,43,0.25)")
        .attr("stroke-dasharray", "3 4");
      g.append("text")
        .attr("x", x(div.year))
        .attr("y", innerH - 8)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("fill", "#3d4f5a")
        .text(String(div.year));
    }

    g.append("text")
      .attr("x", innerW - 4)
      .attr("y", y(0) - 6)
      .attr("text-anchor", "end")
      .attr("fill", "#5b6b75")
      .attr("font-size", 11)
      .text("0 °C baseline");

    // Playhead + comparison markers
    g.append("line")
      .attr("class", "playhead")
      .attr("x1", x(state.year))
      .attr("x2", x(state.year))
      .attr("y1", 0)
      .attr("y2", innerH);

    const markerData = [state.compareA, state.compareB]
      .map((scenario) => ({ scenario, value: valueAt(scenario, state.year) }))
      .filter((d) => d.value != null);

    g.selectAll(".compare-marker")
      .data(markerData)
      .join("circle")
      .attr("class", "compare-marker")
      .attr("cx", x(state.year))
      .attr("cy", (d) => y(d.value))
      .attr("r", 6)
      .attr("fill", (d) => COLORS[d.scenario]);

    // Hover overlay
    const bisect = d3.bisector((d) => d.year).center;
    const futureRows = FUTURE.map((scenario) => ({
      scenario,
      rows: (grouped.get(scenario) || []).slice().sort((a, b) => a.year - b.year),
    }));

    const overlay = g
      .append("rect")
      .attr("fill", "transparent")
      .attr("width", innerW)
      .attr("height", innerH)
      .style("cursor", "crosshair");

    overlay
      .on("mousemove", (event) => {
        const [mx] = d3.pointer(event);
        const year = Math.round(x.invert(mx));
        const clamped = Math.max(2015, Math.min(2100, year));
        const lines = futureRows
          .map(({ scenario, rows }) => {
            if (!rows.length) return null;
            const i = bisect(rows, clamped);
            const row = rows[Math.max(0, Math.min(rows.length - 1, i))];
            return `${scenario}: ${row.anomaly_c.toFixed(2)} °C`;
          })
          .filter(Boolean);
        showTooltip(
          event,
          `<strong>${clamped}</strong>${lines.join("<br>")}`
        );
      })
      .on("mouseleave", hideTooltip)
      .on("click", (event) => {
        const [mx] = d3.pointer(event);
        const year = Math.round(x.invert(mx));
        const clamped = Math.max(2015, Math.min(2100, year));
        els.slider.value = String(clamped);
        setYear(clamped);
      });
  }

  function drawEndCentury() {
    const host = els.endChart;
    host.innerHTML = "";
    const means = state.summary?.end_century_means_c || {};
    const rows = FUTURE.map((scenario) => ({ scenario, value: means[scenario] })).filter((d) => d.value != null);
    const width = host.clientWidth || 480;
    const height = 220;
    const margin = { top: 16, right: 16, bottom: 36, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3.scaleBand().domain(FUTURE).range([0, innerW]).padding(0.28);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.value) * 1.15])
      .nice()
      .range([innerH, 0]);

    g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4));

    g.selectAll("rect")
      .data(rows)
      .join("rect")
      .attr("x", (d) => x(d.scenario))
      .attr("y", (d) => y(d.value))
      .attr("width", x.bandwidth())
      .attr("height", (d) => innerH - y(d.value))
      .attr("rx", 6)
      .attr("fill", (d) => COLORS[d.scenario])
      .on("mousemove", (event, d) => {
        showTooltip(event, `<strong>${d.scenario}</strong>2081–2100 mean<br>${d.value.toFixed(2)} °C`);
      })
      .on("mouseleave", hideTooltip);

    g.selectAll(".bar-label")
      .data(rows)
      .join("text")
      .attr("class", "bar-label")
      .attr("x", (d) => x(d.scenario) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.value) - 6)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#24333d")
      .text((d) => `${d.value.toFixed(2)} °C`);
  }

  function drawModels() {
    const host = els.modelChart;
    host.innerHTML = "";
    const rows = state.models;
    if (!rows.length) {
      host.textContent = "Multi-model summary unavailable.";
      return;
    }
    const width = host.clientWidth || 480;
    const height = 220;
    const margin = { top: 16, right: 16, bottom: 56, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const models = Array.from(new Set(rows.map((d) => d.model)));
    const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3.scalePoint().domain(models).range([0, innerW]).padding(0.4);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.anomaly_c) * 1.15])
      .nice()
      .range([innerH, 0]);

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-18)")
      .attr("text-anchor", "end");
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4));

    g.selectAll("circle")
      .data(rows)
      .join("circle")
      .attr("cx", (d) => x(d.model))
      .attr("cy", (d) => y(d.anomaly_c))
      .attr("r", 6)
      .attr("fill", (d) => COLORS[d.scenario])
      .attr("opacity", 0.9)
      .on("mousemove", (event, d) => {
        showTooltip(
          event,
          `<strong>${d.model}</strong>${d.scenario}<br>${d.anomaly_c.toFixed(2)} °C`
        );
      })
      .on("mouseleave", hideTooltip);
  }

  function renderAll() {
    els.yearDisplay.textContent = String(state.year);
    els.slider.setAttribute("aria-valuenow", String(state.year));
    updateCompareReadout();
    updateScenarioPlain();
    updateAnnotations();
    drawMainChart();
    drawEndCentury();
    drawModels();
  }

  function setYear(year) {
    state.year = year;
    renderAll();
  }

  function populateCompareSelects() {
    [els.compareA, els.compareB].forEach((select) => {
      select.innerHTML = FUTURE.map((s) => `<option value="${s}">${s}</option>`).join("");
    });
    els.compareA.value = state.compareA;
    els.compareB.value = state.compareB;
  }

  function wireControls() {
    els.slider.addEventListener("input", (event) => {
      setYear(Number(event.target.value));
    });

    els.buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        els.buttons.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.focus = btn.dataset.scenario;
        renderAll();
      });
    });

    els.compareA.addEventListener("change", () => {
      state.compareA = els.compareA.value;
      renderAll();
    });
    els.compareB.addEventListener("change", () => {
      state.compareB = els.compareB.value;
      renderAll();
    });

    window.addEventListener("resize", () => {
      clearTimeout(window.__climateResize);
      window.__climateResize = setTimeout(renderAll, 120);
    });
  }

  async function load() {
    const [anomalies, summary, models] = await Promise.all([
      d3.json("./data/global_anomalies.json"),
      d3.json("./data/summary.json"),
      d3.csv("./data/model_endcentury_anomalies.csv", (d) => ({
        model: d.model,
        experiment: d.experiment,
        scenario: d.scenario,
        anomaly_c: +d.anomaly_c,
      })),
    ]);

    state.data = anomalies;
    state.summary = summary;
    state.models = models;
    state.year = summary.slider_years?.max ?? 2100;
    state.compareA = summary.compare_default?.[0] || "SSP1-2.6";
    state.compareB = summary.compare_default?.[1] || "SSP5-8.5";

    els.slider.min = summary.slider_years?.min ?? 2015;
    els.slider.max = summary.slider_years?.max ?? 2100;
    els.slider.value = String(state.year);

    populateCompareSelects();
    wireControls();
    renderAll();
  }

  load().catch((error) => {
    els.chart.innerHTML = `<p style="color:#a11">Failed to load data: ${error.message}</p>`;
    console.error(error);
  });
})();
