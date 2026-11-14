# How Will Global Temperatures Change by 2100?

Interactive D3 visualization for UCSD DSC 106 Project 3 using CMIP6 CanESM5 near-surface air temperature projections.

**Live site:** https://exitcy.github.io/DSC106-Project-3/

## What you can explore

- Global temperature anomaly (°C) from 1850–2100 (historical) and 2015–2100 (SSP1-2.6, SSP2-4.5, SSP5-8.5)
- Year slider with playhead and on-chart hover details
- Scenario focus buttons and a paired scenario comparison that shows the °C difference at the selected year
- End-of-century summary bars and a multi-model end-century strip

Anomalies use the **1995–2014** CanESM5 historical baseline with latitude weighting (cosine of latitude).

## Tech

- Static HTML / CSS / JavaScript
- **D3.js only** for charts (no Plotly, Chart.js, Vega, etc.)
- Data files in `data/` (`global_anomalies.json`, `summary.json`, `model_endcentury_anomalies.csv`)

## Local preview

Open `index.html` with a local static server from this folder (needed so `fetch` can load JSON):

```powershell
python -m http.server 8000
```

Then visit http://localhost:8000/

## Regenerating web data

If you rebuild the NetCDF cache locally:

```powershell
python export_web_data.py
```

## GitHub Pages

Published from the `main` branch, site root (`/`). Asset paths are relative (`./css`, `./js`, `./data`) so they work under `/DSC106-Project-3/`.
