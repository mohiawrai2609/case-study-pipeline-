-- ============================================================
-- Automation Anatomy pipeline — additive schema
-- Project: qpibugnhpuoxlsmyuksz  ("Replaceble data db")
-- Run in: Supabase Dashboard → SQL Editor
-- Touches NOTHING existing. Creates one new schema: anatomy
-- ============================================================

CREATE SCHEMA IF NOT EXISTS anatomy;

-- Canonical comparison anchors for the RPI chart that appears in EVERY article.
-- Deliberately does NOT store rpi_pct — the value is joined live from rpi.roles,
-- so an anchor can never drift from the scoring engine the way v20's chart did.
CREATE TABLE IF NOT EXISTS anatomy.anchors (
  soc_code   char(10) PRIMARY KEY REFERENCES rpi.roles(soc_code),
  label      text     NOT NULL,          -- short chart label, e.g. 'Warehouse'
  sort_order smallint NOT NULL DEFAULT 0,
  is_active  boolean  NOT NULL DEFAULT true,
  added_at   timestamptz NOT NULL DEFAULT now()
);

-- One row per case study. rpi_at_publish is a deliberate snapshot: comparing it
-- to the live rpi_pct is how we detect which published articles a rescore invalidated.
CREATE TABLE IF NOT EXISTS anatomy.series_ledger (
  issue_no       integer  PRIMARY KEY,
  soc_code       char(10) NOT NULL UNIQUE REFERENCES rpi.roles(soc_code),
  slug           text     NOT NULL UNIQUE,
  status         text     NOT NULL DEFAULT 'planned'
                 CHECK (status IN ('planned','researching','drafted','built','published','superseded')),
  rpi_at_publish        numeric,
  task_count_at_publish integer,
  published_at   timestamptz,
  gold_vendor_id integer REFERENCES rpi.vendors(vendor_id),
  build_hash     text,
  notes          text
);

CREATE OR REPLACE VIEW anatomy.v_anchors AS
SELECT a.soc_code, a.label, a.sort_order, r.title, r.rpi_pct, r.risk_band, r.aps, r.hrf
FROM anatomy.anchors a JOIN rpi.roles r ON r.soc_code = a.soc_code
WHERE a.is_active;

-- Published articles whose printed RPI no longer matches the live score.
CREATE OR REPLACE VIEW anatomy.v_stale_issues AS
SELECT s.issue_no, s.slug, r.title, s.rpi_at_publish, r.rpi_pct AS rpi_now,
       round(r.rpi_pct - s.rpi_at_publish, 2) AS drift, s.status, s.published_at
FROM anatomy.series_ledger s JOIN rpi.roles r ON r.soc_code = s.soc_code
WHERE s.rpi_at_publish IS NOT NULL
  AND abs(r.rpi_pct - s.rpi_at_publish) >= 0.05;

-- ── Seed the anchor set ──────────────────────────────────────
-- Keeps v20's four original anchors (Warehouse / Retail / Software Dev / Nurse)
-- so the chart stays recognisable, but at DATABASE values, plus two mid-range
-- roles so the scale isn't top-heavy. Edit this table to change every article's chart.
INSERT INTO anatomy.anchors (soc_code, label, sort_order) VALUES
  ('43-5071.00', 'Warehouse',      1),   -- Shipping, Receiving & Inventory Clerks — 49.0
  ('43-4051.00', 'Customer Service', 2), -- 39.0
  ('23-2011.00', 'Paralegal',      3),   -- 27.8
  ('41-2031.00', 'Retail',         4),   -- 21.3
  ('13-2011.00', 'Accountant',     5),   -- 15.5
  ('15-1252.00', 'Software Dev',   6),   -- 13.4
  ('29-1141.00', 'Nurse',          7)    --  2.2
ON CONFLICT (soc_code) DO NOTHING;

-- ── Record No. 001 as superseded (its printed scores are not DB-derived) ──
INSERT INTO anatomy.series_ledger
  (issue_no, soc_code, slug, status, rpi_at_publish, task_count_at_publish, notes)
VALUES
  (1, '35-3023.00', 'fast-food-and-counter-workers', 'superseded', 32.2, 15,
   'Published at APS 0.52 / HRF 0.38 -> RPI 32.2. Database holds APS 0.55 / HRF 0.35 -> 35.8. '
   'rpi.audit_trail records only one real revision for this SOC (M-004, APS 0.56->0.55) and has '
   'no timestamps, so 0.52/0.38 never existed in this DB lineage. Rebuild from DB before reissue.')
ON CONFLICT (issue_no) DO NOTHING;

-- ── Lock down (Supabase grants anon broadly by default on new objects) ──
ALTER TABLE anatomy.anchors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE anatomy.series_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA anatomy FROM anon, authenticated;
REVOKE ALL ON SCHEMA anatomy         FROM anon, authenticated;

-- Verify
SELECT label, title, rpi_pct FROM anatomy.v_anchors ORDER BY rpi_pct DESC;
