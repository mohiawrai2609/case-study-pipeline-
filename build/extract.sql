-- Automation Anatomy — deterministic extraction for ONE role.
-- Returns the entire fact base as a single JSON document.
-- Usage:  replace :soc with the SOC code, e.g. '43-3031.00'
--
-- This produces ONLY facts. Prose, the shift timeline, the cover lines and the
-- image prompts come from the research and compose stages — never from here.

WITH role AS (
  SELECT * FROM rpi.roles WHERE soc_code = :soc
),
-- one row per vendor for this role, with derived breadth/depth
vend AS (
  SELECT v.vendor_id,
         v.display_name                                        AS name,
         upper(substring(regexp_replace(v.display_name,'[^a-zA-Z]','','g'),1,2)) AS initials,
         count(DISTINCT e.task_uid)                             AS task_n,
         round(avg(e.task_coverage)*100)                        AS avg_aps,
         count(DISTINCT p.product_id)                           AS products,
         bool_or(e.evidence_type IN ('case_study','live_url'))  AS is_production,
         max(e.trust_score)                                     AS trust,
         string_agg(DISTINCT p.product_name, ', ')              AS product_list,
         left(max(e.notable_deployments), 200)                  AS deployment_note,
         left(max(pi.funding_stage), 60)                        AS funding,
         max(pi.g2_rating)                                      AS g2,
         jsonb_agg(DISTINCT jsonb_build_object(
             'name', left(t.task_text, 52),
             'aps',  round(e.task_coverage*100),
             'vec',  initcap(t.ai_vector)))                     AS tasks
  FROM rpi.tasks t
  JOIN rpi.product_task_evidence e ON e.task_uid   = t.task_uid
  JOIN rpi.products              p ON p.product_id = e.product_id
  JOIN rpi.vendors               v ON v.vendor_id  = p.vendor_id
  LEFT JOIN rpi.product_intel   pi ON pi.product_id= p.product_id
  WHERE t.soc_code = :soc
  GROUP BY v.vendor_id, v.display_name
),
-- comparison anchors: live from rpi.roles so they can never drift
anchors AS (
  SELECT soc_code, title, rpi_pct, risk_band
  FROM rpi.roles
  WHERE soc_code IN ('43-5071.00','43-4051.00','23-2011.00','41-2031.00',
                     '13-2011.00','15-1252.00','29-1141.00')
     OR soc_code = :soc
)
SELECT jsonb_pretty(jsonb_build_object(
  'soc',    r.soc_code,
  'role',   jsonb_build_object(
              'title', r.title, 'soc', r.soc_code, 'group', r.occupation_group,
              'rank', r.rank, 'emp_k', r.us_emp_k, 'wage', r.wage_usd_annual,
              'growth', r.bls_growth_pct, 'timeline', r.timeline,
              'band', r.risk_band, 'job_zone', r.job_zone),
  'scores', jsonb_build_object(
              'rpi', r.rpi_pct, 'aps', round(r.aps*100), 'hrf', round(r.hrf*100),
              'untouched', round(r.untouched*100), 'ajci', r.ajci_pct,
              'cognitive', r.cognitive_aps_pct, 'physical', r.physical_aps_pct),
  'counts', jsonb_build_object(
              'tasks', r.task_count, 'traditional', r.traditional_tasks,
              'augmented', r.ai_augmented_tasks, 'created', r.ai_created_tasks,
              'cognitive', r.cognitive_tasks, 'physical', r.physical_tasks,
              'hybrid', r.hybrid_tasks),
  'tasks',  (SELECT jsonb_agg(jsonb_build_object(
                'text', t.task_text, 'type', t.task_type, 'vec', t.ai_vector,
                'importance', t.importance, 'top_vendor', t.top_vendor_src,
                'vendor_count', t.vendor_count_src) ORDER BY t.task_seq)
             FROM rpi.tasks t WHERE t.soc_code = :soc),
  'ai_created_tasks', (SELECT jsonb_agg(task_text ORDER BY seq)
             FROM rpi.role_ai_created_tasks WHERE soc_code = :soc),
  'vendors',(SELECT jsonb_agg(jsonb_build_object(
                'name', name, 'initials', initials, 'task_n', task_n,
                'avg_aps', avg_aps, 'products', products,
                'evidence', CASE WHEN is_production THEN 'Production' ELSE 'Pilot' END,
                'trust', trust, 'desc', product_list, 'note', deployment_note,
                'stage', coalesce(funding,'Private'), 'g2', g2, 'tasks', tasks)
                ORDER BY task_n DESC, avg_aps DESC) FROM vend),
  'narrative', (SELECT to_jsonb(n) - 'soc_code' FROM rpi.role_narratives n WHERE n.soc_code = :soc),
  'readiness', (SELECT to_jsonb(rr) - 'soc_code' FROM rpi.role_readiness rr WHERE rr.soc_code = :soc),
  'anchors', (SELECT jsonb_agg(jsonb_build_object(
                'soc', soc_code, 'title', title, 'rpi', rpi_pct, 'band', risk_band)
                ORDER BY rpi_pct DESC) FROM anchors),
  'matrix', jsonb_build_object('breadthThreshold', 0.16, 'depthThreshold', 0.70),
  'formula', 'RPI = APS x (1 - HRF) x 100'
)) AS facts
FROM role r;
