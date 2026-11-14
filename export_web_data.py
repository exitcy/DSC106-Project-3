"""Export lightweight JSON for the D3 site from the CanESM5 annual cache.

Uses the same latitude-weighted global means and 1995–2014 baseline as main.py.
Does not invent values; reads data/canesm5_tas_annual.nc only.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
import xarray as xr

ROOT = Path(__file__).resolve().parent
CACHE_PATH = ROOT / "data" / "canesm5_tas_annual.nc"
WEB_DATA = ROOT / "data"
MODEL_CSV = ROOT / "data" / "model_endcentury_anomalies.csv"

SCENARIOS = ("ssp126", "ssp245", "ssp585")
SCENARIO_LABELS = {
    "historical": "Historical",
    "ssp126": "SSP1-2.6",
    "ssp245": "SSP2-4.5",
    "ssp585": "SSP5-8.5",
}
SCENARIO_PLAIN = {
    "ssp126": "Low emissions — strong mitigation",
    "ssp245": "Medium emissions — middle of the road",
    "ssp585": "High emissions — fossil-fuel intensive",
}
BASELINE = (1995, 2014)
FUTURE_MEAN = (2081, 2100)
DIVERGENCE_THRESHOLD = 1.0


def latitude_weights(lat: xr.DataArray) -> xr.DataArray:
    weights = np.cos(np.deg2rad(lat)).clip(min=0)
    return xr.DataArray(weights, coords={"lat": lat}, dims="lat")


def weighted_mean(field: xr.DataArray) -> xr.DataArray:
    return field.weighted(latitude_weights(field["lat"])).mean(dim=("lat", "lon"))


def baseline_map(dataset: xr.Dataset) -> xr.DataArray:
    start, end = BASELINE
    window = dataset["tas"].sel(experiment="historical", year=slice(start, end))
    if window.sizes["year"] != (end - start + 1):
        raise SystemExit("Historical baseline is missing years in 1995–2014.")
    return window.mean(dim="year")


def global_anomaly(dataset: xr.Dataset, experiment: str) -> xr.DataArray:
    baseline = weighted_mean(baseline_map(dataset))
    series = weighted_mean(dataset["tas"].sel(experiment=experiment))
    return series - baseline


def series_records(series: xr.DataArray, experiment: str) -> list[dict]:
    clean = series.dropna(dim="year")
    records = []
    for year, value in zip(clean["year"].values.astype(int), clean.values.astype(float)):
        if not np.isfinite(value):
            continue
        records.append(
            {
                "year": int(year),
                "experiment": experiment,
                "scenario": SCENARIO_LABELS[experiment],
                "anomaly_c": round(float(value), 3),
            }
        )
    return records


def mean_window(series: xr.DataArray, start: int, end: int) -> float:
    window = series.sel(year=slice(start, end)).dropna(dim="year")
    return float(window.mean().item())


def value_at(series: xr.DataArray, year: int) -> float | None:
    point = series.sel(year=year)
    if point.size == 0 or not np.isfinite(point.item()):
        return None
    return float(point.item())


def first_divergence_year(low: xr.DataArray, high: xr.DataArray, threshold: float) -> dict | None:
    years = np.intersect1d(
        low.dropna(dim="year")["year"].values.astype(int),
        high.dropna(dim="year")["year"].values.astype(int),
    )
    years = years[(years >= 2015) & (years <= 2100)]
    for year in years:
        gap = abs(float(high.sel(year=int(year)).item()) - float(low.sel(year=int(year)).item()))
        if gap >= threshold:
            return {
                "year": int(year),
                "threshold_c": threshold,
                "gap_c": round(gap, 3),
                "low_scenario": SCENARIO_LABELS["ssp126"],
                "high_scenario": SCENARIO_LABELS["ssp585"],
            }
    return None


def main() -> None:
    if not CACHE_PATH.exists():
        raise SystemExit(f"Missing {CACHE_PATH}. Run main.py first to build the cache.")

    dataset = xr.open_dataset(CACHE_PATH)
    try:
        records: list[dict] = []
        series_by_exp: dict[str, xr.DataArray] = {}

        hist = global_anomaly(dataset, "historical").sel(year=slice(1850, 2014))
        series_by_exp["historical"] = hist
        records.extend(series_records(hist, "historical"))

        for experiment in SCENARIOS:
            series = global_anomaly(dataset, experiment).sel(year=slice(2015, 2100))
            series_by_exp[experiment] = series
            records.extend(series_records(series, experiment))

        end_century = {
            SCENARIO_LABELS[exp]: round(mean_window(series_by_exp[exp], *FUTURE_MEAN), 2)
            for exp in SCENARIOS
        }
        year_2100 = {
            SCENARIO_LABELS[exp]: round(value_at(series_by_exp[exp], 2100) or float("nan"), 2)
            for exp in SCENARIOS
        }
        divergence = first_divergence_year(
            series_by_exp["ssp126"], series_by_exp["ssp585"], DIVERGENCE_THRESHOLD
        )
        gap_2100 = None
        if year_2100["SSP5-8.5"] == year_2100["SSP5-8.5"] and year_2100["SSP1-2.6"] == year_2100["SSP1-2.6"]:
            gap_2100 = round(year_2100["SSP5-8.5"] - year_2100["SSP1-2.6"], 2)

        summary = {
            "source_id": dataset.attrs.get("source_id", "CanESM5"),
            "member_id": dataset.attrs.get("member_id", "r1i1p1f1"),
            "variable_id": "tas",
            "units": "degC",
            "baseline": f"{BASELINE[0]}-{BASELINE[1]}",
            "baseline_note": (
                "Global anomalies are latitude-weighted (cosine of latitude) annual means "
                "minus the CanESM5 historical mean over 1995–2014."
            ),
            "future_mean_period": f"{FUTURE_MEAN[0]}-{FUTURE_MEAN[1]}",
            "scenario_plain": SCENARIO_PLAIN,
            "end_century_means_c": end_century,
            "year_2100_c": year_2100,
            "gap_2100_high_minus_low_c": gap_2100,
            "divergence": divergence,
            "slider_years": {"min": 2015, "max": 2100},
            "compare_default": ["SSP1-2.6", "SSP5-8.5"],
        }

        WEB_DATA.mkdir(parents=True, exist_ok=True)
        anomalies_path = WEB_DATA / "global_anomalies.json"
        summary_path = WEB_DATA / "summary.json"
        anomalies_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        if MODEL_CSV.exists():
            # Keep a web-facing copy next to the JSON for the optional model strip.
            dest = WEB_DATA / "model_endcentury_anomalies.csv"
            if MODEL_CSV.resolve() != dest.resolve():
                shutil.copy2(MODEL_CSV, dest)

        print(f"Wrote {anomalies_path} ({len(records)} rows)")
        print(f"Wrote {summary_path}")
        print("End-century means (°C):", end_century)
        print("2100 values (°C):", year_2100)
        print("Divergence:", divergence)
    finally:
        dataset.close()


if __name__ == "__main__":
    main()
