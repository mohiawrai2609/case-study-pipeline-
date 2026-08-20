# Builds data/001-fast-food.json from values verified against
# Supabase project qpibugnhpuoxlsmyuksz (schemas rpi / rpi_raw).
# Prose here is the DB's own role_narratives text, lightly edited for register.
import json, re, os

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

role = {"title": "Fast Food and Counter Workers", "soc": "35-3023.00",
        "group": "Food Preparation", "rank": 136, "emp_k": 3796,
        "wage": 30480, "growth": 6.1, "timeline": "2-5 years", "band": "Moderate"}
scores = {"rpi": 35.8, "aps": 55, "hrf": 35, "untouched": 45,
          "ajci": 8, "cognitive": 38, "physical": 18}

TASKS = [
 ("Process customer payments through AI kiosk systems or mobile apps", "ai augmented", "Toast, Olo"),
 ("Serve customers at counter for pickup of AI-routed orders", "ai augmented", "Kiosk platforms"),
 ("Reconcile daily receipts with automated POS reports", "ai augmented", "Restaurant365"),
 ("Respond to customer complaints beyond chatbot capability", "traditional", "No vendor - human only"),
 ("Deliver food orders to tables and drive-through windows", "traditional", "Bear Robotics, Pudu"),
 ("Monitor inventory levels flagged by automated par-level systems", "ai augmented", "Toast, Restaurant365"),
 ("Perform cleaning and sanitation following digital checklists", "traditional", "No vendor - human only"),
 ("Brew coffee and beverages, monitor machine alerts", "traditional", "No vendor - human only"),
 ("Assemble sandwiches and menu items on kitchen display screens", "traditional", "No vendor - human only"),
 ("Operate frozen beverage and soft-serve machines", "traditional", "No vendor - human only"),
 ("Package completed orders with barcode accuracy verification", "traditional", "No vendor - human only"),
 ("Clear and reset dining areas, bus tables", "traditional", "No vendor - human only"),
 ("Deep-clean cooking equipment and sanitize food contact areas", "traditional", "No vendor - human only"),
 ("Coordinate order flow when AI routing is overloaded", "traditional", "No vendor - human only"),
 ("Train new employees on equipment and AI system interfaces", "traditional", "No vendor - human only"),
 ("Validate automated food temperature alerts from IoT sensors", "ai created human", "SmartSense, Jolt, Zenput"),
 ("Provide technical support for kiosk errors", "ai created human", "No vendor - human only"),
]
TYPE = {"ai augmented": "a", "traditional": "h", "ai created human": "h"}
HIGH_COVER = {0: "r", 15: "r"}   # >=0.75 production evidence in product_task_evidence
tasks = [{"name": txt.split(",")[0][:40], "type": HIGH_COVER.get(i, TYPE[t]),
          "desc": txt + ".", "vendor": v} for i, (txt, t, v) in enumerate(TASKS)]

V = [
 ("Toast", "TO", "Public (NYSE: TOST)", 164000, 2, "Production",
  "Toast Kiosk & Toast for Quick Service, Toast Inventory",
  "About 164,000 locations on the platform as of 2025, across QSR and full-service brands.",
  [("Process customer payments via AI kiosk", 85, "Cognitive"), ("Monitor inventory par-levels", 60, "Physical")]),
 ("Restaurant365", "R3", "Growth-stage, ~$437.5M raised", 40000, 2, "Production",
  "Accounting & Ops Platform, Inventory Management",
  "Used by multi-unit restaurant groups; G2-recognised for restaurant BI and inventory.",
  [("Reconcile daily receipts with POS", 70, "Cognitive"), ("Monitor inventory par-levels", 65, "Physical")]),
 ("Zenput (CrunchTime)", "ZC", "Acquired by CrunchTime, 2022", 60000, 1, "Production",
  "Zenput Operations Execution Platform",
  "60,000+ locations across 100+ countries, including Chipotle, Five Guys and 7-Eleven.",
  [("Validate automated temperature alerts", 70, "Cognitive")]),
 ("Olo", "OL", "Public (NYSE: OLO)", 75000, 1, "Production", "Olo Pay (card-present and kiosks)",
  "750+ restaurant brands; Olo Pay extends to self-service kiosks via NCR Voyix, Qu and TRAY.",
  [("Process customer payments via AI kiosk", 80, "Cognitive")]),
 ("SmartSense by Digi", "SD", "Unit of Digi International (NASDAQ: DGII)", 500, 1, "Production",
  "SmartSense Food Service Monitoring",
  "500+ locations of a major chain, reporting near-perfect temperature-monitoring compliance.",
  [("Validate automated temperature alerts", 80, "Cognitive")]),
 ("Pudu Robotics", "PR", "Series C3, ~$170M total", 6000, 1, "Production", "PuduBot",
  "60+ restaurants have deployed 100+ Pudu service robots, according to regional partners.",
  [("Deliver food orders to tables", 70, "Physical")]),
 ("Bear Robotics", "BR", "Series C, ~$60M at $500M valuation", 2000, 1, "Pilot", "Servi / Servi Plus",
  "Servi Plus is positioned as a server assistant for food running and table bussing.",
  [("Deliver food orders to tables", 75, "Physical")]),
 ("Jolt", "JO", "Acquired by Digi for ~$145.5M, 2025", 5000, 1, "Pilot",
  "Jolt Operations Management & Temperature Probes",
  "Small and mid-size food businesses; being folded into SmartSense post-acquisition.",
  [("Validate automated temperature alerts", 75, "Cognitive")]),
]
GRAD = ["linear-gradient(135deg,#C41E3A,#9A1830)", "linear-gradient(135deg,#B45309,#92400E)",
        "linear-gradient(135deg,#2563EB,#1D4ED8)", "linear-gradient(135deg,#059669,#047857)"]
vendors = [{"id": re.sub(r"[^a-z0-9]", "", n.lower())[:6], "name": n, "initials": ini,
            "stage": st, "workers": w, "products": p, "evidence": ev, "logo": GRAD[i % 4],
            "desc": d, "note": note,
            "tasks": [{"name": tn, "aps": a, "vec": vc} for tn, a, vc in ts]}
           for i, (n, ini, st, w, p, ev, d, note, ts) in enumerate(V)]

SHIFT = [
 ("6:00 AM", "Equipment diagnostics and kitchen prep", "augmented",
  "IoT sensors run overnight temperature validation. The worker reviews the automated exception log and signs off on the HACCP record."),
 ("7:00 AM", "Opening, first kiosk orders", "automated",
  "Kiosks and Olo Pay handle early transactions end to end. Payment capture requires no human touch."),
 ("9:00 AM", "Breakfast rush, coordinating systems", "augmented",
  "The worker moves between kiosk queue, kitchen display and drive-through, troubleshooting a frozen terminal mid-rush."),
 ("10:00 AM", "Inventory alerts and restocking", "automated",
  "Restaurant365 flags stock trending below par from sales velocity and drafts the purchase order. The worker physically restocks."),
 ("12:00 PM", "Peak rush, exception handling", "augmented",
  "Maximum volume. The worker's primary role is managing everything the automation cannot route."),
 ("1:00 PM", "Angry customer, wrong order", "human",
  "Wrong meal, twenty-minute wait, a crying child. No algorithm handles this. The worker reads the room and improvises."),
 ("2:00 PM", "Food safety compliance walk", "human",
  "Health protocols require human sign-off: fryer oil clarity, grill cleanliness, drain covers."),
 ("3:00 PM", "Deep clean, grill and fryer", "human",
  "Burnt grease, splattered oil, a clogged drain. Every surface is different. Nothing ships for this."),
 ("4:00 PM", "Afternoon kiosk monitoring", "automated",
  "Volume drops. Kiosks take nearly all orders. Cash reconciliation runs itself and flags a $12 variance."),
 ("5:00 PM", "Shift handover and close", "augmented",
  "The system generates the shift summary; the outgoing worker adds the context it could not see."),
]
shift = [{"time": t, "task": k, "type": ty, "desc": d} for t, k, ty, d in SHIFT]

N = {
 "summary": "Fast food workers now operate in AI-augmented kitchens where kiosks handle most order entry, automated inventory systems manage stock levels, and digital temperature monitors enforce food safety compliance. The human role has shifted toward quality control, handling the exceptions that fall outside automated workflows, and providing the face-to-face service layer that builds customer loyalty in an increasingly automated environment.",
 "aps": "The cognitive automation layer is fully deployed. Kiosks handle 70 per cent or more of order entry at major chains, POS systems auto-reconcile receipts, and inventory platforms flag restock needs without human monitoring. That drives Cognitive APS to 0.38. Physical APS reaches only 0.18, because cooking robots and cleaning bots remain in pilot stages: assembling sandwiches, operating fryers and bussing tables still demand a manual dexterity that current robotics cannot match at quick-service speed and cost.",
 "hrf": "Human defensibility here comes from physical work context and real-time problem-solving rather than deep expertise. O*NET confirms that workers spend most of their time standing and handling objects in fast-paced environments. The Job Zone 2 classification and the low consequence of any individual error, since a wrong order can simply be remade, cap HRF at 0.35. But face-to-face contact scores near the top of the scale, and that service layer is where the defensibility actually lives.",
 "outlook": "An AJCI of 0.08 reflects AI creating supervisory tasks, such as kiosk troubleshooting and IoT temperature validation, rather than eliminating the role. The next decade brings continued bifurcation: transactional work migrates fully to self-service while humans concentrate on exception handling and the emotional labour of service recovery. Physical automation will penetrate cooking, but remains five to ten years from economic viability at scale.",
}

sections = [
 {"blocks": [{"t": "p", "drop": True, "text": N["summary"]}]},
 {"id": "s-score", "label": "The Score", "title": "35.8% - And Why the Number Moved", "blocks": [
   {"t": "component", "name": "gauge"},
   {"t": "p", "text": "Fast Food and Counter Workers score an RPI of **35.8 per cent**, an APS of 0.55 against an HRF of 0.35. That places the role in the *Moderate* band, ranked 136th of 995 scored occupations."},
   {"t": "ins", "label": "A Note on This Revision",
    "text": "This edition supersedes the original No. 001, which published at 32.2 per cent. That figure came from an APS/HRF pair of 0.52/0.38 which does not appear anywhere in the scoring database's audit history. Every number here is derived directly from the scoring engine."},
   {"t": "component", "name": "chartEx"},
   {"t": "p", "text": N["aps"]}]},
 {"id": "s-shift", "label": "The Shift", "title": "One Day Behind the Counter", "blocks": [
   {"t": "p", "text": "Scores are abstractions. A shift is not. Here is where automation actually touches the work, hour by hour."},
   {"t": "component", "name": "shift"}]},
 {"id": "s-tasks", "label": "The Anatomy", "title": "Seventeen Tasks. Click Any One.", "blocks": [
   {"t": "p", "text": "O*NET's task inventory, re-decomposed for the AI era. Eleven remain traditional, four are augmented, and two did not exist before automation created them."},
   {"t": "component", "name": "taskGrid"}]},
 {"id": "s-vendors", "label": "The Innovators", "title": "The Companies Building the Augmented Counter", "blocks": [
   {"t": "p", "text": "Eight vendors hold production or pilot evidence against this role's tasks. **None qualifies as a Leader.** The broadest covers two tasks out of seventeen, a breadth of 0.12, below the 0.16 threshold. This is a market of specialists, not platforms."},
   {"t": "component", "name": "matrix"},
   {"t": "component", "name": "vendorCards"}]},
 {"id": "s-fortress", "label": "The Human Fortress", "title": "Anger, Grease, and the Health Inspector", "blocks": [
   {"t": "p", "text": N["hrf"]},
   {"t": "pq", "text": "PLACEHOLDER - no quote in this build has passed verification. The pipeline's verify stage must confirm speaker, role, publication and date before any quote ships.",
    "cite": "Unverified - blocked from publication"}]},
 {"id": "s-economics", "label": "The Economics", "title": "Show Me the Money", "blocks": [
   {"t": "component", "name": "econ"}]},
 {"id": "s-2030", "label": "Looking Ahead", "title": "What the Counter Looks Like in 2030", "blocks": [
   {"t": "p", "text": N["outlook"]}]},
 {"id": "s-feedback", "label": "Challenge This Score", "title": "Think 35.8% Is Wrong? Prove It.", "blocks": [
   {"t": "component", "name": "feedback"}]},
]

D = {"issue": 1, "role": role, "scores": scores,
     "cover": {"title": "Would You Like <em>Automation</em> With That?",
               "subtitle": "Inside the job that is splitting in two, and the three human skills no machine can buy.",
               "published": "August 2026"},
     "matrix": {"breadthThreshold": 0.16, "depthThreshold": 0.70},
     "econ": {"labourBase": 34500, "techFixed": 17600, "baseVolume": 500},
     "tasks": tasks, "vendors": vendors, "shift": shift, "sections": sections}

with open("data/001-fast-food.json", "w", encoding="utf-8") as f:
    json.dump(D, f, indent=1, ensure_ascii=False)
print("data/001-fast-food.json written")
print("  %d tasks | %d vendors | %d shift rows | %d sections"
      % (len(tasks), len(vendors), len(shift), len(sections)))
