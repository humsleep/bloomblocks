# Revenue model on top of sim_b.py output. Research only; every input is an assumption (see monetization-check.md).
import json, math
D = "/private/tmp/claude-501/-Users-hyukahn-workspace/09fd3b28-b1a9-4b08-ae1d-84cbf5fced38/scratchpad/"
SEGW = {"daily_only": 0.45, "light": 0.35, "heavy": 0.20}
KRW = 1400

def load(name):
    r = json.load(open(D + name))
    days = len(r["daily_only"][0])
    i = [sum(SEGW[s] * r[s][0][a] for s in SEGW) for a in range(days)]
    w = [sum(SEGW[s] * r[s][1][a] for s in SEGW) for a in range(days)]
    return i, w
IMP = {"base": load("imp_base.json"), "low": load("imp_behaviour0.6.json"), "high": load("imp_behaviour1.4.json")}
imp = lambda k, a: (IMP[k][0][min(a, 119)], IMP[k][1][min(a, 119)])

# interstitial eCPM USD, this app (AdMob only, new, small, HE ads off, raw ATT prompt) low/base/high
ECPM = {"US": (4.5, 7, 10.5), "UK": (3, 4.5, 7), "CA": (3, 4.5, 7), "AU": (3, 5, 8), "IE": (2, 3, 5),
        "DE": (2, 3.5, 6), "JP": (2.5, 4.5, 7), "KR": (2, 3.5, 6), "EU_other": (1.5, 2.5, 4), "ROW": (0.5, 1, 2)}
MIX = {"US": 35, "UK": 7, "CA": 5, "AU": 4, "IE": 0.5, "DE": 5, "JP": 6, "KR": 5, "EU_other": 14, "ROW": 18.5}
assert abs(sum(MIX.values()) - 100) < 1e-9
RW_MULT = 1.3
def blend(k, mix=MIX):
    tot = sum(mix.values())
    return sum(mix[c] * ECPM[c][k] for c in mix) / tot

def ret(d, d1, d7, d30):
    if d == 0: return 1.0
    if d <= 7: b = math.log(d1 / d7) / math.log(7); return d1 * d ** -b
    b = math.log(d7 / d30) / math.log(30 / 7); return d7 * (d / 7) ** -b

def series(installs, rt):
    """installs: list per calendar day; returns DAU and impressions per day (age-weighted)."""
    T = len(installs); dau = [0.0] * T; ints = {k: [0.0] * T for k in IMP}; rws = {k: [0.0] * T for k in IMP}
    R = [ret(a, *rt) for a in range(T)]
    for t in range(T):
        for c in range(t + 1):
            n = installs[c] * R[t - c]
            if n == 0: continue
            dau[t] += n
            for k in IMP:
                i, w = imp(k, t - c); ints[k][t] += n * i; rws[k][t] += n * w
    return dau, ints, rws

def money(ints, rws, t0, t1, beh="base", ek=1):
    e = blend(ek)
    return sum(ints[beh][t] * e / 1000 + rws[beh][t] * e * RW_MULT / 1000 for t in range(t0, t1))

T = 365
SC = {
    "비관 (ASO만)": ([150 / 7] * 7 + [3] * (T - 7), (0.25, 0.08, 0.03), 0),
    "기준 (숏폼 일부)": ([1500 / 7] * 7 + [12] * (T - 7), (0.30, 0.11, 0.045), 1),
    "낙관 (피처링)": ([2000 / 7] * 7 + [12] * 7 + [15000 / 7] * 7 + [40] * (T - 21), (0.35, 0.14, 0.06), 1),
}
if __name__ == "__main__":
    print("blended interstitial eCPM low/base/high:", [round(blend(k), 2) for k in range(3)])
    noeu = {c: v for c, v in MIX.items() if c not in ("IE", "DE", "EU_other")}
    print("blended without EU:", [round(blend(k, noeu), 2) for k in range(3)])
    for name, (ins, rt, ek) in SC.items():
        dau, ints, rws = series(ins, rt)
        L = sum(ret(a, *rt) for a in range(365))
        w8 = dau[55]; m12 = dau[364]
        def mo(t0, t1, beh="base", e=ek): return money(ints, rws, t0, t1, beh, e)
        m2 = mo(30, 60); m12r = mo(335, 365)
        lo = money(ints, rws, 335, 365, "low", 0); hi = money(ints, rws, 335, 365, "high", 2)
        y1 = mo(0, 365)
        print(f"\n## {name}: rt={rt} L365={L:.1f} installs y1={sum(ins):.0f}")
        print(f" W8 DAU {w8:.0f}  M12 DAU {m12:.0f}  W8 int/day {ints['base'][55]:.0f}  M12 int/day {ints['base'][364]:.0f} rw/day {rws['base'][364]:.1f}")
        print(f" W8 int/DAU {ints['base'][55]/w8:.2f}")
        print(f" month2 rev ${m2:.1f} (₩{m2*KRW:,.0f})  month12 rev ${m12r:.1f} (₩{m12r*KRW:,.0f}) range ${lo:.1f}-{hi:.1f}  year1 ${y1:.0f} (₩{y1*KRW:,.0f})")
        print(f" days to first $100 payout:", next((t for t in range(T) if mo(0, t) >= 100), ">365"))
        print(" month1 rev", round(mo(0, 30), 1), "peak day DAU", round(max(dau)), "at", dau.index(max(dau)))
    # thresholds
    for k, lab in ((0, "low"), (1, "base"), (2, "high")):
        i, w = imp("base", 60); e = blend(k)
        arp = i * e / 1000 + w * e * RW_MULT / 1000
        print(f"\nARPDAU mature ({lab} eCPM {e:.2f}) = ${arp:.4f}; DAU for $100/mo {100/30/arp:.0f}, $1000/mo {1000/30/arp:.0f}; $99/yr {99/365/arp:.0f}")
    for beh in ("low", "high"):
        i, w = imp(beh, 60); e = blend(1); arp = i * e / 1000 + w * e * RW_MULT / 1000
        print(f"behaviour {beh}: ARPDAU ${arp:.4f}, DAU for $100 {100/30/arp:.0f}, $1000 {1000/30/arp:.0f}")
    for rt in ((0.25, 0.08, 0.03), (0.30, 0.11, 0.045), (0.35, 0.14, 0.06)):
        L = sum(ret(a, *rt) for a in range(365)); Linf = sum(ret(a, *rt) for a in range(3650))
        print(f"rt {rt}: L365 {L:.1f}, L10y {Linf:.1f}, steady DAU per 1 install/day ≈ {L:.1f}")
