"""
weekly_review.py — Pull last 4 weeks from Garmin, print summary, save review.json.

Usage:
  python weekly_review.py                          # print + save JSON to ./review.json
  python weekly_review.py --json /path/to/out.json # custom JSON output path

The JSON file is served by the training-plan app to power the Weekly Review tab.
Paste the printed output into Claude Code and say: "Give me next week's training plan."
"""

import json
import os
import sys
from collections import defaultdict
from datetime import date, timedelta

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
CREDS_FILE   = os.path.join(SCRIPT_DIR, 'garmin_creds.json')
SESSION_FILE = os.path.join(SCRIPT_DIR, 'garmin_session.json')
DEFAULT_JSON = os.path.join(SCRIPT_DIR, 'review.json')

MAX_HR = 195
RHR    = 63

PLAN_START = date(2026, 4, 13)


# ── Zones ─────────────────────────────────────────────────────────────────────

def hr_zone(hr):
    if not hr:
        return None
    hrr = MAX_HR - RHR
    pct = (hr - RHR) / hrr
    if pct < 0.50: return 'Z1'
    if pct < 0.65: return 'Z2'
    if pct < 0.75: return 'Z3'
    if pct < 0.87: return 'Z4'
    if pct < 0.95: return 'Z5'
    return 'Z5p'


def is_quality(hr):
    return hr_zone(hr) in ('Z4', 'Z5', 'Z5p')


def is_easy(hr):
    return hr_zone(hr) in ('Z1', 'Z2')


# ── Auth ──────────────────────────────────────────────────────────────────────

def get_api():
    from garminconnect import Garmin, GarminConnectAuthenticationError

    if not os.path.exists(CREDS_FILE):
        print(f'Missing {CREDS_FILE}')
        sys.exit(1)

    with open(CREDS_FILE) as f:
        creds = json.load(f)

    api = Garmin(email=creds['email'], password=creds['password'])

    if os.path.exists(SESSION_FILE):
        try:
            with open(SESSION_FILE) as f:
                api.login(tokenstore=f.read())
            return api
        except Exception:
            pass

    try:
        api.login()
    except GarminConnectAuthenticationError:
        mfa = input('Garmin MFA code: ').strip()
        api.login(mfa_code=mfa)

    try:
        with open(SESSION_FILE, 'w') as f:
            f.write(api.dump_session_tokens())
    except Exception:
        pass

    return api


# ── Fetch ─────────────────────────────────────────────────────────────────────

def fetch_recent_runs(api, days=35):
    cutoff = date.today() - timedelta(days=days)
    runs = []
    start = 0
    while True:
        batch = api.get_activities(start=start, limit=100)
        if not batch:
            break
        for a in batch:
            if a.get('activityType', {}).get('typeKey') != 'running':
                continue
            raw = (a.get('startTimeLocal') or '')[:10]
            if not raw:
                continue
            act_date = date.fromisoformat(raw)
            if act_date < cutoff:
                return runs
            runs.append(a)
        if len(batch) < 100:
            break
        start += len(batch)
    return runs


# ── Helpers ───────────────────────────────────────────────────────────────────

def pace_per_mile(speed_ms):
    if not speed_ms:
        return '?:??'
    secs = 1609.34 / speed_ms
    return f'{int(secs // 60)}:{int(secs % 60):02d}'


def fmt_duration(seconds):
    if not seconds:
        return ''
    h, m, s = int(seconds) // 3600, (int(seconds) % 3600) // 60, int(seconds) % 60
    return f'{h}:{m:02d}:{s:02d}' if h else f'{m}:{s:02d}'


def week_start(d):
    return d - timedelta(days=d.weekday())


def plan_week_num(d):
    return min(max((d - PLAN_START).days // 7 + 1, 1), 32)


WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']


# ── Build structured data ─────────────────────────────────────────────────────

def build_weeks(runs):
    by_week = defaultdict(list)
    for a in runs:
        d = date.fromisoformat((a.get('startTimeLocal') or '')[:10])
        by_week[week_start(d)].append(a)

    today = date.today()
    week_keys = sorted(by_week.keys(), reverse=True)[:4]
    result = []

    for wk in week_keys:
        w_runs = sorted(by_week[wk], key=lambda a: a.get('startTimeLocal', ''))
        zones = defaultdict(int)
        sessions = []

        for a in w_runs:
            dist_m  = a.get('distance', 0) or 0
            elapsed = a.get('elapsedDuration') or a.get('duration', 0)
            avg_hr  = a.get('averageHR')
            max_h   = a.get('maxHR')
            z       = hr_zone(avg_hr)
            if z:
                zones[z] += 1
            act_date = date.fromisoformat((a.get('startTimeLocal') or '')[:10])
            sessions.append({
                'date':    str(act_date),
                'weekday': WEEKDAYS[act_date.weekday()],
                'name':    a.get('activityName', ''),
                'miles':   round(dist_m / 1609.34, 2),
                'time':    fmt_duration(elapsed),
                'avg_hr':  int(avg_hr) if avg_hr else None,
                'max_hr':  int(max_h)  if max_h  else None,
                'pace':    pace_per_mile(a.get('averageSpeed')),
                'zone':    z or '?',
            })

        total_miles = sum(s['miles'] for s in sessions)
        total_secs  = sum(a.get('elapsedDuration') or a.get('duration', 0) for a in w_runs)

        result.append({
            'week_start':    str(wk),
            'week_end':      str(wk + timedelta(days=6)),
            'plan_week':     plan_week_num(wk),
            'is_current':    wk == week_start(today),
            'total_miles':   round(total_miles, 1),
            'total_time':    fmt_duration(total_secs),
            'run_count':     len(w_runs),
            'quality_count': sum(1 for a in w_runs if is_quality(a.get('averageHR'))),
            'easy_count':    sum(1 for a in w_runs if is_easy(a.get('averageHR'))),
            'long_run_miles': round(max((s['miles'] for s in sessions), default=0), 1),
            'zones':         dict(zones),
            'sessions':      sessions,
        })

    return result


def build_summary(weeks):
    all_zones = defaultdict(int)
    total_runs = 0
    for w in weeks:
        for z, n in w['zones'].items():
            all_zones[z] += n
            total_runs += n
    easy   = all_zones.get('Z1', 0) + all_zones.get('Z2', 0)
    gray   = all_zones.get('Z3', 0)
    hard   = all_zones.get('Z4', 0) + all_zones.get('Z5', 0) + all_zones.get('Z5p', 0)
    return {
        'total_runs': total_runs,
        'zones': dict(all_zones),
        'easy_pct':    round(100 * easy / max(total_runs, 1)),
        'gray_pct':    round(100 * gray / max(total_runs, 1)),
        'quality_pct': round(100 * hard / max(total_runs, 1)),
    }


# ── Print summary ─────────────────────────────────────────────────────────────

def print_summary(weeks, summary, plan_week):
    today = date.today()
    print('=' * 60)
    print(f'TRAINING REVIEW  —  {today}')
    print(f'Plan position: Week {plan_week} of 32')
    print(f'Zones: max HR {MAX_HR}, resting HR {RHR}, Karvonen')
    print('=' * 60)

    for w in weeks:
        label = '  ← CURRENT WEEK' if w['is_current'] else ''
        print(f'\n{w["week_start"]} – {w["week_end"]}  (plan wk {w["plan_week"]}){label}')
        print(f'  {w["run_count"]} runs  |  {w["total_miles"]} mi  |  {w["total_time"]}')
        print(f'  Long run: {w["long_run_miles"]} mi  |  Quality: {w["quality_count"]}  |  Easy: {w["easy_count"]}')
        zone_str = '  '.join(f'{z}:{n}' for z, n in sorted(w['zones'].items()) if n)
        print(f'  Zones: {zone_str or "no HR data"}')
        print('  Sessions:')
        for s in w['sessions']:
            hr_str = f'{s["avg_hr"]}/{s["max_hr"]}' if s['avg_hr'] and s['max_hr'] else (str(s['avg_hr']) if s['avg_hr'] else '?')
            print(f'    {s["date"]} {s["weekday"]}  {s["miles"]:4.1f}mi  {s["time"]:>7}  {s["pace"]}/mi  HR {hr_str:>9}  [{s["zone"]}]  {s["name"]}')

    print()
    print('=' * 60)
    print('4-WEEK ZONE SUMMARY')
    for z in ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z5p']:
        n = summary['zones'].get(z, 0)
        print(f'  {z:4s}  {"#" * n:<30} {n}')
    print(f'\n  Easy (Z1+Z2): {summary["easy_pct"]}%  |  Gray (Z3): {summary["gray_pct"]}%  |  Quality (Z4+): {summary["quality_pct"]}%')
    print(f'  Target: ~80% easy  <10% gray  ~20% quality')
    print('=' * 60)
    print('\nPaste this into Claude Code: "Give me next week\'s training plan."')


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    json_out = DEFAULT_JSON
    if '--json' in sys.argv:
        idx = sys.argv.index('--json')
        if idx + 1 < len(sys.argv):
            json_out = sys.argv[idx + 1]

    print('Connecting to Garmin Connect...')
    api = get_api()
    print('Pulling last 5 weeks of runs...')
    runs = fetch_recent_runs(api, days=35)

    if not runs:
        print('No runs found in the last 35 days.')
        return

    today = date.today()
    current_plan_week = plan_week_num(today)
    weeks   = build_weeks(runs)
    summary = build_summary(weeks)

    print_summary(weeks, summary, current_plan_week)

    payload = {
        'generated':  str(today),
        'plan_week':  current_plan_week,
        'max_hr':     MAX_HR,
        'rhr':        RHR,
        'weeks':      weeks,
        'summary_4wk': summary,
    }
    with open(json_out, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)
    print(f'\nJSON saved to {json_out}')


if __name__ == '__main__':
    main()
