# Duskwick 배포 지역과 지역별 법적·Apple·AdMob 항목 (마지막 확인: 2026-10-18)

대상: 무료 iPhone 퍼즐 게임, AdMob 광고만(앱 내 구매 없음, 계정 없음, 사용자 생성 콘텐츠 없음), 개발자는 한국 거주 개인(ASC 계정 이름 안혁 / Hyuk Ahn, 기존 앱이 App Store에 있음), 번들 `com.humsleep.duskwick`.
앞선 문서: `docs/app-store-connect-pack.md` §8, `docs/app-review-preflight.md`. 이 문서는 두 문서의 §8 "배포 지역과 법적 항목"을 대체하는 상세판이다. 코드는 바꾸지 않았다.

이 문서는 법률 자문이 아니다. 법 해석이 필요한 칸에는 "[법률 확인]"을 달았다.

## 0. 읽는 법

확인 수준 표기
- **[A]** Apple·Google·국가 기관 페이지나 법령 원문을 직접 열어 읽었다.
- **[B]** 법률사무소·언론·업계 글 같은 2차 자료로만 확인했다. 방향은 믿되 날짜·숫자는 원문으로 다시 본다.
- **[C]** 확인하지 못했다. 추정이거나 "근거를 찾지 못했다"는 뜻이다.

"마지막 확인"은 따로 적지 않은 한 모두 2026-10-18이다. 출처 URL은 맨 아래 §9에 번호로 모았고, 본문에는 `(S3)`처럼 번호만 붙였다.

---

## 1. 한눈에 보기

### 1-1. 사용자가 정해야 할 결정 (자세한 내용은 해당 절)

| # | 결정 | 기본 권장 | 절 |
| --- | --- | --- | --- |
| D1 | EU DSA 판매자(trader) 상태: trader로 신고 / non-trader / EU 제외 | 먼저 **계정에 이미 신고한 상태**를 본다(기존 앱이 있어 이미 정했을 가능성이 높다). 중립 비교는 §5 | §5 |
| D2 | 브라질 포함 여부 | **출시 때 제외**(ECA Digital: 미성년자에게 광고용 프로파일링 금지, 우리는 나이를 모른다). 나중에 켜는 것은 무료 | §2-11, §3 |
| D3 | 인도네시아·베트남 포함 여부 | **출시 때 제외**(게임 등급·서류 요건이 불명확하고 Apple 쪽 절차를 못 찾았다) | §2-5, §2-6, §3 |
| D4 | 러시아·벨라루스 포함 여부 | **제외**(AdMob이 러시아 사용자에게 광고를 안 보낸다. 수익 0) | §2-8, §3 |
| D5 | 미국 주 "앱스토어 책임법"(텍사스 2026-06-04부터 효력)에 따른 개발자 연령 신호 구현 | 출시 전 **법률 확인**. 구현은 작은 네이티브 작업(Declared Age Range). 구현하지 않고 출시하면 위험을 떠안는다 | §2-12 |
| D6 | 한국 상품 페이지에 공개되는 연락 이메일(그리고 사업자등록번호가 있으면 그것) | Support URL·방침에 어차피 공개되는 같은 이메일 사용 | §4-3 |
| D7 | 한국어 개인정보처리방침 별도 게시 | **게시 권장**(§4-4 항목표) | §4-4 |
| D8 | AdMob 콘솔에서 "US states regulations" 메시지 게시 | **게시 권장**(코드 변경 없이 동작할 가능성이 높다) | §6 |

### 1-2. 가장 중요한 발견 세 가지

1. **한국 게임 등급은 Apple 연령 설문으로 충족된다.** Apple이 한국 게임물관리위원회(GRAC) 자체등급분류사업자로 설문 결과를 한국용 등급(전체/12/15/청소년이용불가)으로 바꿔 표시한다. 무료 인디 게임이 따로 등급번호(RCN)를 받을 필요는 없다. 단, 2026-08-12부터는 GRAC 공식 등급이 있을 때 RCN을 넣어 한국 등급을 덮어쓸 수 있고, GRAC 등급이 Apple 등급과 다르면 App Review가 연락한다. §4.
2. **DSA 상태는 계정 단위로 이미 정해졌을 수 있다.** EU에 앱이 하나라도 있으면 trader 여부를 이미 신고했다. 새 앱은 같은 상태를 따른다(앱별로 바꿀 수 있는 화면은 있다). 먼저 현재 상태를 본 뒤 결정한다. §5.
3. **한국 거주 개인 개발자의 이메일은 한국 App Store 상품 페이지에 공개된다**(전자상거래법에 따른 Apple의 신원 표시). 사업자등록번호(BRN)는 있을 때만. §4-3.

---

## 2. 지역별 요건

각 지역을 "이 앱(무료·광고만·오프라인·계정 없음)에 적용되는 것 / 사용자가 ASC에서 할 일 / AdMob·ATT·UMP" 순으로 적는다.

### 2-1. 대한민국 (필수 시장)

자세한 내용은 §4. 요약만 적는다.
- 적용: 게임산업진흥법의 등급분류. App Store는 Apple이 자체등급분류사업자로서 처리한다. Games(또는 Entertainment) 카테고리 앱은 설문 답에서 한국용 등급이 계산되어 별도로 표시된다. **[A]** (S1, S2)
- ASC 할 일: 연령 설문을 정직하게 답하면 끝이다. 저장 뒤 App Information → Age Ratings에서 **Republic of Korea 값이 "All"로 나오는지** 눈으로 본다. GRAC 등급이 따로 없으면 RCN은 비워 둔다.
- 사업자 정보 표시: ASC → **Business → Agreements → Compliance → Korean Law**. 개인 개발자는 이메일(+BRN이 있으면 BRN)이 한국 상품 페이지에 표시된다. **[A]** (S3)
- AdMob·ATT: 한국 전용 동의 메시지 유형은 AdMob에 없다. pack §4의 녹화(한국 IP)에서 GDPR 양식은 나오지 않았고 Google IDFA 설명(선택) → ATT 순서로 보였다. 개인정보보호법상 광고 식별자·행태정보는 방침 고지가 핵심이다(§4-4). **[B]**

### 2-2. 일본

- Apple: 일본 전용 등급·등록·서류 없음. 연령 등급 문서의 지역 절에 일본이 없다. **[A]** (S2)
- 법: 개인정보보호법(APPI)과 전기통신사업법의 **외부송신규율**(2023-06 시행, 광고 SDK 등으로 이용자 정보를 외부에 보낼 때 정보 내용·송신처·목적을 통지·공표). 규율 대상은 일정한 전기통신역무를 제공하는 사업자이고, 오프라인 퍼즐 앱과 개인 개발자가 해당하는지는 확인하지 못했다. **[B]/[C]** (S4) [법률 확인]
- ASC 할 일: 없음.
- 비용이 거의 없는 대응: 영어 방침의 광고 절에 이미 "보내는 정보 종류, 보내는 곳(Google), 목적"이 있다. 이것이 외부송신 고지의 요점과 같다.
- AdMob·ATT: 지역 전용 메시지 없음. ATT는 전 세계 공통.
- 권장: **켠다.**

### 2-3. 대만·홍콩

- 대만: 게임소프트웨어분급관리판법(遊戲軟體分級管理辦法)이 2012년에 앱 게임까지 범위를 넓혔고, 등급 표시 의무자는 제공자(다운로드 제공자 포함)다. 현재 App Store 앱에 어떻게 적용되는지는 최신 자료가 없다. Apple 연령 등급 문서에도 대만 지역 등급이 없다. **[B]/[C]** (S5, S2)
- 홍콩: 별도 요건을 찾지 못했다. **[C]**
- ASC 할 일: 없음.
- AdMob·ATT: 지역 전용 메시지 없음.
- 권장: **켠다.**

### 2-4. 중화인민공화국 본토

- Apple은 게임에 NPPA 판호(ISBN)를 요구하고, 모든 앱에 ICP 신고 번호를 요구한다. 서류 없이는 중국 본토 스토어에 나오지 않는다. 개인 해외 개발자가 얻을 수 없다. **[B]** (S6)
- ASC 할 일: **중국 본토를 배포 국가에서 뺀다**(§3 경로).
- AdMob: 중국 본토에서는 어차피 서빙 불확실. 의미 없다.
- 권장: **제외(필수).**

### 2-5. 베트남 (결정 D3)

- Apple은 베트남 지역 연령 등급을 따로 표시한다(근거: 정령 147호 제38조). 광고만 있으면 "00+"이다. 개발자가 할 일은 적혀 있지 않다. **[A]** (S2)
- 법: 정령 147/2024(2024-12-25 시행). 게임을 G1~G4로 나눈다. G1은 면허+발행 결정, G2~G4는 서비스 제공 증명서+발행 확인 통지가 필요하다. G4는 "인터넷에서 내려받고 플레이어 간·서버와 상호작용이 없는 게임", 곧 우리 앱에 가장 가깝다. 국경 간 온라인 게임 제공은 금지이고 현지 법인 설립이 필요하다. 역외 앱스토어는 업로드 전에 게임 제공자의 서류를 확인하고, 당국 요청이 있으면 24시간 안에 삭제해야 한다. **[B]** (S7, S8)
- 확인하지 못한 것: 순수 오프라인 게임을 가진 외국 개인 개발자가 "국경 간 제공 금지"에 걸리는지, Apple이 ASC에 베트남 서류 입력란을 만들었는지, 2026-07-13 개정 초안이 무엇을 바꾸는지(변경은 작다고 보도됨). **[C]** (S9)
- AdMob: 베트남은 서빙 가능. 단가가 낮다.
- 권장: **출시 때 제외.** 켜는 것은 언제든 무료이고, 서류 요건이 불명확한 시장을 첫 출시에 넣을 이유가 약하다. 서류 없이 두는 선택도 법적으로 막히지 않았지만 위험은 사용자 몫이다.

### 2-6. 인도네시아 (결정 D3)

- 법: 통신정보부 규정 2/2024(IGRS 게임 연령 등급). 2024-01-16 시행, 2년 유예가 2026-01 끝났다. IGRS 플랫폼은 2025-10-11 개설. 게시자는 먼저 PSE(민간 전자시스템 운영자) 등록을 한 뒤 IGRS 계정을 만들고 분류를 받아야 하며, 등급(3+/7+/13+/15+/18+)을 표시해야 한다. 위반 시 경고·과태료·접속 차단 가능. **[B]** (S10, S11)
- 그 뒤 상황: 2026-04에 Komdigi가 IGRS 검증을 일시 중단하고 연내 재가동을 목표로 한다고 밝혔다. 앱스토어 연동 목표는 2026-06이었으나 완료 보도를 못 찾았다. **[B]/[C]** (S12)
- Apple: 연령 등급 문서에 인도네시아 절이 없다. ASC에 인도네시아 입력란이 있다는 근거도 없다. **[A]/[C]** (S2)
- 외국 개발자 현지 대리인 요건은 자료가 엇갈린다. **[C]**
- 권장: **출시 때 제외**, Apple이 IGRS 연동을 공지하면 다시 본다.

### 2-7. 인도

- 온라인게임진흥규제법 2025와 규칙 2026(2026-05-01 시행): 금전 걸린 게임은 금지, e스포츠만 등록 의무, 소셜 게임 등록은 임의. 무료 오프라인 퍼즐은 대상 밖으로 보인다(문헌이 오프라인 게임을 직접 말하지 않아 추정). **[B]/[C]** (S13)
- 개인정보: DPDP 규칙 2025는 2025-11-14 공포, 아동 정보·동의 의무 등 본론은 **2027-05-13**부터. **[B]** (S14)
- ASC 할 일: 없음.
- 권장: **켠다.**

### 2-8. 러시아·벨라루스 (결정 D4)

- AdMob: Google은 러시아 사용자에게 AdMob 광고·AdMob 네트워크 서빙을 중지한 상태다(2025-01-22 갱신이 최신). 러시아 소재 퍼블리셔 수익화도 2024-08에 중지됐다. 벨라루스는 2024-12-13부터 신규 가입 중지, 벨라루스 소재 계정 수익화 중지다. **벨라루스 사용자에게 광고가 나가는지는 페이지에 없다.** **[A]** (S15)
- Apple: 러시아 App Store는 운영 중이며 2025년에 로스콤나조르 요청으로 1,213개 앱이 삭제됐다. **[B]** (S16)
- 우리 앱은 광고가 없어도 똑같이 플레이된다. 그러나 수익이 없고 ATT·UMP만 보인다.
- 권장: **제외.** 포함해도 법적으로 막히는 것은 확인하지 못했다. 이익 없이 지원·노출 위험만 있다는 판단이다.

### 2-9. 튀르키예

- 법: 2026-05-01 관보에 실린 법 7578호(5651호 개정). 게임 **플랫폼**은 연령 등급이 없는 게임을 제공할 수 없고, 미등급 게임은 18+로 취급될 수 있다. 일일 접속 10만 명 초과 해외 플랫폼은 현지 대리인을 두어야 한다. 시행일·유예·Apple의 대응은 확인하지 못했다. 개발자 개인에 대한 직접 의무는 찾지 못했다. **[B]/[C]** (S17, S18)
- Apple: 튀르키예 전용 등급 절 없음. 우리 앱은 Apple 설문 등급이 있다.
- ASC 할 일: 없음. Apple 개발자 뉴스에 튀르키예 공지가 뜨면 따른다.
- 권장: **켠다**(감시 항목).

### 2-10. 오스트레일리아·뉴질랜드·캐나다·영국·미국·아일랜드 (영어권 필수 시장)

공통: 이들은 AdMob 단가가 높은 시장이다. 모두 켠다. Kids 카테고리는 쓰지 않는다.

- **오스트레일리아**: Apple 지역 등급은 소셜 미디어·전리품 상자·모의 도박이 있을 때만 16+/R 18+로 오른다. 우리 앱은 해당 없음. **[A]** (S2) 18+ 앱 연령 확인 의무도 해당 없음(S19). 아동 온라인 개인정보 코드(OAIC)는 초안 단계, 최종 등록 기한 2026-12-10, "아동이 접근할 가능성이 큰" 앱·게임을 포함하는 방향이다. 우리 앱이 9+인 만큼 최종본 확인이 필요하다. **[B]** (S20)
- **뉴질랜드**: 별도 조사 못함. **[C]**
- **캐나다**: PIPEDA와 퀘벡 법 25호는 조사하지 못했다. 광고 SDK 고지는 방침으로 충분한 편이나 **[C]**.
- **영국**: Google EU 동의 정책이 **영국·스위스도 포함**하고(EEA와 같음), UMP가 영국에서 동의 양식을 보여 준다. **[A]** (S21) ICO 아동 코드는 광고로 운영되는 앱·게임을 범위에 넣는다. ICO는 2025-12에 아동이 하는 인기 모바일 게임 10종의 개인정보 설정·타깃 광고를 점검하는 프로그램을 시작했다. PECR(기기 식별자 접근에 동의 필요)은 현행이고 ICO가 2026-05에 완화를 권고했지만 아직 법이 아니다. **[B]** (S22)
- **아일랜드**: EU 항목(§2-13)을 따른다.
- **미국**: §2-12.
- ASC 할 일: 없음(연령 등급과 App Privacy만 pack대로).

### 2-11. 브라질 (결정 D2)

- Apple: 자체등급 앱에는 A-시리즈 지역 등급이 붙는다. 광고만 있으면 **A12**. 법무부(MJSP) 공식 등급이 있으면 Apple이 알아서 바꾼다. **[A]** (S2) 전리품 상자가 있으면 브라질 18+(우리 앱은 해당 없음).
- 법: 아동·청소년 디지털법(**Digital ECA**, 2026-03-17 시행)은 아동·청소년이 접근할 가능성이 있는 디지털 제품에 적용되고, **아동·청소년에게 광고를 맞추기 위한 프로파일링을 금지**한다. 청소년에게 매력적인 게임은 설계상 아동용이 아니어도 범위에 들 수 있다. 벌금 규모는 자료마다 달라 확인하지 못했다. **[B]** (S23, S24)
- Apple 도구: Declared Age Range API가 브라질에서 연령 구간을 준다(사용자·보호자가 공유에 동의할 때). **[A]** (S19)
- AdMob: Google은 브라질 사용자에게 개인화/비개인화 선택을 보여 주거나 비개인화 광고만 내보내는 기능, 연령 미달 이용자용 TFUA 표시를 제공한다. LGPD는 Google 계약의 데이터 보호 약관에 이미 포함된다. UMP에 브라질 전용 양식이 있는지는 확인하지 못했다. **[A]/[C]** (S25)
- 우리 앱의 상태: 광고는 ATT 허용 시 개인화된다. 사용자 나이를 모른다. 코드에서 브라질 사용자만 비개인화로 바꾸는 장치가 없다(로케일은 부정확하다).
- 권장: **출시 때 제외.** 켜려면 (a) Declared Age Range로 미성년 신호를 받아 비개인화로 내리거나 (b) 브라질에서 항상 비개인화를 쓰는 변경이 필요하다. 둘 다 코드 작업이다. [법률 확인]

### 2-12. 미국의 주 법 (참고: 영어권 필수 시장이라 켜야 한다)

- **주 개인정보보호법**: AdMob "US states regulations" 메시지는 20개 주(CA, CO, CT, DE, FL, IN, IA, KY, MD, MN, MT, NE, NH, NJ, OR, RI, TN, TX, UT, VA)의 사용자에게 "Do Not Sell or Share" 링크를 보여 준다. UMP SDK 2.1.0 이상(우리는 3.1.0)이 필요하다. 콘솔 설정은 AdMob → Privacy & messaging → US states regulations. 모든 현재·미래 주를 켜는 토글이 있다. **[A]/[B]** (S26, S27)
  - 우리 앱의 설정 시트 "개인정보 선택" 줄은 `privacyOptionsRequired()`(UMP의 `privacyOptionsRequirementStatus == REQUIRED`)를 쓴다(`apps/client/src/ads/AdMobAds.ts:149-152`). 이 값은 미국 주 메시지에서도 REQUIRED가 되므로 **코드 변경 없이 동작할 가능성이 높다.** 단, 설정 시트가 이 값만으로 줄을 보이는지 실제 확인은 하지 않았다. **[C]**
- **텍사스 앱스토어 책임법(SB 2420)**: 제121.051~056조는 앱 스토어를 통해 텍사스 사용자에게 제공되는 앱의 **개발자**에게 (1) 앱과 구매에 연령 등급을 매기고 앱 스토어에 알리고, (2) 앱 스토어가 주는 데이터로 사용자 연령 구간과 부모 동의 상태를 확인하는 체계를 만들고, (3) 약관·개인정보 방침을 크게 바꾸면 앱 스토어에 알리라고 한다. **연령 관련 콘텐츠가 없는 앱의 면제 규정은 조문에 없다.** 2025-12 가처분으로 막혔다가 5th Circuit가 2026-05-28에 집행을 풀어 **2026-06-04부터 효력**이다. 선의로 앱 스토어 정보에 의존하면 개발자 면책(제121.056(c))이 있다. 위반은 기만적 거래 관행이다. **[A: 조문 / B: 현황]** (S28, S29, S30)
  - Apple 안내: 텍사스 신규 Apple Account에 대해 개발자는 Declared Age Range API, PermissionKit의 Significant Change API, StoreKit `ageRatingCode`, 서버 알림을 검토해야 한다. 모든 앱이 의무인지는 Apple 글이 말하지 않는다. **[A/B]** (S19, S29)
  - 유타·루이지애나는 2026 개정으로 날짜가 뒤로 밀렸다는 보도가 있다(유타 2027-05-06, 루이지애나는 2027-07로 보이나 표제만 확인). **[B/C]** (S31)
  - 이 앱은 9+, 연령 제한 기능이 없는데도 조문상 개발자 의무가 적용된다는 점이 위험이다. 가장 작은 대응은 앱 시작 때 Declared Age Range로 한 번 연령 구간을 받아 저장하고(제한 기능은 두지 않음), 청소년에게는 비개인화 광고를 쓰는 것이다. 실제 구현은 이번 작업 범위 밖이다. (결정 D5) [법률 확인]
- **COPPA**: Kids 카테고리 아님·일반 이용자용으로 신고했지만, 귀여운 캐릭터(Wick)와 9+ 등급은 FTC의 "아동 대상 여부" 판단에서 불리하게 읽힐 수 있다. 개정 COPPA 규칙의 준수 기한은 확인하지 못했다. **[C]** [법률 확인]

### 2-13. EU / EEA

- **DSA 판매자 상태**: §5.
- **동의(GDPR·ePrivacy)**: 광고 개인화와 기기 식별자 접근에 동의가 필요하다. Google EU 사용자 동의 정책이 EEA·영국·스위스에 적용된다(스위스는 2024-07부터). 퍼블리셔는 동의 기록 보관, 철회 방법 안내, 정보를 받는 당사자 명시를 해야 한다. AdMob GDPR 메시지를 **게시하지 않으면 EEA에서 광고가 나가지 않는다**(pack §9 1번과 같음). **[A]** (S21, S32)
- **UMP 흐름**: EEA에서는 UMP 동의 양식 → (동의 후) ATT. 설정에 "개인정보 선택" 진입점이 있다(preflight에 있음).
- **EU 접근성법(EAA)**: 2025-06-28 시행. 게임 앱 자체가 범위에 드는지, 영세사업자 면제가 적용되는지는 조사하지 못했다. **[C]**
- **ASC**: 연령 등급과 App Privacy는 지역 공통. EU 전용 조치는 DSA뿐이다.

### 2-14. 사우디아라비아·UAE·중동

- 사우디 GCAM은 2016년부터 게임 연령 등급(3/7/12/16/18)을 운영한다. UAE는 국가미디어위원회가 게임을 포함한 미디어 연령 분류를 운영한다. 앱스토어 앱이나 외국 개발자에게 등급 신청을 요구하는지는 **확인하지 못했다.** Apple 연령 등급 문서에 두 나라의 지역 절이 없다. **[B]/[C]** (S33, S34, S2)
- ASC 할 일: 없음. 콘텐츠가 온화하다(폭력·성·도박 없음).
- AdMob·ATT: 지역 전용 메시지 없음.
- 권장: **켠다**(미확인 위험은 낮다고 추정). 나중에 문제가 되면 끄면 된다.

### 2-15. 아프리카

- 남아공 영화출판위원회(FPB): 2022-03-01 개정법 시행. 상업적 온라인 배급자는 FPB 등록이 필요하고 자체 분류 인가가 있다. 외국 개발자·앱스토어에 적용되는 방식은 확인하지 못했다. **[B]/[C]** (S35)
- 나이지리아·이집트·케냐 등: 개인정보법은 조사하지 못했다. **[C]**
- 권장: **켠다**(저위험 추정). 법적 이유로 남아공을 빼려면 §3 경로로 그 한 나라만 뺀다.

---

## 3. 권장 배포 지역 목록과 ASC 조작

### 3-1. 출시 때 켜는 곳

| 구분 | 스토어프론트 | 비고 |
| --- | --- | --- |
| 필수 | 미국, 영국, 캐나다, 오스트레일리아, 뉴질랜드, 아일랜드, **대한민국** | 한국은 §4 확인 후 켠다 |
| 켠다 | 일본, 대만, 홍콩, 싱가포르 등 나머지 동아시아·동남아 중 아래 제외 목록에 없는 곳 | 별도 요건을 찾지 못함 |
| 켠다 | 스위스 | UMP가 동의 양식을 보여 줌 |
| 켠다 | 인도, 튀르키예, 사우디, UAE 등 중동, 아프리카 | §2의 "미확인" 표기 참고. 튀르키예·남아공은 감시 |
| D1에 따라 | EU 27개국(독일·프랑스·스페인·이탈리아·네덜란드 포함) | DSA. §5 |

노르웨이·아이슬란드·리히텐슈타인은 EEA지만 Apple의 DSA 문서는 "EU 27개 영토"를 말한다. 이 나라들은 켜도 된다. **[A]** (S36)

### 3-2. 출시 때 빼는 곳

| 스토어프론트 | 이유 | 켜는 시기 |
| --- | --- | --- |
| 중국 본토 | 판호·ICP 필요. **필수 제외** | 켜지 않음 |
| 러시아, 벨라루스 | AdMob 서빙 중지 | 서빙 재개 공지 후 |
| 브라질 | ECA Digital: 청소년 광고 프로파일링 금지, 대응 코드 없음 | 연령 신호·비개인화 경로를 넣은 뒤(D2) |
| 베트남 | 정령 147호 서류 요건 불명확, 수익 낮음 | 요건이 확인되면(D3) |
| 인도네시아 | IGRS·PSE 요건 불명확, Apple 연동 미확인 | Apple 공지 후(D3) |

Apple 스토어프론트 목록에 없는 곳(크림, 쿠바, 이란, 북한, 도네츠크·루한스크)은 AdMob도 제한되어 있어 고민할 필요가 없다. **[A]** (S37)

### 3-3. ASC 메뉴 경로 (2026-10-18 Apple 도움말 기준) **[A]** (S38)

권한: Account Holder, Admin 또는 App Manager.

처음 앱을 만들 때
1. ASC → **Apps** → Duskwick → 사이드바 **Pricing and Availability**.
2. **App Availability** 절 → **Set Up Availability**.
3. **Specific Countries or Regions**를 고르고 **Next**.
4. 위 §3-1 목록에 맞게 체크한다. 목록 맨 아래 체크박스(미래 국가 자동 포함)는 **끄는 것을 권한다.** 새 스토어프론트가 법적 요건과 함께 생길 수 있어서다. 분기마다 새 국가를 본다.
5. **Next** → **Confirm**.

나중에 고칠 때: Pricing and Availability → App Availability → **Manage** → **Manage Availability** → 체크 변경 → **Next** → 확인. 변경은 즉시 적용되고 모든 사용자에게 보이기까지 최대 24시간이 걸린다. 빼면 그 스토어프론트에서 앱이 사라지고, 이미 받은 사용자는 업데이트를 받는다.

"All Countries or Regions"를 고르면 중국 본토를 포함해 앞으로 생기는 곳까지 켜진다. **고르지 않는다.**

한 번만 하는 사용자 조작
| 조작 | 경로 | 시기 |
| --- | --- | --- |
| DSA 상태 확인·신고 | **Business → Agreements → Compliance → Digital Services Act → Complete Compliance Requirements**. 앱 단위는 앱 → **App Information → App Store Regulations and Permits → Digital Services Act → Edit** | 첫 제출 전 |
| 한국 신원 정보 확인 | **Business → Agreements → Compliance → Korean Law** (전화·이메일 인증, 있으면 BRN) | 첫 제출 전 |
| 연령 등급 | 앱 → **App Information → Age Ratings → Set Up Age Ratings** (pack §1). 저장 뒤 지역별 등급(한국 All 등)을 본다 | 첫 제출 전 |
| 배포 지역 | 위 3-3 | 첫 제출 전 |

---

## 4. 한국 (상세)

### 4-1. 게임 등급: 정확히 무엇이 요구되는가

1. **법**: 게임산업진흥에 관한 법률은 게임물을 제작·배급하기 전에 등급분류를 받게 한다(옛 판 기준 제21조). 등급은 전체이용가·12세·15세·청소년이용불가 4단계이고, 선정성·폭력성·범죄·약물·부적절한 언어·사행성 다섯 기준으로 본다. **[B]** (S39, S40)
2. **자체등급분류**: 오픈마켓은 GRAC가 지정한 자체등급분류사업자가 등급을 매긴다. Apple, Google, 에픽게임즈 등 11개 사업자와 민간 등급기관이 2025년 등급분류 2,019,426건 가운데 99.9%를 처리했다. **[B]** (S41) 2025-03에 국회를 통과한 개정은 재지정 기간을 3년에서 5년으로 늘리고 요건을 자본금 기준으로 완화하며 청소년이용불가까지 민간 위탁을 넓혔다(공포 6개월 뒤 시행). **[B]** (S42)
3. **Apple의 방식**: Games 또는 Entertainment가 기본·보조 카테고리인 앱은 연령 설문 답에서 한국용 등급(All/12+/15+/19+)이 계산되어 표시된다. 한국 전용으로 따로 받는 것이 없다. **[A]** (S1, S2)
   - 우리 앱: 설문 답에서 "광고 있음"만 해당한다. Apple의 한국 표에서 광고는 **All**에 해당한다. 그래서 한국에서 전체이용가로 나올 것이다. 단, 우리가 "Override to Higher Age Rating → 9+"를 고르는데 이것이 한국 값에 어떻게 반영되는지는 문서가 말하지 않는다("지역마다 값이 달라질 수 있다"만 있다). **ASC에서 저장한 뒤 Age Ratings 절의 Republic of Korea 값을 직접 본다.** **[C]**
4. **2026년 변경** **[A]** (S1)
   - 2026-08-12: GRAC 공식 등급을 받은 앱은 다음 버전 제출 때 RCN을 넣어 한국 등급을 All/12+/15+/19+ 중 하나로 덮어쓸 수 있다.
   - 2026-10: "드문 욕설·거친 유머"와 "드문 성숙·암시 주제"가 한국에서 All에서 12+로 올라간다. 우리 앱은 이 두 항목 모두 "None"이라 영향이 없다.
   - 같은 요건: 빈번하거나 강한 모의 도박은 RCN이 없으면 한국에서 판매할 수 없다. 해당 없음.
5. **GRAC 등급이 Apple 등급과 다를 때**: App Review가 메시지를 보낸다. ASC → 앱 → **App Information → Age Ratings → Republic of Korea 옆 Add RCN** → 번호와 GRAC 등급(전체이용가/12세/15세/청소년이용불가)을 넣고 "공식 등급임" 확인란을 체크 → Save → 새 버전을 제출. 승인되면 잠긴다. **[A]** (S43) 우리는 GRAC에 신청하지 않으므로 해당 없음이다.

### 4-2. "건너뛰면" 생기는 일

- **건너뛸 수 없다.** 연령 설문은 제출에 필수이고, 그 설문이 곧 자체등급분류다. 별도 GRAC 신청이나 번호는 불필요하다.
- **허위·부정확한 답**: GRAC는 자체등급분류의 적정성을 모니터링한다(2025년 119,934건). 시정 요청 1,592건, 국내 유통 제한 7건이었다. **[B]** (S41) 사실과 다른 설문 답은 Apple 등급과 GRAC 판단이 어긋날 위험이다. 그러면 위 4-1의 5번 절차가 시작된다.
- **미등급 게임물**: 법은 등급분류를 받지 않은 게임물을 유통·제공하는 것을 금지하고 벌칙이 있다. 내가 읽은 것은 2013년판 조문뿐이라(제32조 위반 → 5년 이하 징역/5천만 원 이하 벌금, 표시 의무 위반 → 2년/2천만 원) 숫자와 조번호는 현행으로 확인해야 한다. **[C]** (S44) [법률 확인]
- **같은 게임을 다른 플랫폼에 낼 때**: 앱스토어 자체등급으로 낸 게임을 다른 플랫폼(예: 토스 앱인토스, 구글 플레이)에 올릴 때는 GRAC에 게임 정보를 제출해야 하고, 정보가 앱스토어에서 등급받을 때와 같아야 한다. 안 하면 등급 미필로 본다. 안드로이드 출시나 다른 마켓 계획이 생기면 그때 처리한다. **[B]** (S40, S45)
- 무료 게임·인디 개발자에 대한 예외 규정은 찾지 못했다. **[C]**

### 4-3. 한국 개발자 신원 정보 표시 (전자상거래법)

- 한국에 있는 개인·단체 개발자는 Apple이 신원 정보를 수집·검증해 **상품 페이지에 표시**한다. 개인: **이메일, 사업자등록번호(BRN)**. 단체: 회사명, 이메일, 전화번호, BRN. **[A]** (S3)
- 유료 앱 계약에 서명했다면 세금 양식에 넣은 BRN이 자동 표시된다. 서명하지 않았고 BRN을 표시하고 싶으면 ASC → **Business → Agreements → Compliance → Korean Law**에서 전화·이메일을 인증하고 필요하면 "BRN 제공" 확인란을 체크한다. **[A]**
- 이 페이지는 **BRN이 없는 개인이 어떻게 되는지, 무료 앱만 있는 개발자에게 의무인지를 말하지 않는다.** 기존 앱이 이미 한국에 있으므로 이 항목은 이미 처리됐을 가능성이 높다. 첫 제출 전에 이 화면을 열어 상태를 확인한다. **[C]**
- 결정 D6: 여기서 인증한 이메일이 한국 상품 페이지에 공개된다. 같은 이메일을 Support URL, 개인정보처리방침, 연락처에도 쓰는 것을 권한다. 전화번호는 개인 계정에서는 인증용이고 표시 항목에는 없다(위 문서 기준).

### 4-4. 개인정보 방침과 접근권한 (광고만 있는 앱)

법적 틀 **[B]** (S46, S47, S48)
- 개인정보처리방침(개인정보 보호법 제30조): 서버에 저장되는 개인정보가 하나라도 있으면 작성이 필요하다. 2026-04-24에 공개된 개정 작성지침은 "단말 안에서만 처리하면 그 사실과 삭제 기준을 안내하라"고 권장한다. 지침은 권고이며 법적 의무는 아니다.
- 우리 앱은 자체 서버가 없지만 **AdMob SDK가 Google로 기기 식별자·IP·광고 상호작용을 보낸다.** 이것을 처리방침에 적는 것이 안전하다. 개인정보보호위원회 행태정보 정책(2024-01)은 매체 사업자에게 "제3자가 수집하도록 허용한 도구와 수집 정보"를 방침에 적도록 권고한다. 2022년에 구글·메타가 맞춤형 광고 동의 문제로 약 1,000억 원 과징금을 받았다. 14세 미만 아동은 행태정보와 개인정보를 결합하는 맞춤형 광고에 법정대리인 동의가 필요하다. **[B]**
- 국외이전(제28조의8): 국외로 제공·위탁·보관하면 이전받는 자·국가·항목·시기·방법·목적·보유기간·거부 방법과 효과를 알려야 한다. Google LLC(미국)가 받는 자다. 광고 SDK 전송이 "제3자 제공"이어서 별도 동의가 필요한지, 방침 공개로 충분한지는 해석이 갈린다. 광고 식별자(IDFA)는 ATT 허용으로 동의가 있고 나머지(IP 등)는 동의 없이 간다. **[C]** [법률 확인] 2026-09-11 시행 개정법이 있다는 글이 있으나 그 글 안에서도 공포일·법률 번호가 엇갈려 원문 확인이 필요하다. **[C]** (S46)
- 앱 접근권한(정보통신망법 제22조의2와 시행령 제9조의2): 앱 서비스 제공자가 접근권한을 쓰면 필수/선택을 나누어 항목과 이유를 알리고, 선택 권한은 거부할 수 있음을 알리며, 거부해도 앱을 막으면 안 된다. iOS는 처음 접근할 때 개별 동의를 받는 방식이다. **알림 권한이 이 대상인지는 확인하지 못했다.** **[B]/[C]** (S49)

앱이 실제로 쓰는 것: 필수 접근권한 **없음**. 선택: 알림(로컬, 사용자가 "알려 주세요"를 누를 때만), 추적(ATT, 앱 안 첫 판 뒤). 거부해도 게임은 똑같이 플레이된다(이미 구현됨).

### 4-5. 우리 페이지와 ASC 필드가 채울 것

| 위치 | 넣을 내용 | 상태 |
| --- | --- | --- |
| 개인정보처리방침(한국어판, 권장 URL `https://humsleep.github.io/duskwick/ko/privacy`) | ① 처리자와 개인정보 보호책임자(개인 개발자 본인, 연락 이메일) ② 앱은 직접 수집하지 않음, 자체 서버 없음, 기기에서만 처리 ③ AdMob이 수집하는 항목: 광고 식별자(ATT 허용 시), 기기·앱 식별자, IP 기반 대략 위치, 광고 상호작용, 진단 ④ 목적: 광고 게재·측정·부정 방지 ⑤ 보유: Google 정책에 따름 ⑥ **국외이전**: 받는 자 Google LLC(미국), 시기·방법(광고 요청 때 네트워크 전송), 거부 방법(ATT 거부, iOS 설정 > 개인정보 보호 및 보안 > 추적, 설정의 "개인정보 선택"), 거부 효과(비맞춤 광고) ⑦ **행태정보**: 제3자 수집 도구 AdMob 사용 사실과 수집 항목 ⑧ iCloud 키-값 저장: 사용자 본인 iCloud, 개발자는 접근 불가 ⑨ 만 14세 미만 대상 아님(영어판의 13세와 다르다) ⑩ 아동 개인정보를 알고 수집하지 않음 ⑪ 방침 변경 공지 | 새로 작성(pack §6에는 없음) |
| 앱 설명(ko) 끝 | "선택 권한: 알림(하루 한 번 알림을 켤 때만), 추적(광고 개인화에 쓰는 광고 식별자, 거부해도 똑같이 플레이)". 필수 권한 없음 | 새로 작성 |
| ASC → App Information → Privacy Policy URL (한국어 로캘) | 한국어판 URL. 로캘별로 다른 URL을 넣을 수 있는지는 화면에서 확인 | 확인 필요 **[C]** |
| ASC → App Privacy | pack §2대로 | 이미 있음 |
| ASC → Support URL | 영어 페이지로 충분. 한국어 한 줄 추가 권장 | 선택 |
| ASC → Business → Agreements → Compliance → Korean Law | §4-3 | 사용자 조작 |

---

## 5. EU DSA 판매자(trader) 결정 (결정 D1, 중립 설명)

### 5-1. 사실 **[A]** (S36, S50)

- **어디서**: 계정 단위는 ASC → **Business → Agreements → Compliance → Digital Services Act → Complete Compliance Requirements**. 앱 단위는 앱 → **App Information → App Store Regulations and Permits → Digital Services Act → Edit**. 역할은 Account Holder 또는 Admin.
- **누구에게 필요한가**: 새 앱을 제출할 때 trader인지 아닌지 밝혀야 한다. "EU에 앱을 배포하지 않아도 상태는 신고해야 한다"고 Apple이 적었다.
- **trader를 고르면** 개인 개발자는 **주소 또는 사서함(P.O. Box), 전화번호, 이메일**을 입력한다. 확인(Apple이 인증)된 뒤 이 정보가 **EU 27개 영토의 상품 페이지에 공개**된다. 이 정보는 Apple 개발자 멤버십 정보에는 영향이 없다(표시용). 더해서 결제 계정 정보(ASC에 아직 없으면)를 내고 "EU 법을 따르는 제품·서비스만 제공한다"는 증명을 해야 한다. 선택 항목으로 Labels and Markings URL이 있다. 증빙 서류를 요구받을 수 있다.
- **non-trader를 고르면** 연락처를 내지 않는다. EU 소비자에게 "이 계약에는 소비자보호법상 권리가 적용되지 않는다"는 안내가 표시된다. Apple은 "거래·사업·직업과 무관한 목적"이면 trader가 아닐 가능성이 높고, 사업 활동과 연결된 법적 지위가 있으면 trader일 가능성을 시사한다고 쓴다. **판단은 개발자가 한다.** Apple은 대신 판단할 수 없다고 적었다.
- **EU에 배포하지 않으면**: 그 앱은 trader로 행동하는 것이 아니다. 그래도 계정 단위 상태는 신고해야 한다.
- **집행**: trader 상태가 없는 앱은 EU 스토어에서 내려진다. 업데이트 제출은 2024-10-16부터, 앱 전반은 2025-02-17부터. 무료 앱도 포함. (S51) 2026년 신규 변경은 찾지 못했다. **[B]/[C]** 개발자 포럼에는 2026-08-22부터 "In Review"로 멈춘 사례가 있어, 인증이 길어질 수 있다. (S52)

### 5-2. 법적 개념 **[B/C]**

DSA의 trader는 거래·사업·수공업·직업과 관련된 목적으로 행동하는 자연인 또는 법인이다. 광고 수익을 목적으로 앱을 계속 내는 포트폴리오는 보통 trader 쪽으로 읽힌다. 단, 판단 기준은 개별 사실이다. [법률 확인]

### 5-3. 세 가지 선택지

| | A. trader로 신고 | B. non-trader로 신고 | C. EU 제외 |
| --- | --- | --- | --- |
| 공개되는 것 | 주소(사서함 가능)·전화·이메일, EU 상품 페이지 | 없음 | 없음(EU에서) |
| 장점 | 활동 실태와 일치. EU 27개국 전체 시장(독일·프랑스 등). 규정 위반으로 내려질 위험이 가장 낮다 | 연락처를 감출 수 있고 EU 판매도 가능 | 가장 작은 노출. 신고 의무는 남아도 EU 상품 페이지 공개는 없다 |
| 단점 | 개인 연락처가 공개된다. 스팸·원치 않는 연락 가능. 결제 계정 정보와 증빙을 요구받을 수 있다 | 광고 수익 목적이면 사실과 다를 수 있다. 사실과 다른 신고는 Apple·규제 당국이 문제 삼을 수 있다(결과 수위는 확인하지 못함). EU 이용자에게 "소비자 권리 비적용" 안내가 뜬다 | EU 수익과 이용자를 포기. 광고 단가가 높은 시장이다. 나중에 켜려면 그때 신고가 필요하다 |
| 필요한 준비 | 전용 사서함, 전용 전화번호(인증 코드를 받을 수 있어야 함. 인증 불가 시 Apple에 수동 인증 요청 가능), 전용 이메일 | 없음 | 없음 |

최소 공개 정보(옵션 A): **주소 또는 사서함 1개, 전화번호 1개, 이메일 1개.** 이 셋이 모두 공개된다. 이름은 개발자 이름이 이미 상품 페이지에 나온다. 이메일은 Support URL·방침·한국 신원 정보(§4-3)로 이미 공개되므로 새 노출은 **주소(사서함)와 전화**다. 사서함이 쓰이는 방식과 VoIP·가상 번호가 인증을 통과하는지는 문서로 확인하지 못했다. **[C]**

### 5-4. 먼저 할 일 (선택 전)

기존 앱이 EU에서 서비스 중이면 계정 단위 상태가 이미 있다. **Business → Agreements → Compliance → Digital Services Act**에서 현재 값을 본다.
- 이미 trader → 새 앱은 같은 상태를 이어받는다. 추가 공개는 없다(이미 공개 중). 앱 단위 Edit에서 바꿀 수 있는지만 확인한다.
- 이미 non-trader → 같은 논리가 새 앱에도 적용된다. 바꾸고 싶으면 §5-3으로 돌아가 결정한다.
- 신고한 적 없음 → 이번 제출에서 반드시 고르게 된다.

### 5-5. 중립 정리

시장 크기와 활동 실태를 중시하면 A, 연락처 공개를 피하고 EU를 포기해도 되면 C, B는 활동이 실제로 비사업적일 때만 합리적이다. 이 문서는 선택을 대신하지 않는다.

---

## 6. AdMob 쪽 지역 제약과 UMP·ATT 영향 (한 곳에 모음)

| 항목 | 내용 | 확인 |
| --- | --- | --- |
| 서빙 불가 | 크림, 쿠바, 도네츠크·루한스크, 이란, 북한(OFAC). 이 지역에서 계정에 로그인할 수 없다 | [A] (S37) |
| 러시아 | 러시아 사용자에게 AdMob 광고·네트워크 서빙 중지(2025-01-22). 러시아 소재 퍼블리셔 수익화도 중지 | [A] (S15) |
| 벨라루스 | 소재 계정 중지(2024-12-13). 벨라루스 사용자 서빙은 페이지에 없음 | [A]/[C] (S15) |
| EEA·영국·스위스 | Google EU 사용자 동의 정책 적용. UMP 동의 양식. AdMob 콘솔에서 GDPR 메시지를 **게시해야** 광고가 나간다 | [A] (S21, S32) |
| 미국 20개 주 | "US states regulations" 메시지(Do Not Sell or Share). UMP ≥2.1.0. 콘솔에서 게시, "모든 현재·미래 주" 토글 | [A]/[B] (S26, S27) |
| 브라질 | LGPD는 Google 약관에 이미 포함. 개인화/비개인화 선택, TFUA 표시 제공. UMP 브라질 양식 여부 미확인 | [A]/[C] (S25) |
| 한국 | 전용 동의 메시지 없음. 방침 고지(§4-4) | [B] |
| IDFA 설명 메시지 | UMP가 ATT 전에 보여 주는 선택 메시지. 문구 지침은 Google 문서에 없다. pack §4가 지적한 "Tap Allow" 문구 위험은 그대로 | [A] (S53) |
| ATT | 전 지역 공통. 허용 전에는 IDFA가 0이다. 거부해도 광고 요청은 가능 | [A] (S53) |
| AdMob 지급 | 한국 퍼블리셔 지급 가능 여부 문서는 찾지 못함. 계정 설정의 지급 방식 화면에서 직접 확인 | [C] |

우리 앱 코드의 동의 흐름(`AdMobAds.ts:119-147`): 동의가 REQUIRED(EEA 등)면 양식 → ATT. 그 외 지역은 ATT만. 미국 주 메시지는 NOT_REQUIRED 상태에서 "개인정보 선택" 진입점으로만 나타난다. 이 구조는 §2-12의 가정과 맞는다.

---

## 7. 아직 모르는 것 (다음에 확인할 순서)

1. **현재 DSA 상태**(ASC 화면). 가장 먼저. 5분이면 된다.
2. **한국 등급 값**: 설문 저장 뒤 Age Ratings의 Republic of Korea가 All인지, 9+ override가 어떻게 반영되는지. 같은 화면.
3. Korean Law 항목 상태(사업자 정보 인증 완료 여부).
4. 텍사스 SB 2420 개발자 의무가 이 앱에 실제로 필요한지(법률), 필요하면 Declared Age Range 최소 구현(D5).
5. 브라질 Digital ECA와 Declared Age Range/비개인화 경로(D2).
6. 인도네시아 IGRS와 베트남 정령 147호의 Apple 쪽 절차(공지가 뜰 때).
7. 한국 현행 게임산업법 조문 번호와 벌칙(국가법령정보센터는 조회 시점에 접속이 막혀 있었다).
8. 일본 외부송신규율, 대만 분급 규정, 중동·아프리카의 앱스토어 앱 적용 여부(낮은 우선순위).
9. 영문 개인정보 방침의 "13세 미만" 문구가 한국(14세)·영국·브라질과 어긋나지 않는지.

## 8. 기존 문서와 다른 점 (이 문서가 바로잡는 것)

- pack §8 "한국: Apple 연령 등급으로 충분하다(별도 조치 없음)": 게임 등급은 맞다. 단 한국어 방침·국외이전 고지·Korean Law 신원 정보(§4-3, §4-4)가 빠져 있다.
- pack §8 "EU 국가를 배포에서 빼는 선택지": 빼도 **계정 단위 상태 신고는 남는다**(Apple 도움말). 또 기존 앱이 있으면 이미 신고돼 있을 가능성이 높다.
- pack §6 영어 방침의 "under 13" 문구는 한국(14세 기준), 브라질(18세 미만 보호), 호주(15세 미만 동의) 기준과 다르다.
- preflight는 미국 주 앱스토어 연령법과 브라질 ECA Digital을 다루지 않았다(§2-11, §2-12).
- pack §9의 AdMob 콘솔 할 일에 "US states regulations" 메시지 게시가 없다(§6).

## 9. 출처 (모두 2026-10-18에 열람. 직접 열람은 [A], 검색 요약만이면 [B])

- S1 Apple 개발자 뉴스, Updates to age ratings for the Republic of Korea (2026-08-12): https://developer.apple.com/news/?id=oj3r9pvw [A]
- S2 Apple, Age ratings values and definitions (한국·베트남·호주·브라질·프랑스 절): https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/ [A]
- S3 Apple, Manage Korea compliance information: https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-korea-compliance-information [A]
- S4 일본 총무성 외부송신규율 자료·JIPDEC 자료: https://www.soumu.go.jp/main_content/001049133.pdf , https://www.jipdec.or.jp/library/report/tjvsos0000001cpc-att/20230308_r02.pdf [B]
- S5 Taiwan Game Software Rating Regulations 개요: https://en.wikipedia.org/wiki/Game_Software_Rating_Regulations , https://www.inside.com.tw/article/1435-app-game-rating-in-taiwan [B, 2012 기사]
- S6 Apple 중국 본토 판호·ICP 요건 보도: https://appinchina.co/blog/apple-to-require-revenue-generating-mobile-games-to-be-approved-by-chinese-government/ , https://www.medianama.com/2023/10/223-apple-china-app-store-government-license/ , https://www.singular.net/blog/ios-apps-china/ [B]
- S7 Tilleke & Gibbins, Vietnam Decree 147: https://www.tilleke.com/insights/a-closer-look-at-vietnams-decree-147-on-internet-services-and-online-information/ [A 읽음/B 성격]
- S8 PocketGamer.biz, Decree 147: https://www.pocketgamer.biz/vietnam-issues-decree-1472024-to-regulate-online-games-and-internet-services/ [B]
- S9 CCIA, Vietnam 2026-07-30(본문 읽기 실패, 검색 요약만): https://ccianet.org/wp-content/uploads/securepdfs/2026/07/2026-07-30-Vietnams-Online-Services-Reforms-Leave-Gaming-Barriers-Unresolved.pdf [C]
- S10 K&K Advocates, IGRS: https://www.kk-advocates.com/news/read/indonesian-game-rating-system-igrs-platform-officially-launched [A 읽음/B 성격]
- S11 Makarim IGRS: https://www.makarim.com/news/safe-zone-indonesia-launches-2026-game-rating-system (인증서 오류로 열지 못함, 검색 요약만) [B]
- S12 Bisnis.com / Liputan6 (IGRS 중단·재가동): https://teknologi.bisnis.com/read/20260406/101/1964501/5-poin-penting-jawaban-komdigi-soal-sengkarut-igrs-di-platform-steam , https://www.liputan6.com/tekno/read/8265872/komdigi-targetkan-reaktivasi-igrs-rampung-pada-2026 [B]
- S13 인도 온라인게임규칙 2026: https://www.drishtiias.com/daily-updates/daily-news-analysis/promotion-and-regulation-of-online-gaming-rules-2026/print_manually , https://www.storyboard18.com/amp/gaming-news/online-gaming-rules-eased-social-games-registration-voluntary-under-prog-act-2025-ws-e-93213.htm [B]
- S14 인도 DPDP 규칙 2025: https://www.hlc.com/en/publications/indias-digital-personal-data-protection-act-2023-brought-into-force- , https://amlegals.com/digital-personal-data-protection-rules-2025/ [B]
- S15 Google, Regional Monetization Pause Policies: https://support.google.com/publisherpolicies/answer/15766875 [A]; AdMob 정책 변경 로그: https://support.google.com/admob/answer/9391084 [A]
- S16 러시아 앱 삭제 통계: https://zona.media/news/2026/05/25/apps , https://istories.media/news/2026/05/23/v-2025-godu-apple-udalila-iz-svoego-magazina-1213-prilozhenii-po-trebovaniyu-roskomnadzora/ [B]
- S17 Pi Legal, Turkey Digital Game Regulation: https://www.pilc.law/turkey-digital-game-regulation/ [A 읽음/B 성격]
- S18 Game World Observer, Turkey: https://gameworldobserver.com/2026/04/23/its-now-official-turkey-will-tighten-control-over-steam-and-other-gaming-platforms [A 읽음/B 성격]
- S19 Apple 개발자 뉴스, Age requirements for apps distributed in Brazil, Australia, Singapore, Utah, and Louisiana (2026-02-24): https://developer.apple.com/news/?id=f5zj08ey [A]
- S20 호주 아동 온라인 개인정보 코드: https://www.oaic.gov.au/engage-with-us/consultations/draft-childrens-online-privacy-code-consultation-for-industry,-civil-society,-academia , https://www.bakermckenzie.com/en/insight/publications/2026/05/australia-childrens-online-privacy-code-exposure-draft [B]
- S21 Google EU User Consent Policy: https://www.google.com/about/company/user-consent-policy/ [A]
- S22 영국 ICO·PECR: https://www.hunton.com/privacy-and-cybersecurity-law-blog/uk-ico-recommends-targeted-changes-to-pecr-rules-for-online-advertising , https://www.freevacy.com/news/ico/ico-to-scrutinise-childrens-online-privacy-in-mobile-games/6963 [B]
- S23 OneTrust, Digital ECA: https://www.onetrust.com/blog/childrens-data-digital-eca-and-consent-in-brazil-what-organizations-need-to-know/ [A 읽음/B 성격]
- S24 Brazil Digital ECA 2026-03 (BiometricUpdate): https://www.biometricupdate.com/202603/andp-publishes-comprehensive-guide-to-age-assurance-as-brazilian-law-takes-effect [B]
- S25 Google, Brazil LGPD: https://support.google.com/adsense/answer/9928203 [A]
- S26 AdMob, US state regulations 메시지: https://support.google.com/admob/answer/10862202 [A]
- S27 ppc.land, Indiana·Kentucky·Rhode Island 추가: https://ppc.land/google-quietly-adds-three-states-to-privacy-compliance-toolkit/ [B]
- S28 텍사스 SB 2420 법문: https://capitol.texas.gov/tlodocs/89R/billtext/html/SB02420F.htm [A]
- S29 9to5Mac, 텍사스 2026-06-04: https://9to5mac.com/2026/06/03/apple-says-texas-app-store-age-assurance-rules-start-tomorrow-after-court-ruling/ [B]
- S30 Pearl Cohen / Texas Policy Research (5th Circuit): https://www.pearlcohen.com/fifth-circuit-stays-injunctions-against-texas-app-store-accountability-act/ [B]
- S31 FPF, Comparing Enacted App Store Accountability Acts (2026-06-03): https://fpf.org/blog/comparing-enacted-app-store-accountability-acts/ [A 읽음]; Wiley 알림: https://www.wiley.law/alert-Key-Developments-With-State-App-Store-Accountability-Acts-as-Texas-Act-Takes-Effect [B]
- S32 AdMob UMP iOS: https://developers.google.com/admob/ios/privacy [A]
- S33 사우디 GCAM 등급: https://localization.saudisoft.com/?p=32786 , https://ar-pay.com/blog/en/articles/age-rated-games/ [B]
- S34 UAE 연령 분류: https://gulfnews.com/living-in-uae/ask-us/decoding-uae-age-ratings-for-films-books-and-video-games-what-parents-should-know-1.1727272240932 [B]
- S35 남아공 FPB: https://www.ensafrica.com/news/detail/6306/films-and-publications-amendment-regulations- , https://insightplus.bakermckenzie.com/bm/technology-media-telecommunications_1/south-africa-films-and-publications-amendment-act-comes-into-force [B]
- S36 Apple, Manage EU Digital Services Act compliance information: https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-compliance-information/ [A]
- S37 AdMob 국가 제한: https://support.google.com/admob/answer/6163675 [A]
- S38 Apple, Manage availability for your app on the App Store: https://developer-rno.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store [A] (Apple 미러 도메인. developer.apple.com 쪽 같은 경로는 404였다)
- S39 게임산업진흥에 관한 법률 (2013 시행본, 위키문헌. 현행 아님): https://ko.wikisource.org/wiki/게임산업진흥에_관한_법률 [A 읽음/현행 여부 C]
- S40 앱인토스, 게임 등급분류: https://toss.im/apps-in-toss/blog/game_rating_classification [A 읽음/B 성격]
- S41 Inven Global, GRAC 2025 통계: https://www.invenglobal.com/articles/27035/game-classification-volume-up-but-monitoring-workforce-reduced [B]
- S42 김·장 뉴스레터, 2025 게임산업법 개정: https://www.shinkim.com/kor/media/newsletter/2774 [B]
- S43 Apple, Set an app age rating (Republic of Korea, Add RCN): https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating [A]
- S44 (S39와 같음. 2013년판 벌칙 조항)
- S45 앱인토스, 자체등급분류 게임물 정보 입력: https://toss.im/apps-in-toss/blog/self-rated_game_distribution [A 읽음/B 성격]
- S46 개인정보 처리방침 2026 작성지침 요약: https://newlawyer.co.kr/41/329 ; 개인정보 보호법 제28조의8: https://casenote.kr/법령/개인정보_보호법/제28조의8 [B]
- S47 개인정보위 행태정보 정책 (2024-01): https://www.etoday.co.kr/news/view/2327015 ; https://www.mondaq.com/advertising-marketing--branding/1463398/pipc-announces-policy-direction-for-the-protection-of--online-behavioral-data-used-in-targeted-advertising [B]
- S48 구글·메타 맞춤형 광고 과징금: https://www.koreajoongangdaily.com/business/new-guidelines-could-do-away-with-pesky-online-advertisements/10118380 [B]
- S49 앱 접근권한(정보통신망법 제22조의2): https://www.nepla.ai/wiki/it-정보-방송통신/개인정보-위치정보-신용정보/이용자의-개인정보-보호를-위한-앱-접근권한-설정에-관하여-j21nmvgo1n73 ; https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/new-privacy-guidelines-now-effective-in-south-korea-online-customized-ads-smartphone-app-access-rights [B]
- S50 Apple 개발자 뉴스, Provide your trader status in App Store Connect (2024-03-21): https://developer.apple.com/news/?id=x60uzbu9 [A]
- S51 Apple, Upcoming requirements (DSA trader 항목 포함): https://developer.apple.com/news/upcoming-requirements/ [A]
- S52 Apple 개발자 포럼, DSA Trader Status "In Review" 사례: https://developer.apple.com/forums/thread/848065 [B]
- S53 AdMob, IDFA 메시지: https://developers.google.com/admob/ios/privacy/idfa [A]
