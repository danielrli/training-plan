import { useState, useEffect, useRef } from "react";

// Derived from FIT file + Runalyze dashboard
// Max HR: 186 bpm (observed mile 3 of TT), Resting HR: 63 bpm
// Karvonen (HRR) zones — HRR = 123 bpm
// Z1  Recovery    <50% HRR  → <125 bpm
// Calibrated to max HR 195 (May 31 TT), RHR 63, HRR 132.
// Z2  Easy        50–65%    → 129–149 bpm
// Z3  Moderate    65–75%    → 149–162 bpm
// Z4  Threshold   75–87%    → 162–178 bpm
// Z5  VO2max      87–95%    → 178–188 bpm
// Z5+ Race        95–100%   → 188–195 bpm

// Zones calibrated to max HR 195 (May 31 TT), RHR 63, HRR 132. Uses same % HRR boundaries as before.
const ZONES = {
  Z1:  { label: "Z1 · Recovery",  range: "<129 bpm",    color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0", use: "Full recovery runs" },
  Z2:  { label: "Z2 · Easy",      range: "129–149 bpm", color: "#10b981", bg: "#f0fdf4", border: "#bbf7d0", use: "All easy days" },
  Z3:  { label: "Z3 · Moderate",  range: "149–162 bpm", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", use: "Warm-up / cool-down" },
  Z4:  { label: "Z4 · Threshold", range: "162–178 bpm", color: "#d97706", bg: "#fffbeb", border: "#fde68a", use: "Threshold sessions" },
  Z5:  { label: "Z5 · VO2max",    range: "178–188 bpm", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", use: "Interval sessions" },
  Z5p: { label: "Z5+ · Race",     range: "188–195 bpm", color: "#e11d48", bg: "#fff1f2", border: "#fecdd3", use: "5K race effort" },
};

const weeks = [
  {
    week:1, dates:"Apr 13–19", block:1, miles:30, phase:"Base", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 · 130–149 bpm. Full conversation possible. Add 4×20s strides at end — HR will spike briefly, that's fine."},
      {day:"Tue",type:"quality",miles:7, label:"Threshold Cruise Intervals", zone:"Z4", detail:"WU to Z2 · 4×8min building into Z4 (162–178 bpm) w/ 90s easy jog · CD to Z2. Don't start reps above 162 — let HR climb naturally."},
      {day:"Wed",type:"easy",miles:5, label:"Easy 5mi", zone:"Z1", detail:"Z1–Z2 · stay under 149 bpm. True recovery. If HR climbs above 151, slow down."},
      {day:"Thu",type:"easy",miles:8, label:"Medium-Long 8mi", zone:"Z2", detail:"Z2 · 135–149 bpm. Aerobic build. Slight drift to 154 in final mile is fine."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Non-negotiable. Walk, stretch, sleep."},
      {day:"Sat",type:"easy",miles:5, label:"Easy 5mi", zone:"Z2", detail:"Z2 · 130–149 bpm."},
      {day:"Sun",type:"long",miles:6, label:"Long Run 6mi", zone:"Z2", detail:"Z2 · 135–151 bpm. Comfortable. No HR spikes."},
    ],
    notes:"Your Runalyze monotony was flagged at 50% — your easy and hard days feel too similar. Heart rate fixes this: if easy-day HR is above 148, you're not recovering. Slow down until the number is right, regardless of how slow that feels.",
  },
  {
    week:2, dates:"Apr 20–26", block:1, miles:28, phase:"Base", target5k:"24:30",
    sessions:[
      {day:"Mon",type:"easy",miles:5, label:"Easy 5mi", zone:"Z2", detail:"Z2 · 130–149 bpm. Extra rest before TT Sunday."},
      {day:"Tue",type:"quality",miles:6, label:"Threshold Tempo", zone:"Z4", detail:"WU to Z2 · 25min holding Z4 (162–178 bpm) continuously · CD. HR should stabilise mid-Z4 after 5–8min warmup lag."},
      {day:"Wed",type:"easy",miles:5, label:"Easy 5mi", zone:"Z1", detail:"Z1 · under 135 bpm. Short and very easy."},
      {day:"Thu",type:"easy",miles:5, label:"Easy 5mi", zone:"Z1", detail:"Z1–Z2. TT taper. Nothing above 146."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:3, label:"Shakeout 3mi + Strides", zone:"Z2", detail:"Z2 easy + 4×20s strides. HR will spike during strides — expected."},
      {day:"Sun",type:"tt",miles:5, label:"🏁 TIME TRIAL", zone:"Z5p", detail:"Target sub-24:30. WU 10–15min to Z3. Race: Z4 first 800m → build to Z5 by mile 2 → finish Z5+ (189–195 bpm). Compare HR profile to your 24:44 FIT file."},
    ],
    notes:"HR blueprint for this TT: Mile 1 avg ~170 (Z5 low), Mile 2 ~176, Mile 3 ~182+. Your 24:44 showed this pattern — replicate it with a slightly faster start.",
  },
  {
    week:3, dates:"Apr 27–May 3", block:1, miles:31, phase:"Base", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:5, label:"Easy 5mi", zone:"Z1", detail:"Z1 · under 135. TT recovery. Go slower than feels necessary."},
      {day:"Tue",type:"quality",miles:7, label:"Threshold Cruise Intervals", zone:"Z4", detail:"WU · 5×7min in Z4 (162–178 bpm) w/ 90s jog · CD. Same HR target — check if it feels easier than Week 1."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 · 135–149 bpm."},
      {day:"Thu",type:"easy",miles:8, label:"Medium-Long 8mi", zone:"Z2", detail:"Z2 · 135–151 bpm."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:5, label:"Easy 5mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Sun",type:"long",miles:7, label:"Long Run 7mi", zone:"Z2", detail:"Z2 · 135–151 bpm."},
    ],
    notes:"Review your TT HR data. Was Mile 2 slow due to fatigue or pacing? If HR was already at 180+ in mile 1, you went out too hot — not undertrained.",
  },
  {
    week:4, dates:"May 4–10", block:1, miles:32, phase:"Base", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi + Strides", zone:"Z2", detail:"Z2 base + 6×20s strides. Strides should briefly hit Z5+ — that's their purpose."},
      {day:"Tue",type:"quality",miles:7, label:"Threshold Tempo", zone:"Z4", detail:"WU · 30min holding Z4 (162–178 bpm) · CD. Longest tempo yet. HR drift to 180 in final 5min is acceptable cardiac drift."},
      {day:"Wed",type:"easy",miles:5, label:"Easy 5mi", zone:"Z1", detail:"Z1 · under 135. Recovery."},
      {day:"Thu",type:"easy",miles:6, label:"Easy 6mi + Strides", zone:"Z2", detail:"Z2 + 6×20s strides. Second stride day — start introducing faster turnover."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:5, label:"Easy 5mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Sun",type:"long",miles:8, label:"Long Run 8mi", zone:"Z2", detail:"Z2 · 135–151 bpm."},
    ],
    notes:"First week with two stimulus days (Tue tempo + Thu strides). Thursday average HR should still be Z2 — the strides are brief Z5+ bursts embedded in easy running.",
  },
  {
    week:5, dates:"May 11–17", block:1, miles:32, phase:"Build", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 · 135–149 bpm."},
      {day:"Tue",type:"quality",miles:7, label:"Threshold Cruise Intervals", zone:"Z4", detail:"WU · 3×12min in Z4 (165–178 bpm) w/ 2min Z1 jog · CD. Longer reps. Focus on even HR — don't spike rep 1."},
      {day:"Wed",type:"easy",miles:5, label:"Easy 5mi", zone:"Z1", detail:"Z1 · under 135."},
      {day:"Thu",type:"easy",miles:8, label:"Medium-Long 8mi", zone:"Z2", detail:"Z2 · 135–151 bpm."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:5, label:"Easy 5mi + Strides", zone:"Z2", detail:"Z2 + 4×20s strides."},
      {day:"Sun",type:"long",miles:8, label:"Long Run 8mi", zone:"Z2", detail:"Z2 · 135–151 bpm."},
    ],
    notes:"If HR climbs above 172 on rep 1 of the cruise intervals, you're in Z5 not Z4. The zone is the target, not the clock.",
  },
  {
    week:6, dates:"May 18–24", block:1, miles:34, phase:"Build", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 · 135–149 bpm."},
      {day:"Tue",type:"quality",miles:7, label:"Threshold Tempo", zone:"Z4", detail:"WU · 35min continuous Z4 (165–178 bpm) · CD. Aim to start at 165, finish at 178. Drift fine, spike is not."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z1", detail:"Z1 · under 135. Extra recovery given volume jump."},
      {day:"Thu",type:"easy",miles:6, label:"Easy 6mi + Strides", zone:"Z2", detail:"Z2 + 6×20s strides."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Sun",type:"long",miles:9, label:"Long Run 9mi", zone:"Z2", detail:"Z2 · 135–151 bpm. First 9-miler."},
    ],
    notes:"34 miles — new weekly high. Higher fatigue creates a temptation to run easy days at Z3 instead of Z2. Resist. The easy-day HR discipline is what makes the quality days work.",
  },
  {
    week:7, dates:"May 25–31", block:1, miles:28, phase:"Build", target5k:"23:45",
    sessions:[
      {day:"Mon",type:"easy",miles:5, label:"Easy 5mi", zone:"Z2", detail:"Z2. TT taper starts."},
      {day:"Tue",type:"quality",miles:5, label:"Short Threshold Sharpener", zone:"Z4", detail:"WU · 2×10min Z4 (172–186 bpm) w/ 90s jog · CD. Short — just priming the system."},
      {day:"Wed",type:"easy",miles:4, label:"Easy 4mi", zone:"Z1", detail:"Z1 · under 134."},
      {day:"Thu",type:"easy",miles:4, label:"Easy 4mi", zone:"Z1", detail:"Z1. Keep fresh."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:3, label:"Shakeout 3mi + Strides", zone:"Z2", detail:"Z2 + 4×20s strides."},
      {day:"Sun",type:"tt",miles:5, label:"🏁 TIME TRIAL — 23:42 ✓", zone:"Z5", detail:"RESULT: 23:42 (7:27 / 7:40 / 7:46 + finish kick). Avg HR 179, max 195 (new high). Beat sub-23:45 target by 3 sec. Pacing flipped from April's catastrophic mile-2 collapse to a controlled positive split. Cardiovascular-limited, not pace-limited."},
    ],
    notes:"Hit the target — 23:42, 62 sec faster than April baseline. Honest TT, paced from the gun and held it. New max HR 195 → zones recalibrated. Next TT (W11) targets sub-23:00; aim for even splits ~7:35/mi rather than going out at 7:27 again.",
  },
  {
    week:8, dates:"Jun 1–7", block:1, miles:30, phase:"Build", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:5, label:"Easy 5mi", zone:"Z1", detail:"Z1 · TT recovery. Under 130."},
      {day:"Tue",type:"quality",miles:8, label:"Threshold Cruise Intervals", zone:"Z4", detail:"WU · 4×10min Z4 (167–178 bpm) w/ 90s jog · CD."},
      {day:"Wed",type:"easy",miles:5, label:"Easy 5mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Thu",type:"easy",miles:8, label:"Medium-Long 8mi", zone:"Z2", detail:"Z2 · 135–151 bpm."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:5, label:"Easy 5mi + Strides", zone:"Z2", detail:"Z2 + 5×20s strides."},
      {day:"Sun",type:"long",miles:8, label:"Long Run 8mi", zone:"Z2", detail:"Z2 long."},
    ],
    notes:"Back to full training. Same HR targets — if they feel easier at the same effort, that's fitness accumulating.",
  },
  {
    week:9, dates:"Jun 8–14", block:1, miles:34, phase:"Build", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 · 135–149 bpm."},
      {day:"Tue",type:"quality",miles:7, label:"Threshold Tempo", zone:"Z4", detail:"WU · 38min Z4 (167–178 bpm) continuous · CD."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z1", detail:"Z1 · under 135."},
      {day:"Thu",type:"quality",miles:6, label:"Easy + Strides + 200m Reps", zone:"Z5p", detail:"5mi Z2 · 4×20s strides · 4×200m at Z5+ (189–195 bpm) w/ 2min walk. First taste of race HR. Each rep: ~45–55s. HR may not fully stabilise — that's fine, it's neuromuscular work."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Sun",type:"long",miles:9, label:"Long Run 9mi", zone:"Z2", detail:"Z2 · 135–151 bpm."},
    ],
    notes:"First exposure to Z5+ (180–186 bpm) — your 5k race zone. The 200m reps are short enough that HR may spike and drop; what matters is you're training the body to fire at that intensity.",
  },
  {
    week:10, dates:"Jun 15–21", block:1, miles:0, phase:"Break", target5k:null,
    sessions:[
      {day:"Mon",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
      {day:"Tue",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
      {day:"Wed",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
      {day:"Thu",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
      {day:"Fri",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
      {day:"Sat",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
      {day:"Sun",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
    ],
    notes:"Week 1 of 2 planned break (Jun 15–28). Full rest — no running. Resume week 12 on Jun 29.",
  },
  {
    week:11, dates:"Jun 22–28", block:1, miles:0, phase:"Break", target5k:null,
    sessions:[
      {day:"Mon",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
      {day:"Tue",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
      {day:"Wed",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
      {day:"Thu",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
      {day:"Fri",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
      {day:"Sat",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
      {day:"Sun",type:"rest",miles:0, label:"Rest", zone:null, detail:"Planned break. No running."},
    ],
    notes:"Week 2 of 2 planned break (Jun 15–28). Full rest — no running. The Jun TT is postponed; the next checkpoint is week 15 (Jul 20).",
  },
  {
    week:12, dates:"Jun 29–Jul 5", block:1, miles:31, phase:"Build", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:5, label:"Easy 5mi", zone:"Z1", detail:"Z1 · TT recovery."},
      {day:"Tue",type:"quality",miles:7, label:"Threshold Tempo", zone:"Z4", detail:"WU · 35min Z4 (167–178 bpm) · CD."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Thu",type:"easy",miles:8, label:"Medium-Long 8mi", zone:"Z2", detail:"Z2 aerobic."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:5, label:"Easy 5mi + Strides", zone:"Z2", detail:"Z2 + 5×20s strides."},
      {day:"Sun",type:"long",miles:8, label:"Long Run 8mi", zone:"Z2", detail:"Z2 long."},
    ],
    notes:"If the June TT showed your HR ceiling rising (hitting 186 more easily and still finishing), that's aerobic development — not overexertion.",
  },
  {
    week:13, dates:"Jul 6–12", block:1, miles:35, phase:"Peak Base", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Tue",type:"quality",miles:8, label:"Threshold Cruise Intervals", zone:"Z4", detail:"WU · 4×12min Z4 (169–178 bpm) w/ 90s jog · CD. Deeper into Z4."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z1", detail:"Z1 · under 135."},
      {day:"Thu",type:"quality",miles:6, label:"Easy + 400m Race Reps", zone:"Z5p", detail:"5mi Z2 · 6×400m at Z5+ (189–195 bpm) w/ 2min walk. HR should stabilise at 190–195 mid-rep. If rep 5–6 can't reach 189, reduce to 4 reps."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Sun",type:"long",miles:9, label:"Long Run 9mi", zone:"Z2", detail:"Z2 long."},
    ],
    notes:"Teaching the body to sustain Z5+ (180–186) repeatedly is the bridge between threshold training and race fitness. Quality over quantity on the reps.",
  },
  {
    week:14, dates:"Jul 13–19", block:1, miles:36, phase:"Peak Base", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Tue",type:"quality",miles:7, label:"Threshold Tempo", zone:"Z4", detail:"WU · 40min Z4 (169–178 bpm) · CD. HR drift to 181–182 in the final 8min is acceptable cardiac drift."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z1", detail:"Z1 easy."},
      {day:"Thu",type:"easy",miles:10, label:"Medium-Long 10mi", zone:"Z2", detail:"Z2 · 135–151 bpm. Biggest medium-long yet."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:6, label:"Easy 6mi + Strides", zone:"Z2", detail:"Z2 + 6×20s strides."},
      {day:"Sun",type:"long",miles:9, label:"Long Run 9mi", zone:"Z2", detail:"Z2 long."},
    ],
    notes:"36 miles and a 40min tempo. Peak Block 1 week. Don't fight cardiac drift at the end of the tempo — it's a normal physiological response, not a problem.",
  },
  {
    week:15, dates:"Jul 20–26", block:1, miles:27, phase:"Peak Base", target5k:"22:30",
    sessions:[
      {day:"Mon",type:"easy",miles:5, label:"Easy 5mi", zone:"Z2", detail:"Z2. TT taper."},
      {day:"Tue",type:"quality",miles:5, label:"Short Threshold Sharpener", zone:"Z4", detail:"WU · 2×10min Z4 (169–178 bpm) · CD."},
      {day:"Wed",type:"easy",miles:4, label:"Easy 4mi", zone:"Z1", detail:"Z1 easy."},
      {day:"Thu",type:"easy",miles:3, label:"Easy 3mi + Strides", zone:"Z2", detail:"Z2 + 4×20s strides to Z5+."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:3, label:"Shakeout 3mi", zone:"Z1", detail:"Very easy. Under 130. Legs should feel springy."},
      {day:"Sun",type:"tt",miles:5, label:"🏁 TIME TRIAL", zone:"Z5p", detail:"Target sub-22:30. Block 1 final TT. Goal: first 600m build to Z5 (180–183) → mile 2 hold Z5 (184–187) → mile 3 Z5+ (189–195). Finish emptied."},
    ],
    notes:"Block 1 final assessment. Sub-22:30 sets up a legitimate sub-20 chase in Block 2. Use the HR ceiling from this TT to calibrate Block 2 zone targets — if your max was 184 not 186, adjust Z5+ accordingly.",
  },
  {
    week:16, dates:"Jul 27–Aug 2", block:2, miles:30, phase:"Transition", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:5, label:"Easy 5mi", zone:"Z1", detail:"Z1 · TT recovery. Under 130."},
      {day:"Tue",type:"quality",miles:6, label:"VO2max Intro: Short Intervals", zone:"Z5", detail:"WU to Z2 · 6×3min in Z5 (178–189 bpm) w/ 3min Z1 jog · CD. Block 2 begins. HR may take 60–90s to reach Z5 per rep — that's lag, not failure."},
      {day:"Wed",type:"easy",miles:5, label:"Easy 5mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Thu",type:"easy",miles:8, label:"Medium-Long 8mi", zone:"Z2", detail:"Z2 aerobic."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:5, label:"Easy 5mi + Strides", zone:"Z2", detail:"Z2 + 5×20s strides."},
      {day:"Sun",type:"long",miles:7, label:"Long Run 7mi", zone:"Z2", detail:"Z2 easy. Transition week — volume down."},
    ],
    notes:"Z5 intervals (170–180 bpm) feel very different from Z4 threshold. You'll breathe harder and HR less stable. That's your aerobic ceiling being pushed, not a sign of overexertion.",
  },
  {
    week:17, dates:"Aug 3–9", block:2, miles:33, phase:"VO2max Build", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Tue",type:"quality",miles:6, label:"VO2max Intervals", zone:"Z5", detail:"WU · 5×4min in Z5 (180–189 bpm) w/ 3min Z1 jog · CD. Hold upper band of Z5 on reps 3–5."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z1", detail:"Z1 · under 135. Intervals are taxing — be strict here."},
      {day:"Thu",type:"quality",miles:6, label:"Threshold Tempo", zone:"Z4", detail:"WU · 25min Z4 (167–178 bpm) · CD. Shorter now — quality over volume."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:6, label:"Easy 6mi + Strides", zone:"Z2", detail:"Z2 + 6×20s strides."},
      {day:"Sun",type:"long",miles:8, label:"Long Run 8mi", zone:"Z2", detail:"Z2 long."},
    ],
    notes:"Two quality days — Tuesday Z5 intervals, Thursday Z4 tempo. Wednesday must be Z1. This is the highest training stress of the plan so far.",
  },
  {
    week:18, dates:"Aug 10–16", block:2, miles:34, phase:"VO2max Build", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Tue",type:"quality",miles:7, label:"VO2max Intervals", zone:"Z5", detail:"WU · 6×4min in Z5 (180–189 bpm) w/ 3min Z1 jog · CD. Six reps."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z1", detail:"Z1 · under 135."},
      {day:"Thu",type:"quality",miles:6, label:"Mixed: Z4 primer + Z5+ Race Reps", zone:"Z5p", detail:"WU · 15min Z4 (169–178) · 3min jog · 4×400m at Z5+ (189–195 bpm) w/ 90s jog · CD. The Z4 block pre-fatigues you so the fast reps simulate racing on tired legs."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:6, label:"Easy 6mi + Strides", zone:"Z2", detail:"Z2 + 6×20s strides."},
      {day:"Sun",type:"long",miles:9, label:"Long Run 9mi", zone:"Z2", detail:"Z2 long."},
    ],
    notes:"The Thursday mixed session is Block 2's signature workout. Z4 primer means HR is already at 165+ when the fast reps start — training you to sustain Z5+ when you're not fresh. That's race-specific fitness.",
  },
  {
    week:19, dates:"Aug 17–23", block:2, miles:35, phase:"VO2max Build", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Tue",type:"quality",miles:7, label:"VO2max Intervals", zone:"Z5", detail:"WU · 5×5min in Z5 (182–189 bpm) w/ 3min Z1 jog · CD. Longer reps — more time at VO2max. HR should stabilise within 90s; if it keeps climbing past 182, you started too hard."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z1", detail:"Z1 · strict."},
      {day:"Thu",type:"easy",miles:9, label:"Medium-Long 9mi", zone:"Z2", detail:"Z2 · 135–151 bpm. One aerobic-only day this week."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:6, label:"Easy 6mi + Strides", zone:"Z2", detail:"Z2 + 6×20s strides."},
      {day:"Sun",type:"long",miles:9, label:"Long Run 9mi", zone:"Z2", detail:"Z2 long."},
    ],
    notes:"5-minute VO2max reps at Z5 (174–180 bpm) are the sweet spot for raising your aerobic ceiling. If you can complete 5 reps with HR stable in that band, the engine is growing.",
  },
  {
    week:20, dates:"Aug 24–30", block:2, miles:27, phase:"VO2max Build", target5k:"21:30",
    sessions:[
      {day:"Mon",type:"easy",miles:5, label:"Easy 5mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Tue",type:"quality",miles:5, label:"Sharpener: Short Intervals", zone:"Z5", detail:"WU · 4×3min Z5 (182–189 bpm) w/ 3min jog · CD. Short and crisp — priming for Sunday."},
      {day:"Wed",type:"easy",miles:4, label:"Easy 4mi", zone:"Z1", detail:"Z1 easy."},
      {day:"Thu",type:"easy",miles:3, label:"Easy 3mi + Strides", zone:"Z2", detail:"Z2 + 4×20s strides to Z5+."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:3, label:"Shakeout 3mi", zone:"Z1", detail:"Very easy. Under 128."},
      {day:"Sun",type:"tt",miles:5, label:"🏁 TIME TRIAL", zone:"Z5p", detail:"Target sub-21:30. First Block 2 TT. HR goal: reach Z5 (172+) within first 400m → Z5 through miles 1–2 → Z5+ (189–195) for mile 3. No mile gap over 30 seconds."},
    ],
    notes:"VO2max work should show as the ability to sustain Z5 (172–180) longer before backing off. If HR stabilises at 176 in mile 2 where it used to spike to 180, that's your ceiling rising.",
  },
  {
    week:21, dates:"Aug 31–Sep 6", block:2, miles:32, phase:"Race Specific", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:5, label:"Easy 5mi", zone:"Z1", detail:"Z1 · TT recovery."},
      {day:"Tue",type:"quality",miles:7, label:"VO2max Intervals", zone:"Z5", detail:"WU · 6×4min Z5 (182–189 bpm) w/ 3min jog · CD."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Thu",type:"quality",miles:6, label:"Mixed Z4 + Z5+ Race Reps", zone:"Z5p", detail:"WU · 15min Z4 (169–178) · 3min jog · 3×800m at Z5+ (189–195 bpm) w/ 90s jog · CD. Each 800m rep: ~3:10–3:20 sustained at race HR."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:6, label:"Easy 6mi + Strides", zone:"Z2", detail:"Z2 + 6×20s strides."},
      {day:"Sun",type:"long",miles:7, label:"Long Run 7mi", zone:"Z2", detail:"Z2 easy."},
    ],
    notes:"800m at Z5+ (180–186) is the clearest race-specificity workout. 3 reps with HR holding 180–184 throughout signals the engine needed for sub-20.",
  },
  {
    week:22, dates:"Sep 7–13", block:2, miles:34, phase:"Race Specific", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Tue",type:"quality",miles:7, label:"VO2max Intervals", zone:"Z5", detail:"WU · 5×5min Z5 (182–190 bpm) w/ 3min jog · CD."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z1", detail:"Z1 strict."},
      {day:"Thu",type:"quality",miles:6, label:"Kilometer Race-Zone Reps", zone:"Z5p", detail:"WU · 5×1km at Z5+ (189–195 bpm) w/ 90s jog · CD. Target: HR steady at 190–193 per rep. Rep 1 spike to 195 = started too hard. Rep 5 drift to 184 = still Z5, still fine."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:6, label:"Easy 6mi + Strides", zone:"Z2", detail:"Z2 + 6×20s strides."},
      {day:"Sun",type:"long",miles:8, label:"Long Run 8mi", zone:"Z2", detail:"Z2 long."},
    ],
    notes:"5×1km at Z5+ is the primary readiness indicator. Stable HR at 180–184 across all 5 reps = you have the engine for sub-20.",
  },
  {
    week:23, dates:"Sep 14–20", block:2, miles:35, phase:"Race Specific", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Tue",type:"quality",miles:8, label:"VO2max Intervals", zone:"Z5", detail:"WU · 6×5min Z5 (183–190 bpm) w/ 3min jog · CD. Peak VO2max volume of the plan."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z1", detail:"Z1 strict."},
      {day:"Thu",type:"quality",miles:6, label:"Race Reps + Surges", zone:"Z5p", detail:"WU · 4×1km at Z5+ (189–194 bpm) w/ 90s jog · 2×200m at absolute max (Z5+ ceiling, 193–195 bpm) · CD. The 200m surges train fast-twitch to fire at max HR — essential for the final 400m of a 5k."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:6, label:"Easy 6mi + Strides", zone:"Z2", detail:"Z2 + 6×20s strides."},
      {day:"Sun",type:"long",miles:8, label:"Long Run 8mi", zone:"Z2", detail:"Z2 long."},
    ],
    notes:"6×5min at Z5 is the peak VO2max dose. If rep 5–6 forces HR above 183 to hold effort, reduce to 5 reps — you've hit the right stimulus. More reps isn't better.",
  },
  {
    week:24, dates:"Sep 21–27", block:2, miles:27, phase:"Race Specific", target5k:"20:45",
    sessions:[
      {day:"Mon",type:"easy",miles:5, label:"Easy 5mi", zone:"Z2", detail:"Z2 easy. TT taper."},
      {day:"Tue",type:"quality",miles:5, label:"Sharpener", zone:"Z5", detail:"WU · 4×4min Z5 (182–189 bpm) w/ 3min jog · CD."},
      {day:"Wed",type:"easy",miles:4, label:"Easy 4mi", zone:"Z1", detail:"Z1 easy."},
      {day:"Thu",type:"easy",miles:3, label:"Easy 3mi + Strides", zone:"Z2", detail:"Z2 + 4×20s strides to Z5+."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:3, label:"Shakeout 3mi", zone:"Z1", detail:"Very easy."},
      {day:"Sun",type:"tt",miles:5, label:"🏁 TIME TRIAL", zone:"Z5p", detail:"Target sub-20:45. Two months out from goal. HR blueprint: 400m build to Z4/Z5 boundary (176–180) → Mile 1 avg Z5 (182–185) → Mile 2 Z5 upper (185–189) → Mile 3 Z5+ (189–195). Clearest predictor of November."},
    ],
    notes:"Sub-20:45 = sub-20 in November very much alive. Sub-21:15 = possible with perfect execution. Above 21:30 = reset goal to sub-21. Be honest with the data.",
  },
  {
    week:25, dates:"Sep 28–Oct 4", block:2, miles:33, phase:"Sharpening", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:5, label:"Easy 5mi", zone:"Z1", detail:"Z1 · TT recovery."},
      {day:"Tue",type:"quality",miles:7, label:"VO2max Intervals", zone:"Z5", detail:"WU · 5×5min Z5 (183–190 bpm) w/ 3min jog · CD. Fastest Z5 feel yet."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Thu",type:"quality",miles:7, label:"Race Zone Reps", zone:"Z5p", detail:"WU · 6×1km at Z5+ (190–195 bpm) w/ 90s jog · CD. Six reps — the peak race-specific volume session of the plan."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:6, label:"Easy 6mi + Strides", zone:"Z2", detail:"Z2 + 6×20s strides."},
      {day:"Sun",type:"long",miles:7, label:"Long Run 7mi", zone:"Z2", detail:"Z2 easy."},
    ],
    notes:"6×1km at Z5+ with HR stable at 181–185 is the most important single workout of the cycle. Nail it — the confidence alone is worth something on race day.",
  },
  {
    week:26, dates:"Oct 5–11", block:2, miles:34, phase:"Sharpening", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Tue",type:"quality",miles:7, label:"VO2max Intervals", zone:"Z5", detail:"WU · 4×6min Z5 (183–190 bpm) w/ 3min jog · CD."},
      {day:"Wed",type:"easy",miles:6, label:"Easy 6mi", zone:"Z1", detail:"Z1 strict."},
      {day:"Thu",type:"quality",miles:6, label:"Race Simulation", zone:"Z5p", detail:"WU · 2mi continuous at Z5+ (189–194 bpm) · CD. The gut-check workout. Two miles at race HR — if it holds together, you're ready. If it falls apart at 1.5mi, add one more sharpening week."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:6, label:"Easy 6mi + Strides", zone:"Z2", detail:"Z2 + 6×20s strides."},
      {day:"Sun",type:"long",miles:7, label:"Long Run 7mi", zone:"Z2", detail:"Z2 easy."},
    ],
    notes:"2 miles at Z5+ (180–185 bpm) continuous is the closest simulation to a 5k race. HR holding 180–185 for 16–17 minutes is the clearest pre-race fitness signal.",
  },
  {
    week:27, dates:"Oct 12–18", block:2, miles:33, phase:"Sharpening", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:6, label:"Easy 6mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Tue",type:"quality",miles:6, label:"VO2max Intervals", zone:"Z5", detail:"WU · 5×4min Z5 (183–190 bpm) w/ 3min jog · CD."},
      {day:"Wed",type:"easy",miles:5, label:"Easy 5mi", zone:"Z1", detail:"Z1 easy. Volume dipping."},
      {day:"Thu",type:"quality",miles:6, label:"Short Race Zone Reps", zone:"Z5p", detail:"WU · 4×1km at Z5+ (191–195 bpm) w/ 90s jog · CD. Shorter than Week 25 — intensity up, volume down."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:5, label:"Easy 5mi + Strides", zone:"Z2", detail:"Z2 + 6×20s strides."},
      {day:"Sun",type:"long",miles:7, label:"Long Run 7mi", zone:"Z2", detail:"Z2 easy."},
    ],
    notes:"Your Z2 HR should now produce noticeably faster running than it did in April. That's the adaptation. The taper will let it express itself fully.",
  },
  {
    week:28, dates:"Oct 19–25", block:2, miles:26, phase:"Sharpening", target5k:"20:15",
    sessions:[
      {day:"Mon",type:"easy",miles:4, label:"Easy 4mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Tue",type:"quality",miles:5, label:"Sharpener", zone:"Z5", detail:"WU · 3×5min Z5 (183–190 bpm) w/ 3min jog · CD."},
      {day:"Wed",type:"easy",miles:4, label:"Easy 4mi", zone:"Z1", detail:"Z1 easy."},
      {day:"Thu",type:"easy",miles:3, label:"Easy 3mi + Strides", zone:"Z2", detail:"Z2 + 4×20s strides to Z5+."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:3, label:"Shakeout 3mi", zone:"Z1", detail:"Very easy. Legs should feel explosive."},
      {day:"Sun",type:"tt",miles:5, label:"🏁 TIME TRIAL", zone:"Z5p", detail:"Target sub-20:15. Final tune-up TT. Race with full commitment — November dress rehearsal. Goal: <5 bpm variation between mile splits."},
    ],
    notes:"Sub-20:15 = go for broke in November. Sub-20:30 = tight execution and it's there. Above 20:45 = adjust strategy to sub-21, still race hard. One month out — trust what the training built.",
  },
  {
    week:29, dates:"Oct 26–Nov 1", block:2, miles:28, phase:"Taper", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:5, label:"Easy 5mi", zone:"Z2", detail:"Z2 easy recovery."},
      {day:"Tue",type:"quality",miles:5, label:"Interval Sharpener", zone:"Z5", detail:"WU · 4×3min Z5 (182–189 bpm) w/ 3min jog · CD. Keep the pop."},
      {day:"Wed",type:"easy",miles:5, label:"Easy 5mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Thu",type:"quality",miles:5, label:"Race Zone Reps", zone:"Z5p", detail:"WU · 3×1km at Z5+ (189–194 bpm) w/ 90s jog · CD. Just reminding the legs what race HR feels like."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:4, label:"Easy 4mi + Strides", zone:"Z2", detail:"Z2 + 4×20s strides."},
      {day:"Sun",type:"easy",miles:5, label:"Easy 5mi", zone:"Z2", detail:"Spin the legs. Z2 only."},
    ],
    notes:"Taper begins. Volume drops; intensity stays. Mid-week flatness is normal — your body is consolidating adaptation. Do not add extra runs to compensate.",
  },
  {
    week:30, dates:"Nov 2–8", block:2, miles:22, phase:"Taper", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:4, label:"Easy 4mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Tue",type:"quality",miles:4, label:"Final Interval Session", zone:"Z5", detail:"WU · 3×3min Z5 (182–189 bpm) w/ 3min jog · CD. Last hard session of the entire cycle."},
      {day:"Wed",type:"easy",miles:4, label:"Easy 4mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Thu",type:"easy",miles:3, label:"Easy 3mi + Strides", zone:"Z2", detail:"Z2 + 4×20s strides to Z5+."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:3, label:"Easy 3mi", zone:"Z1", detail:"Very easy."},
      {day:"Sun",type:"easy",miles:4, label:"Easy 4mi", zone:"Z2", detail:"Easy shakeout."},
    ],
    notes:"Last hard workout is Tuesday. Everything after is maintenance. Aerobic fitness peaks 10–14 days after the last hard session — right on schedule for November 29.",
  },
  {
    week:31, dates:"Nov 9–15", block:2, miles:16, phase:"Race Week Prep", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:4, label:"Easy 4mi", zone:"Z2", detail:"Z2 easy."},
      {day:"Tue",type:"easy",miles:3, label:"Easy 3mi + Strides", zone:"Z2", detail:"Z2 + 4×20s strides. Strides should briefly hit Z5+. Good."},
      {day:"Wed",type:"easy",miles:3, label:"Easy 3mi", zone:"Z1", detail:"Z1 very easy."},
      {day:"Thu",type:"easy",miles:3, label:"Easy 3mi + Strides", zone:"Z2", detail:"Z2 + 3×20s strides."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off."},
      {day:"Sat",type:"easy",miles:3, label:"Easy 3mi", zone:"Z1", detail:"Z1 shakeout."},
      {day:"Sun",type:"easy",miles:2, label:"Rest or 2mi", zone:"Z1", detail:"Optional 2mi only."},
    ],
    notes:"Deep taper. You'll feel restless and question your fitness. Don't run more. Sleep is your #1 performance tool this week — prioritise 8+ hours over any extra mileage.",
  },
  {
    week:32, dates:"Nov 16–22", block:2, miles:10, phase:"Race Week", target5k:null,
    sessions:[
      {day:"Mon",type:"easy",miles:3, label:"Easy 3mi", zone:"Z2", detail:"Z2 easy. Final aerobic stimulus."},
      {day:"Tue",type:"easy",miles:2, label:"Easy 2mi + Strides", zone:"Z2", detail:"Z2 + 3×20s strides. Legs should feel light and quick."},
      {day:"Wed",type:"easy",miles:2, label:"Easy 2mi", zone:"Z1", detail:"Very easy. Almost nothing."},
      {day:"Thu",type:"easy",miles:2, label:"Easy 2mi + 2 Strides", zone:"Z2", detail:"Two strides at Z5+. Confirm legs are firing at race HR."},
      {day:"Fri",type:"rest",miles:0, label:"Full Rest", zone:null, detail:"Off. Pack gear. Sleep early."},
      {day:"Sat",type:"rest",miles:0, label:"Rest", zone:null, detail:"Off. Light walk only. Race tomorrow."},
      {day:"Sun",type:"tt",miles:5, label:"🎯 GOAL RACE — SUB-20", zone:"Z5p", detail:"WU: 1.5mi easy Z2 → 4 strides to Z5+. Race HR strategy: first 400m build to Z4/Z5 boundary (178–180) → Mile 1 avg Z5 low (181–184) → Mile 2 avg Z5 mid (184–189) → Mile 3 everything: Z5+ (189–195). Empty the tank."},
    ],
    notes:"Race day. 32 weeks of work. Trust it. One tactical note: if you feel amazing at mile 1, don't accelerate. Bank time with even effort, not a sprint. Mile 3 is where the race is won.",
  },
];

const typeStyles = {
  easy:    { dot: "#10b981", label: "EASY"    },
  quality: { dot: "#60a5fa", label: "QUALITY" },
  long:    { dot: "#a78bfa", label: "LONG"    },
  rest:    { dot: "#cbd5e1", label: "REST"     },
  tt:      { dot: "#f97316", label: "TT"       },
};

const phaseColors = {
  "Base":           "#0d9488",
  "Build":          "#2563eb",
  "Peak Base":      "#4f46e5",
  "Transition":     "#7c3aed",
  "VO2max Build":   "#c026d3",
  "Race Specific":  "#e11d48",
  "Sharpening":     "#ea580c",
  "Taper":          "#d97706",
  "Race Week Prep": "#dc2626",
  "Race Week":      "#991b1b",
  "Break":          "#64748b",
};

const targetProgression = [
  {label:"Now",  time:"24:44",sec:1484,actual:true},
  {label:"May",  time:"23:42",sec:1422,actual:true},
  {label:"Jun",  time:"23:00",sec:1380},
  {label:"Jul",  time:"22:30",sec:1350},
  {label:"Aug",  time:"21:30",sec:1290},
  {label:"Sep",  time:"20:45",sec:1245},
  {label:"Oct",  time:"20:15",sec:1215},
  {label:"GOAL", time:"19:59",sec:1199},
];

const ZonePill = ({zone}) => {
  if (!zone) return null;
  const z = ZONES[zone];
  if (!z) return null;
  return (
    <span style={{fontSize:"0.61rem",padding:"0.1rem 0.45rem",borderRadius:3,
      background:z.bg,color:z.color,border:`1px solid ${z.border}`,
      fontFamily:"monospace",whiteSpace:"nowrap",fontWeight:600}}>
      {z.label}
    </span>
  );
};

const PLAN_START = new Date(2026, 3, 13);

function getCurrentWeek() {
  const today = new Date();
  const elapsed = Math.floor((today - PLAN_START) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(Math.max(elapsed + 1, 1), weeks.length);
}


function WeeklyReview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState(0);

  useEffect(() => {
    fetch("./review.json")
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => setData(d))
      .catch(() => setError(true));
  }, []);

  if (error) return (
    <div style={{maxWidth:820,margin:"3rem auto",padding:"2rem 1rem",textAlign:"center"}}>
      <div style={{color:"#374151",fontFamily:"monospace",fontSize:"0.88rem",marginBottom:"0.5rem"}}>
        No review data available.
      </div>
      <div style={{color:"#64748b",fontSize:"0.74rem"}}>
        Run <code style={{background:"#f1f5f9",padding:"0.1rem 0.4rem",borderRadius:3}}>
          python weekly_review.py
        </code> on the homeserver to generate it.
      </div>
    </div>
  );

  if (!data) return (
    <div style={{textAlign:"center",padding:"3rem",color:"#94a3b8",fontFamily:"monospace",fontSize:"0.75rem"}}>
      Loading…
    </div>
  );

  const ZONE_ORDER = ["Z1","Z2","Z3","Z4","Z5","Z5p"];
  const ZCOL = {Z1:"#94a3b8",Z2:"#10b981",Z3:"#3b82f6",Z4:"#d97706",Z5:"#ea580c",Z5p:"#e11d48"};
  const summary = data.summary_4wk;
  const maxZ = Math.max(...ZONE_ORDER.map(z => summary.zones[z]||0), 1);

  return (
    <div style={{maxWidth:820,margin:"0 auto",padding:"1.25rem 1rem"}}>

      {/* Meta row */}
      <div style={{display:"flex",gap:"1.5rem",flexWrap:"wrap",marginBottom:"1rem",
        background:"white",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"0.85rem 1rem"}}>
        <div>
          <div style={{fontFamily:"monospace",fontSize:"0.59rem",color:"#94a3b8",letterSpacing:"0.1em"}}>GENERATED</div>
          <div style={{fontFamily:"monospace",fontSize:"0.82rem",color:"#0f172a",fontWeight:700}}>{data.generated}</div>
        </div>
        <div>
          <div style={{fontFamily:"monospace",fontSize:"0.59rem",color:"#94a3b8",letterSpacing:"0.1em"}}>PLAN WEEK</div>
          <div style={{fontFamily:"monospace",fontSize:"0.82rem",color:"#0f172a",fontWeight:700}}>{data.plan_week} / 32</div>
        </div>
        <div>
          <div style={{fontFamily:"monospace",fontSize:"0.59rem",color:"#94a3b8",letterSpacing:"0.1em"}}>4-WEEK SPLIT</div>
          <div style={{fontFamily:"monospace",fontSize:"0.78rem"}}>
            <span style={{color:"#10b981"}}>Easy {summary.easy_pct}%</span>
            <span style={{color:"#94a3b8"}}> · </span>
            <span style={{color:"#3b82f6"}}>Gray {summary.gray_pct}%</span>
            <span style={{color:"#94a3b8"}}> · </span>
            <span style={{color:"#ea580c"}}>Quality {summary.quality_pct}%</span>
          </div>
        </div>
      </div>

      {/* Zone distribution bars */}
      <div style={{background:"white",border:"1.5px solid #e2e8f0",borderRadius:8,
        padding:"0.85rem 1rem",marginBottom:"1rem"}}>
        <div style={{fontFamily:"monospace",fontSize:"0.59rem",color:"#64748b",
          letterSpacing:"0.12em",marginBottom:"0.6rem"}}>
          4-WEEK ZONE DISTRIBUTION · BY AVG HR PER RUN
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"0.3rem"}}>
          {ZONE_ORDER.map(z => {
            const n = summary.zones[z]||0;
            const col = ZCOL[z];
            const lbl = z==="Z5p" ? "Z5+" : z;
            return (
              <div key={z} style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                <div style={{width:28,fontFamily:"monospace",fontSize:"0.62rem",
                  color:col,fontWeight:700,flexShrink:0}}>{lbl}</div>
                <div style={{flex:1,background:"#f1f5f9",borderRadius:3,height:14,overflow:"hidden"}}>
                  <div style={{width:`${(n/maxZ)*100}%`,height:"100%",background:col,
                    borderRadius:3,minWidth:n>0?4:0}}/>
                </div>
                <div style={{width:22,fontFamily:"monospace",fontSize:"0.62rem",
                  color:"#64748b",textAlign:"right",flexShrink:0}}>{n}</div>
              </div>
            );
          })}
        </div>
        <div style={{marginTop:"0.6rem",fontSize:"0.59rem",color:"#94a3b8",fontFamily:"monospace"}}>
          Target: ~80% Z1+Z2 · &lt;10% Z3 · ~20% Z4+
        </div>
      </div>

      {/* Week cards */}
      <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
        {data.weeks.map((w,wi) => {
          const isOpen = expandedWeek===wi;
          return (
            <div key={w.week_start} style={{
              border:w.is_current?"2px solid #0ea5e9":"1.5px solid #e2e8f0",
              borderRadius:8,background:w.is_current?"#f0f9ff":"white",overflow:"hidden",
              boxShadow:isOpen?"0 4px 16px rgba(0,0,0,0.08)":"0 1px 2px rgba(0,0,0,0.04)",
            }}>
              <button onClick={()=>setExpandedWeek(isOpen?null:wi)}
                style={{width:"100%",background:"none",border:"none",cursor:"pointer",
                  textAlign:"left",padding:"0.75rem 1rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.6rem",flexWrap:"wrap"}}>
                  <div style={{minWidth:34,height:34,borderRadius:"50%",flexShrink:0,
                    background:"#0f172a",color:"white",display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:"0.65rem",fontFamily:"monospace",fontWeight:700}}>
                    W{w.plan_week}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"}}>
                      <span style={{fontSize:"0.82rem",fontWeight:600,color:"#0f172a",
                        fontFamily:"monospace"}}>{w.week_start} – {w.week_end}</span>
                      {w.is_current&&<span style={{fontSize:"0.61rem",background:"#0ea5e9",
                        color:"white",padding:"0.1rem 0.45rem",borderRadius:3,
                        fontFamily:"monospace",fontWeight:700}}>NOW</span>}
                      <span style={{fontSize:"0.61rem",color:"#64748b",fontFamily:"monospace"}}>
                        {w.run_count} runs · {w.quality_count} quality · long {w.long_run_miles}mi
                      </span>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexShrink:0}}>
                    <span style={{fontFamily:"monospace",fontSize:"0.82rem",
                      color:"#374151",fontWeight:700}}>
                      {w.total_miles}
                      <span style={{color:"#94a3b8",fontSize:"0.65rem",fontWeight:400}}> mi</span>
                    </span>
                    <div style={{display:"flex",gap:3}}>
                      {w.sessions.map((s,i)=>(
                        <div key={i} style={{width:7,height:7,borderRadius:"50%",
                          background:ZCOL[s.zone==="Z5+"?"Z5p":s.zone]||"#cbd5e1"}}/>
                      ))}
                    </div>
                    <span style={{color:"#94a3b8",fontSize:"0.9rem"}}>{isOpen?"▴":"▾"}</span>
                  </div>
                </div>
              </button>

              {isOpen&&(
                <div style={{borderTop:"1px solid #f1f5f9",padding:"0.85rem 1rem"}}>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.3rem"}}>
                    {w.sessions.map((s,si)=>{
                      const zKey = s.zone==="Z5+" ? "Z5p" : s.zone;
                      const zInfo = ZONES[zKey];
                      return (
                        <div key={si} style={{
                          display:"flex",gap:"0.6rem",alignItems:"flex-start",
                          background:zInfo?zInfo.bg:"#f8fafc",
                          border:`1px solid ${zInfo?zInfo.border:"#e2e8f0"}`,
                          borderRadius:6,padding:"0.5rem 0.6rem",
                        }}>
                          <div style={{width:30,flexShrink:0,fontFamily:"monospace",
                            fontSize:"0.62rem",fontWeight:700,color:"#94a3b8",paddingTop:2}}>
                            {s.weekday}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:"0.4rem",
                              flexWrap:"wrap",marginBottom:"0.15rem"}}>
                              <span style={{fontSize:"0.78rem",fontWeight:600,
                                color:zInfo?zInfo.color:"#374151"}}>{s.name||"Run"}</span>
                              <span style={{fontSize:"0.61rem",fontFamily:"monospace",
                                color:"#64748b",background:"#f1f5f9",
                                padding:"0.1rem 0.4rem",borderRadius:3}}>{s.miles}mi</span>
                              <ZonePill zone={zKey}/>
                            </div>
                            <div style={{fontSize:"0.68rem",color:"#64748b",fontFamily:"monospace"}}>
                              {s.time} · {s.pace}/mi
                              {s.avg_hr ? ` · HR ${s.avg_hr} avg / ${s.max_hr} max` : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{textAlign:"center",color:"#94a3b8",fontSize:"0.61rem",fontFamily:"monospace",
        marginTop:"1rem",letterSpacing:"0.1em"}}>
        RUN weekly_review.py TO REFRESH · PASTE OUTPUT INTO CLAUDE CODE FOR NEXT WEEK'S PLAN
      </div>
    </div>
  );
}


function NextWeek() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetch("./next_week.json")
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => { setData(d); setExpanded(null); })
      .catch(() => setError(true));
  }, []);

  if (error) return (
    <div style={{maxWidth:820,margin:"3rem auto",padding:"2rem 1rem",textAlign:"center"}}>
      <div style={{color:"#374151",fontFamily:"monospace",fontSize:"0.88rem",marginBottom:"0.5rem"}}>
        No next-week plan yet.
      </div>
      <div style={{color:"#64748b",fontSize:"0.74rem"}}>
        Ask Claude Code: "Generate next week's plan" to create it.
      </div>
    </div>
  );
  if (!data) return (
    <div style={{textAlign:"center",padding:"3rem",color:"#94a3b8",fontFamily:"monospace",fontSize:"0.75rem"}}>
      Loading…
    </div>
  );

  const typeStyles2 = {
    easy:    { dot:"#10b981" },
    quality: { dot:"#60a5fa" },
    long:    { dot:"#a78bfa" },
    rest:    { dot:"#cbd5e1" },
  };

  return (
    <div style={{maxWidth:820,margin:"0 auto",padding:"1.25rem 1rem"}}>

      {/* Header card */}
      <div style={{background:"white",border:"1.5px solid #e2e8f0",borderRadius:8,
        padding:"0.85rem 1rem",marginBottom:"1rem"}}>
        <div style={{display:"flex",gap:"1.5rem",flexWrap:"wrap",marginBottom:"0.6rem"}}>
          <div>
            <div style={{fontFamily:"monospace",fontSize:"0.59rem",color:"#94a3b8",letterSpacing:"0.1em"}}>WEEK</div>
            <div style={{fontFamily:"monospace",fontSize:"0.82rem",color:"#0f172a",fontWeight:700}}>
              {data.dates} · Plan Wk {data.plan_week}
            </div>
          </div>
          <div>
            <div style={{fontFamily:"monospace",fontSize:"0.59rem",color:"#94a3b8",letterSpacing:"0.1em"}}>PHASE</div>
            <div style={{fontFamily:"monospace",fontSize:"0.82rem",color:"#2563eb",fontWeight:700}}>{data.phase}</div>
          </div>
          <div>
            <div style={{fontFamily:"monospace",fontSize:"0.59rem",color:"#94a3b8",letterSpacing:"0.1em"}}>TARGET</div>
            <div style={{fontFamily:"monospace",fontSize:"0.82rem",color:"#0f172a",fontWeight:700}}>{data.total_miles} mi</div>
          </div>
          <div>
            <div style={{fontFamily:"monospace",fontSize:"0.59rem",color:"#94a3b8",letterSpacing:"0.1em"}}>GENERATED</div>
            <div style={{fontFamily:"monospace",fontSize:"0.82rem",color:"#64748b"}}>{data.generated}</div>
          </div>
        </div>
        {/* dot strip */}
        <div style={{display:"flex",gap:4,marginBottom:"0.65rem"}}>
          {data.sessions.map((s,i) => (
            <div key={i} style={{width:9,height:9,borderRadius:"50%",
              background:typeStyles2[s.type]?.dot||"#cbd5e1"}}/>
          ))}
        </div>
        <div style={{background:"#f0f9ff",borderLeft:"3px solid #38bdf8",
          padding:"0.5rem 0.75rem",borderRadius:"0 4px 4px 0"}}>
          <div style={{fontSize:"0.59rem",color:"#0284c7",fontFamily:"monospace",
            letterSpacing:"0.1em",marginBottom:"0.2rem"}}>CONTEXT</div>
          <div style={{fontSize:"0.73rem",color:"#374151",lineHeight:1.6}}>{data.context}</div>
        </div>
      </div>

      {/* Session rows */}
      <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
        {data.sessions.map((s,i) => {
          const z = s.zone ? ZONES[s.zone] : null;
          const isOpen = expanded === i;
          return (
            <div key={i} style={{
              border:`1px solid ${z?z.border:"#e2e8f0"}`,
              borderRadius:7,background:z?z.bg:"#f8fafc",overflow:"hidden",
            }}>
              <button onClick={() => setExpanded(isOpen ? null : i)}
                style={{width:"100%",background:"none",border:"none",cursor:"pointer",
                  textAlign:"left",padding:"0.6rem 0.75rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
                  <div style={{width:34,fontFamily:"monospace",fontSize:"0.66rem",
                    fontWeight:700,color:"#94a3b8",flexShrink:0}}>{s.day}</div>
                  <div style={{flex:1}}>
                    <span style={{fontSize:"0.8rem",fontWeight:600,
                      color:z?z.color:"#374151"}}>{s.label}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexShrink:0}}>
                    {s.miles > 0 && (
                      <span style={{fontFamily:"monospace",fontSize:"0.75rem",
                        color:"#374151",fontWeight:700}}>
                        {s.miles}<span style={{color:"#94a3b8",fontSize:"0.62rem",
                          fontWeight:400}}> mi</span>
                      </span>
                    )}
                    <ZonePill zone={s.zone}/>
                    <span style={{color:"#94a3b8",fontSize:"0.85rem"}}>{isOpen?"▴":"▾"}</span>
                  </div>
                </div>
              </button>
              {isOpen && (
                <div style={{borderTop:`1px solid ${z?z.border:"#e2e8f0"}`,
                  padding:"0.5rem 0.75rem 0.65rem 0.75rem"}}>
                  <div style={{fontSize:"0.72rem",color:"#374151",lineHeight:1.6}}>{s.detail}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Coach note */}
      <div style={{marginTop:"0.75rem",background:"#f0f9ff",borderLeft:"3px solid #38bdf8",
        padding:"0.5rem 0.75rem",borderRadius:"0 4px 4px 0"}}>
        <div style={{fontSize:"0.59rem",color:"#0284c7",fontFamily:"monospace",
          letterSpacing:"0.1em",marginBottom:"0.2rem"}}>COACH NOTE</div>
        <div style={{fontSize:"0.73rem",color:"#374151",lineHeight:1.6}}>{data.notes}</div>
      </div>

      <div style={{textAlign:"center",color:"#94a3b8",fontSize:"0.61rem",fontFamily:"monospace",
        marginTop:"1rem",letterSpacing:"0.1em"}}>
        ASK CLAUDE CODE "GENERATE NEXT WEEK'S PLAN" TO REFRESH
      </div>
    </div>
  );
}

export default function TrainingPlan() {
  const [view, setView] = useState("plan");
  const [activeBlock, setActiveBlock] = useState("all");
  const [expandedWeek, setExpandedWeek] = useState(getCurrentWeek);
  const currentWeek = getCurrentWeek();
  const currentWeekRef = useRef(null);
  useEffect(() => {
    currentWeekRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  const filtered = weeks.filter(w => activeBlock==="all"?true:activeBlock==="1"?w.block===1:w.block===2);
  const isTTWeek = w => w.sessions.some(s=>s.type==="tt");
  const maxSec=1484,minSec=1199,range=maxSec-minSec;

  return (
    <div style={{fontFamily:"'Georgia',serif",background:"#fafaf8",minHeight:"100vh"}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%)",padding:"2.5rem 1.5rem 2rem",borderBottom:"3px solid #f43f5e"}}>
        <div style={{maxWidth:820,margin:"0 auto"}}>
          <div style={{color:"#f43f5e",fontSize:"0.64rem",letterSpacing:"0.25em",fontFamily:"monospace",marginBottom:"0.4rem"}}>
            32-WEEK TRAINING PLAN · APR – NOV 2026
          </div>
          <h1 style={{color:"#f8fafc",fontSize:"clamp(1.5rem,5vw,2.2rem)",fontWeight:400,margin:0,lineHeight:1.15}}>
            Sub-20 Minute 5K
          </h1>
          <div style={{color:"#94a3b8",fontSize:"0.78rem",marginTop:"0.3rem",fontFamily:"monospace"}}>
            Max HR 195 bpm · Rest HR 63 bpm · Karvonen Zones · Norwegian Singles
          </div>

          {/* Zone chips */}
          <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap",marginTop:"1rem"}}>
            {Object.entries(ZONES).map(([k,z])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:"0.3rem",
                background:z.bg,border:`1px solid ${z.border}`,borderRadius:4,padding:"0.2rem 0.5rem"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:z.color}}/>
                <span style={{fontSize:"0.59rem",fontFamily:"monospace",color:z.color,whiteSpace:"nowrap"}}>
                  {z.label} <span style={{opacity:0.75}}>{z.range}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Progression bars */}
          <div style={{marginTop:"1.25rem"}}>
            <div style={{color:"#475569",fontSize:"0.61rem",fontFamily:"monospace",letterSpacing:"0.12em",marginBottom:"0.4rem"}}>TIME TRIAL PROGRESSION</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:"0.25rem",flexWrap:"wrap"}}>
              {targetProgression.map((t,i)=>{
                const isGoal=i===targetProgression.length-1;
                const pct=(maxSec-t.sec)/range;
                const h=16+pct*44;
                const col=`hsl(${220-pct*180},80%,${65-pct*20}%)`;
                return (
                  <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.25rem"}}>
                    <div style={{fontSize:"0.54rem",color:col,fontFamily:"monospace",whiteSpace:"nowrap",fontWeight:isGoal||t.actual?700:400}}>
                      {t.actual&&"✓ "}{t.time}
                    </div>
                    <div style={{width:26,height:h,background:t.actual?col:"transparent",border:`2px solid ${col}`,borderRadius:"3px 3px 0 0",boxSizing:"border-box"}}/>
                    <div style={{fontSize:"0.49rem",color:"#64748b",fontFamily:"monospace",transform:"rotate(-30deg) translateX(-2px)",whiteSpace:"nowrap",transformOrigin:"top center",marginTop:3,fontWeight:isGoal||t.actual?700:400}}>{t.label}</div>
                  </div>
                );
              })}
            </div>
            <div style={{fontSize:"0.55rem",color:"#94a3b8",fontFamily:"monospace",marginTop:"0.5rem"}}>Filled = achieved · Outlined = target</div>
          </div>

          {/* View tabs */}
          <div style={{display:"flex",marginTop:"1rem",borderTop:"1px solid #1e293b",paddingTop:"0.5rem",marginBottom:"-0.5rem"}}>
            {[["plan","Training Plan"],["review","Weekly Review"],["next","Next Week"]].map(([val,label])=>(
              <button key={val} onClick={()=>setView(val)} style={{
                padding:"0.4rem 1.1rem",background:"none",border:"none",cursor:"pointer",
                fontFamily:"monospace",fontSize:"0.71rem",letterSpacing:"0.04em",
                color:view===val?"#f8fafc":"#475569",
                borderBottom:view===val?"2px solid #f43f5e":"2px solid transparent",
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {view==="next" ? <NextWeek/> : view==="review" ? <WeeklyReview/> : (
      <div style={{maxWidth:820,margin:"0 auto",padding:"1.25rem 1rem"}}>
        {/* Block filter */}
        <div style={{display:"flex",gap:"0.4rem",marginBottom:"1rem",flexWrap:"wrap"}}>
          {[["all","All 32 Weeks"],["1","Block 1: Base & Threshold"],["2","Block 2: Race Specific + Taper"]].map(([val,label])=>(
            <button key={val} onClick={()=>setActiveBlock(val)} style={{
              padding:"0.35rem 0.9rem",borderRadius:4,border:"1.5px solid",
              borderColor:activeBlock===val?"#0f172a":"#d1d5db",
              background:activeBlock===val?"#0f172a":"white",
              color:activeBlock===val?"white":"#374151",
              fontSize:"0.72rem",cursor:"pointer",fontFamily:"monospace",letterSpacing:"0.04em",
            }}>{label}</button>
          ))}
        </div>

        {/* Week cards */}
        <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
          {filtered.map(w=>{
            const isOpen=expandedWeek===w.week;
            const isCurrent=w.week===currentWeek;
            const isTT=isTTWeek(w);
            const isGoal=w.week===32;
            const phaseCol=phaseColors[w.phase]||"#64748b";
            return (
              <div key={w.week} ref={isCurrent?currentWeekRef:null} style={{
                border:isGoal?"2px solid #f43f5e":isCurrent?"2px solid #0ea5e9":isTT?"1.5px solid #f97316":"1.5px solid #e2e8f0",
                borderRadius:8,background:isGoal?"#fff5f5":isCurrent?"#f0f9ff":"white",overflow:"hidden",
                boxShadow:isOpen?"0 4px 16px rgba(0,0,0,0.08)":"0 1px 2px rgba(0,0,0,0.04)",
              }}>
                <button onClick={()=>setExpandedWeek(isOpen?null:w.week)}
                  style={{width:"100%",background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:"0.75rem 1rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.6rem",flexWrap:"wrap"}}>
                    <div style={{
                      minWidth:34,height:34,borderRadius:"50%",flexShrink:0,
                      background:isGoal?"#f43f5e":isTT?"#f97316":w.block===1?"#0f172a":"#1e40af",
                      color:"white",display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:"0.72rem",fontFamily:"monospace",fontWeight:700,
                    }}>{isGoal?"🎯":`W${w.week}`}</div>

                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"}}>
                        <span style={{fontSize:"0.82rem",fontWeight:600,color:"#0f172a",fontFamily:"monospace"}}>{w.dates}</span>
                        <span style={{fontSize:"0.61rem",padding:"0.1rem 0.45rem",borderRadius:3,
                          background:phaseCol+"18",color:phaseCol,border:`1px solid ${phaseCol}40`,fontFamily:"monospace"}}>{w.phase}</span>
                        {isCurrent&&(
                          <span style={{fontSize:"0.61rem",background:"#0ea5e9",color:"white",
                            padding:"0.1rem 0.45rem",borderRadius:3,fontFamily:"monospace",fontWeight:700}}>
                            NOW
                          </span>
                        )}
                        {isTT&&!isGoal&&(
                          <span style={{fontSize:"0.61rem",background:"#fff7ed",color:"#c2410c",
                            border:"1px solid #fed7aa",padding:"0.1rem 0.45rem",borderRadius:3,fontFamily:"monospace"}}>
                            🏁{w.target5k?` Target ${w.target5k}`:" TT"}
                          </span>
                        )}
                        {isGoal&&(
                          <span style={{fontSize:"0.61rem",background:"#fff1f2",color:"#be123c",
                            border:"1px solid #fecdd3",padding:"0.1rem 0.45rem",borderRadius:3,fontFamily:"monospace",fontWeight:700}}>
                            🎯 GOAL · 19:59
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{display:"flex",alignItems:"center",gap:"0.6rem",flexShrink:0}}>
                      <span style={{fontFamily:"monospace",fontSize:"0.82rem",color:"#374151",fontWeight:700}}>
                        {w.sessions.reduce((sum,s)=>sum+(s.miles||0),0)}<span style={{color:"#94a3b8",fontSize:"0.65rem",fontWeight:400}}> mi</span>
                      </span>
                      <div style={{display:"flex",gap:3}}>
                        {w.sessions.map((s,i)=>(
                          <div key={i} style={{width:7,height:7,borderRadius:"50%",background:typeStyles[s.type]?.dot||"#cbd5e1"}}/>
                        ))}
                      </div>
                      <span style={{color:"#94a3b8",fontSize:"0.9rem"}}>{isOpen?"▴":"▾"}</span>
                    </div>
                  </div>
                </button>

                {isOpen&&(
                  <div style={{borderTop:"1px solid #f1f5f9",padding:"0.85rem 1rem"}}>
                    <div style={{display:"flex",flexDirection:"column",gap:"0.3rem",marginBottom:"0.75rem"}}>
                      {w.sessions.map((s,i)=>{
                        const z=s.zone?ZONES[s.zone]:null;
                        return (
                          <div key={i} style={{
                            display:"flex",gap:"0.6rem",alignItems:"flex-start",
                            background:z?z.bg:"#f8fafc",
                            border:`1px solid ${z?z.border:"#e2e8f0"}`,
                            borderRadius:6,padding:"0.5rem 0.6rem",
                          }}>
                            <div style={{width:26,flexShrink:0,fontFamily:"monospace",fontSize:"0.62rem",fontWeight:700,color:"#94a3b8",paddingTop:2}}>{s.day}</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap",marginBottom:"0.2rem"}}>
                                <span style={{fontSize:"0.78rem",fontWeight:600,color:z?z.color:"#374151"}}>{s.label}</span>
                                {s.miles>0&&!/\d+mi/.test(s.label)&&(
                                  <span style={{fontSize:"0.61rem",fontFamily:"monospace",color:"#64748b",background:"#f1f5f9",padding:"0.1rem 0.4rem",borderRadius:3}}>{s.miles}mi</span>
                                )}
                                <ZonePill zone={s.zone}/>
                              </div>
                              <div style={{fontSize:"0.7rem",color:"#475569",lineHeight:1.55}}>{s.detail}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{background:"#f0f9ff",borderLeft:"3px solid #38bdf8",padding:"0.5rem 0.75rem",borderRadius:"0 4px 4px 0"}}>
                      <div style={{fontSize:"0.59rem",color:"#0284c7",fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:"0.2rem"}}>COACH NOTE</div>
                      <div style={{fontSize:"0.73rem",color:"#374151",lineHeight:1.6}}>{w.notes}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* HR Zone reference card */}
        <div style={{marginTop:"1.25rem",padding:"1rem",background:"#0f172a",borderRadius:8}}>
          <div style={{fontSize:"0.61rem",fontFamily:"monospace",color:"#475569",letterSpacing:"0.15em",marginBottom:"0.75rem"}}>HEART RATE ZONES · MAX HR 195 · RESTING HR 63 · KARVONEN METHOD</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(128px,1fr))",gap:"0.5rem"}}>
            {Object.entries(ZONES).map(([k,z])=>(
              <div key={k} style={{background:z.bg,border:`1px solid ${z.border}`,borderRadius:6,padding:"0.5rem 0.6rem"}}>
                <div style={{fontSize:"0.7rem",fontFamily:"monospace",fontWeight:700,color:z.color}}>{z.label}</div>
                <div style={{fontSize:"0.64rem",fontFamily:"monospace",color:z.color,opacity:0.85}}>{z.range}</div>
                <div style={{fontSize:"0.59rem",color:"#64748b",marginTop:"0.25rem"}}>{z.use}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{textAlign:"center",color:"#94a3b8",fontSize:"0.61rem",fontFamily:"monospace",marginTop:"1rem",letterSpacing:"0.1em"}}>
          CLICK ANY WEEK TO EXPAND · THE ZONE IS THE TARGET, NOT THE CLOCK · SLEEP IS TRAINING
        </div>
      </div>
      )}
    </div>
  );
}
