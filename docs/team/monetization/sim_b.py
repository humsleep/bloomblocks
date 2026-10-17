# Monte Carlo of ads policy B (apps/client/src/ads/policy.ts, read 2026-10-18) — research only.
# Mirrors interstitialVerdict / recordUnit / recordInterstitial / break offer. Banner OFF (FLAGS.banner=false).
# Streak gift ignored (1 h / 7 days, and DECISIONS replaced it with Luna). Remote config: none wired.
import random, math, statistics as st

R = dict(grace=5, unitsBetween=2, playBetween=240, perSession=2, perSessionLong=3, longSession=600,
         perDay=10, resumeQuiet=120, afterFull=90, breakS=1800, breakAfterNth=2)
READY = 0.85        # preloaded x filled (ads-plan §8-1)
LAST_SLOT_P = 0.7   # last track unit of a session still reaches the between-boards slot
BREAK_TAKE = 0.10   # share taking the 30-min rewarded break when offered
AD_LEN = 15; FINALE = 10

SEG = {  # ads-plan §8-1 (sessions/day, track units/day, P(daily)) — LLM-persona based, PLACEHOLDER
    "daily_only": (1.15, 0.35, 0.95, 0.45),
    "light":      (1.5, 2.6, 0.85, 0.35),
    "heavy":      (2.2, 8.0, 0.80, 0.20),
}

def pois(lam, rng):
    L, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= L: return k
        k += 1

def unit_secs(rng, median):
    return median * math.exp(rng.gauss(0, 0.5))

def sim_user(seg, days, rng, scale=1.0):
    sess_m, units_m, p_daily, _ = SEG[seg]
    units_life = 0; units_since = 0; play_since = 0.0; last_full = -1e9; break_until = -1e9
    out = []
    for day in range(days):
        t0 = day * 86400
        day_int = 0; day_break_offered = False; day_rw = 0
        if day == 0:
            n_sess = 1 + (rng.random() < 0.35); n_units = 1 + pois(4.0 * scale, rng); daily = rng.random() < 0.6; med = 110
        else:
            n_sess = 1 + pois(max(sess_m - 1, 0), rng); n_units = pois(units_m * scale, rng); daily = rng.random() < p_daily; med = 170
        # spread units over sessions
        per = [0] * n_sess
        for _ in range(n_units): per[rng.randrange(n_sess)] += 1
        for si in range(n_sess):
            t = t0 + 8 * 3600 + si * 4 * 3600  # sessions >= 4 h apart -> new session each time
            ses_start = t; fg = t; ses_int = 0; last_daily = False
            if si == 0 and daily and day > 0 or (day == 0 and daily and si == n_sess - 1):
                t += unit_secs(rng, 200) + FINALE; last_daily = True  # daily: never an ad slot
            k = per[si]
            for j in range(k):
                d = unit_secs(rng, med); t += d
                units_life += 1; units_since += 1; play_since += d; last_daily = False
                if j == k - 1 and rng.random() > LAST_SLOT_P:
                    t += FINALE; continue
                # interstitialVerdict
                ok = (t >= break_until and units_life > R["grace"] and units_since >= R["unitsBetween"]
                      and play_since >= R["playBetween"] and t - fg >= R["resumeQuiet"] and t - last_full >= R["afterFull"])
                cap = R["perSessionLong"] if t - ses_start >= R["longSession"] else R["perSession"]
                ok = ok and ses_int < cap and day_int < R["perDay"]
                if ok and rng.random() < READY:
                    t += AD_LEN; units_since = 0; play_since = 0; day_int += 1; ses_int += 1; last_full = t
                    if day_int == R["breakAfterNth"] and not day_break_offered:
                        day_break_offered = True
                        if rng.random() < BREAK_TAKE:
                            t += 30; day_rw += 1; last_full = t; break_until = t + R["breakS"]
                t += FINALE
        out.append((day_int, day_rw, n_units, daily))
    return out

def run(N=4000, days=120, seed=7, scale=1.0):
    rng = random.Random(seed)
    res = {}
    for seg in SEG:
        acc_i = [0.0] * days; acc_r = [0.0] * days; acc_u = [0.0] * days
        for _ in range(N):
            for a, (i, r, u, _) in enumerate(sim_user(seg, days, rng, scale)):
                acc_i[a] += i; acc_r[a] += r; acc_u[a] += u
        res[seg] = ([x / N for x in acc_i], [x / N for x in acc_r], [x / N for x in acc_u])
    return res

def mix(res, a):
    i = sum(SEG[s][3] * res[s][0][a] for s in SEG); r = sum(SEG[s][3] * res[s][1][a] for s in SEG)
    return i, r

if __name__ == "__main__":
    for scale, label in ((1.0, "base"), (0.6, "behaviour x0.6"), (1.4, "behaviour x1.4")):
        res = run(scale=scale)
        print(f"== {label}")
        for a in (0, 1, 3, 7, 14, 30, 60, 119):
            i, r = mix(res, a)
            segs = " ".join(f"{s}={res[s][0][a]:.2f}" for s in SEG)
            print(f"age {a:3d}: int/DAU {i:.2f} rw/DAU {r:.3f} | {segs}")
        # sessions-level: interstitials per session (mature, age 60)
        i, _ = mix(res, 60)
        sess = sum(SEG[s][3] * SEG[s][0] for s in SEG)
        print(f"mature sessions/DAU {sess:.2f}, int/session {i/sess:.2f}")
        import json
        json.dump({s: res[s][:2] for s in SEG}, open(f"/private/tmp/claude-501/-Users-hyukahn-workspace/09fd3b28-b1a9-4b08-ae1d-84cbf5fced38/scratchpad/imp_{label.split()[0]}{'' if scale==1 else scale}.json", "w"))
