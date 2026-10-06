// Every fact in the prototype lives in this one module.
// The browser imports it to render the screens, and api/draft.js imports it to build
// the model prompt, so what the merchant sees and what the AI is told can never disagree.
// All people, orders, IDs and police details are fictional.

export const MERCHANT = {
  name: 'Arjun Mehta',
  store: 'Kesar Kurtas',
  initials: 'KK',
  city: 'Jaipur',
  videoContact: '+91 98290 •••12',
  // Line used in the model prompt.
  fact: 'Arjun Mehta runs Kesar Kurtas, an online clothing store in Jaipur.',
};

export const HOLD = {
  amount: '₹1,800',
  order: 'KK-2417',
  placedOn: '5 Oct',
  station: 'Cyber Crime Police Station, Lucknow',
  stationShort: 'Cyber Crime PS, Lucknow',
  complaintRef: '3120926••••0471',
  complaintFiled: 'Sat 3 Oct 2026',
  reportedOn: 'cybercrime.gov.in / 1930',
  respondBy: 'Mon 12 Oct',
  daysLeft: 7,
  reference: 'HR-2417-1005',
  submittedOn: 'Mon 5 Oct 2026',
  // Line used in the model prompt. The complainant is never named anywhere.
  fact: 'The payment for order KK-2417 was reported as fraud on the national cyber-crime portal, and Cyber Crime Police Station, Lucknow asked for ₹1,800 to be held on 5 Oct 2026 while they look into it.',
};

export const HOME = {
  // Settlements reach the bank the day after; this follows the story's date as time advances.
  nextSettlement: ['Tue 6 Oct', 'Wed 7 Oct', 'Sat 10 Oct', 'Sat 17 Oct'],
  settlement: '₹23,480',
  todayTotal: '₹4,940',
  payments: [
    { order: 'KK-2484', method: 'UPI', time: '9:48 AM', amount: '₹1,450' },
    { order: 'KK-2483', method: 'Card', time: '9:12 AM', amount: '₹2,290' },
    { order: 'KK-2481', method: 'UPI', time: '8:30 AM', amount: '₹1,200' },
  ],
};

export const LEDGER = { lost: '₹3,750', lostHolds: 2, recovered: '₹1,800' };

export const PAST_HOLDS = [
  { order: 'KK-2093', when: 'Jul 2026', amount: '−₹2,100' },
  { order: 'KK-1876', when: 'Apr 2026', amount: '−₹1,650' },
];

// E1–E4 come from data the payment platform already has.
// `title`, `src`, `shown` and `code`/`quote` are displayed; `fact` goes into the prompt.
export const EVIDENCE = [
  {
    id: 'E1',
    icon: 'rupee',
    title: 'Payment',
    src: 'From your payments',
    shown: '₹1,800 by UPI · Mon 14 Sep, 7:42 PM',
    code: 'pay_Q8xV2mK41sTzA · UTR 425716038842',
    fact: 'Payment of ₹1,800 by UPI on 14 Sep 2026 at 7:42 PM. Payment ID pay_Q8xV2mK41sTzA, UTR 425716038842.',
  },
  {
    id: 'E2',
    icon: 'receipt',
    title: 'Order and invoice',
    src: 'From your order notes',
    shown: '1 cotton kurta set, size M',
    code: 'Order KK-2417 · Invoice INV-2026-0917',
    fact: 'Order KK-2417: one cotton kurta set, size M. Invoice INV-2026-0917.',
  },
  {
    id: 'E3',
    icon: 'truck',
    title: 'Delivery',
    src: 'From your shipping partner',
    shown: 'Delivered Fri 18 Sep, 1:15 PM · recipient confirmed with OTP',
    code: 'AWB 1489 2203 7716',
    fact: 'Delivered on 18 Sep 2026 at 1:15 PM; the recipient confirmed delivery with an OTP. AWB 1489 2203 7716.',
  },
  {
    id: 'E4',
    icon: 'policy',
    title: 'Your exchange policy',
    src: 'From your store page, live since 2 Mar',
    quote: 'Size exchange free within 7 days of delivery. Customer pays the ₹120 return courier.',
    fact: 'Exchange policy published on the store page since 2 Mar 2026: free size exchange within 7 days of delivery; the customer pays the ₹120 return courier.',
  },
];

// E5 is the one item the platform cannot know: the customer's chat, on the merchant's phone.
export const E5_LABELS = ["Customer's exchange request", 'Delivery proof', 'Other proof'];

export const E5_CHAT = {
  id: 'E5',
  icon: 'chat',
  title: "Customer's exchange request",
  src: 'Chat screenshot from your phone',
  shown: 'Sat 19 Sep: asked to swap size M for L, refused the ₹120 return courier, said they would complain.',
  fact: 'Chat on 19 Sep 2026: the customer asked to exchange size M for size L, refused to pay the ₹120 return courier, and said they would file a complaint.',
};

/** The E5 evidence item for a given E5 choice, or null. `e5` is null | {kind:'chat'} | {kind:'tag', tag}. */
export function e5Item(e5) {
  if (e5?.kind === 'chat') return E5_CHAT;
  if (e5?.kind === 'tag' && E5_LABELS.includes(e5.tag)) {
    return {
      id: 'E5',
      icon: 'image',
      title: e5.tag,
      src: 'Your screenshot, tagged by you',
      shown: 'Added from your phone.',
      fact: `A screenshot from the merchant's phone, tagged by the merchant as "${e5.tag}". Its contents were not read, so do not describe them beyond saying it is attached.`,
    };
  }
  return null;
}

/** E1–E4, plus E5 when the merchant has added it. */
export function evidenceFor(e5) {
  const extra = e5Item(e5);
  return extra ? [...EVIDENCE, extra] : [...EVIDENCE];
}

/** True when E5 shows the customer asked for an exchange, so the statement can say so. */
export function isExchangeDispute(e5) {
  return e5?.kind === 'chat' || (e5?.kind === 'tag' && e5.tag === E5_LABELS[0]);
}

// The sample chat screenshot, drawn in HTML/CSS as a generic chat app.
export const CHAT = {
  name: 'Customer (KK-2417)',
  number: '+91 ••••• •4417',
  date: 'Sat, 19 Sep',
  messages: [
    { from: 'them', time: '10:04', text: 'Size M thoda tight hai, L chahiye. Exchange kar do please' },
    { from: 'me', time: '10:20', text: "Ji ma'am, exchange ho jayega. Return courier ₹120 aapko dena hoga, website pe policy likhi hai" },
    { from: 'them', time: '10:31', text: 'Courier ka paisa main kyun du? Main complaint kar dungi' },
  ],
};

export const LETTER = {
  en: {
    to: 'To the Investigating Officer, Cyber Crime Police Station, Lucknow',
    re: 'Re: complaint 3120926••••0471 · ₹1,800 hold on order KK-2417',
    sign: 'Arjun Mehta, Kesar Kurtas, Jaipur',
  },
  hi: {
    to: 'सेवा में, जाँच अधिकारी, साइबर क्राइम थाना, लखनऊ',
    re: 'विषय: शिकायत 3120926••••0471 · ऑर्डर KK-2417 पर ₹1,800 की रोक',
    sign: 'अर्जुन मेहता, केसर कुर्ताज़, जयपुर',
  },
};

// Scripted statements, used when AI is off or fails. Each sentence has a condition:
// 'all' always; 'chat' only when E5 is the sample chat; 'attach' only when E5 is a tagged
// upload; 'nochat' whenever E5 is not the sample chat.
// The attach sentence names "our conversation" only when the merchant tagged the upload as
// the exchange request, so the statement never claims more than the merchant said.
export const SCRIPTED = {
  en: {
    full: [
      ['all', 'I run Kesar Kurtas, an online clothing store in Jaipur.'],
      ['all', 'On 14 Sep 2026 the customer paid ₹1,800 by UPI for order KK-2417, a cotton kurta set in size M [E1][E2].'],
      ['all', 'It was delivered on 18 Sep, and the recipient confirmed delivery with an OTP [E3].'],
      ['chat', 'On 19 Sep the customer asked to exchange it for size L [E5].'],
      ['all', 'Our published policy offers a free size exchange within 7 days, with the customer paying the ₹120 return courier [E4].'],
      ['attach', { exchange: 'I have attached a screenshot of our conversation [E5].', other: 'I have also attached a screenshot from my phone [E5].' }],
      ['chat', 'The customer refused to pay this charge and said they would file a complaint [E5].'],
      ['chat', 'This is a dispute about an exchange, not a fraud: the product was ordered, paid for and delivered.'],
      ['nochat', 'The product was ordered, paid for and delivered, and we offer exchanges under this policy, so this is not a fraud.'],
      ['all', 'I request that the hold of ₹1,800 be released.'],
      ['all', 'I am ready to exchange the product as per our policy and can join a video call at any time.'],
    ],
    shorter: {
      chat: 'Order KK-2417 (₹1,800, paid by UPI on 14 Sep) was delivered on 18 Sep with OTP confirmation [E1][E2][E3]. On 19 Sep the customer asked to exchange size M for L but refused the ₹120 return courier charge in our published policy [E4][E5]. This is an exchange dispute, not fraud. I request release of the ₹1,800 hold and am available for a video call.',
      nochat: 'Order KK-2417 (₹1,800, paid by UPI on 14 Sep) was delivered on 18 Sep with OTP confirmation [E1][E2][E3]. Our published policy offers a free size exchange within 7 days [E4]. The product was ordered, paid for and delivered, so this is not a fraud. I request release of the ₹1,800 hold and am available for a video call.',
      attach: { exchange: ' A screenshot of our conversation is attached [E5].', other: ' A screenshot from my phone is attached [E5].' },
    },
  },
  hi: {
    full: [
      ['all', 'मैं जयपुर में केसर कुर्ताज़ नाम से कपड़ों की ऑनलाइन दुकान चलाता हूँ।'],
      ['all', '14 सितंबर 2026 को ग्राहक ने ऑर्डर KK-2417 (कॉटन कुर्ता सेट, साइज़ M) के लिए UPI से ₹1,800 का भुगतान किया [E1][E2]।'],
      ['all', 'ऑर्डर 18 सितंबर को डिलीवर हुआ और प्राप्तकर्ता ने OTP से इसकी पुष्टि की [E3]।'],
      ['chat', '19 सितंबर को ग्राहक ने इसे साइज़ L से बदलने को कहा [E5]।'],
      ['all', 'हमारी प्रकाशित नीति में 7 दिन के भीतर साइज़ बदलना मुफ़्त है, केवल ₹120 वापसी कूरियर ग्राहक देता है [E4]।'],
      ['attach', { exchange: 'हमारी बातचीत का स्क्रीनशॉट संलग्न है [E5]।', other: 'मैंने अपने फ़ोन से एक स्क्रीनशॉट भी संलग्न किया है [E5]।' }],
      ['chat', 'ग्राहक ने यह शुल्क देने से मना किया और शिकायत करने की बात कही [E5]।'],
      ['chat', 'यह एक्सचेंज को लेकर विवाद है, धोखाधड़ी नहीं: सामान ऑर्डर हुआ, भुगतान हुआ और डिलीवर हुआ।'],
      ['nochat', 'सामान ऑर्डर हुआ, भुगतान हुआ और डिलीवर हुआ, और हम इस नीति के तहत बदलाव देते हैं, इसलिए यह धोखाधड़ी नहीं है।'],
      ['all', 'मेरा अनुरोध है कि ₹1,800 की रोक हटाई जाए।'],
      ['all', 'मैं नीति के अनुसार सामान बदलने को तैयार हूँ और किसी भी समय वीडियो कॉल पर जुड़ सकता हूँ।'],
    ],
    shorter: {
      chat: 'ऑर्डर KK-2417 (₹1,800, 14 सितंबर को UPI से भुगतान) 18 सितंबर को OTP पुष्टि के साथ डिलीवर हुआ [E1][E2][E3]। 19 सितंबर को ग्राहक ने साइज़ M को L से बदलने को कहा, पर हमारी प्रकाशित नीति का ₹120 वापसी कूरियर शुल्क देने से मना किया [E4][E5]। यह एक्सचेंज विवाद है, धोखाधड़ी नहीं। कृपया ₹1,800 की रोक हटाएँ; मैं वीडियो कॉल के लिए उपलब्ध हूँ।',
      nochat: 'ऑर्डर KK-2417 (₹1,800, 14 सितंबर को UPI से भुगतान) 18 सितंबर को OTP पुष्टि के साथ डिलीवर हुआ [E1][E2][E3]। हमारी प्रकाशित नीति में 7 दिन के भीतर साइज़ बदलना मुफ़्त है [E4]। सामान ऑर्डर हुआ, भुगतान हुआ और डिलीवर हुआ, इसलिए यह धोखाधड़ी नहीं है। कृपया ₹1,800 की रोक हटाएँ; मैं वीडियो कॉल के लिए उपलब्ध हूँ।',
      attach: { exchange: ' हमारी बातचीत का स्क्रीनशॉट संलग्न है [E5]।', other: ' मेरे फ़ोन का एक स्क्रीनशॉट संलग्न है [E5]।' },
    },
  },
};

// "Advance time" stages after the merchant submits. Stage 0 is "submitted, not yet filed".
export const STAGES = [
  { date: 'Mon 5 Oct' },
  {
    date: 'Tue 6 Oct',
    push: { title: 'Grievance filed', body: 'Your response on KK-2417 is on the national grievance portal. The officer has 15 days to decide.', open: 'tracker' },
  },
  {
    date: 'Fri 9 Oct',
    push: { title: 'Video call booked', body: 'Investigating officer, Cyber Crime PS Lucknow. Wed 14 Oct, 11:30 AM. Tap to prepare.', open: 'tracker' },
  },
  {
    date: 'Fri 16 Oct',
    push: { title: 'Hold lifted: ₹1,800 is yours', body: 'It will be added to your settlement on Sat 17 Oct.', open: 'outcome' },
  },
];

export const OUTCOME = { creditedOn: 'Sat 17 Oct', releasedOn: 'Fri 16 Oct 2026', daysOnHold: 11 };

/**
 * The tracker timeline for a stage (0 = submitted, 1 = filed, 2 = call booked, 3 = released).
 * `sentIn` is the measured alert-to-submit time, e.g. "1 min 24 s", or null if not measured.
 * Each item: { title, state: 'done'|'now'|'next'|'faded', when, text, checklist? }
 */
export function timeline(stage, sentIn) {
  const released = stage >= 3;
  const later = released ? 'faded' : 'next';
  const byVideo = 'Usually by video call, so you won’t need to travel to Lucknow.';
  return [
    { title: 'Hold placed', state: 'done', when: 'Mon 5 Oct', text: '₹1,800 held at the request of Cyber Crime PS, Lucknow.' },
    {
      title: 'You responded',
      state: 'done',
      when: 'Mon 5 Oct',
      text: sentIn ? `Case file and statement sent in ${sentIn}.` : 'Case file and statement sent from your phone.',
    },
    stage >= 1
      ? { title: 'Filed on the national grievance portal', state: 'done', when: 'Tue 6 Oct', text: 'Reference GRM/2026/LKO/58213.' }
      : { title: 'Filed on the national grievance portal', state: 'now', when: 'By Mon 12 Oct', text: 'We file it for you. Nothing for you to do.' },
    released
      ? { title: 'Officer decides', state: 'done', when: 'Fri 16 Oct', text: 'Hold released. No further action.' }
      : stage === 2
        ? {
            title: 'Officer decides',
            state: 'now',
            when: 'By Wed 21 Oct',
            text: 'Video call booked for Wed 14 Oct, 11:30 AM.',
            checklist: [
              'Keep this case file open',
              'Join from a quiet place with your ID nearby',
              'We’ll remind you 30 minutes before',
            ],
          }
        : stage === 1
          ? { title: 'Officer decides', state: 'now', when: 'By Wed 21 Oct', text: byVideo }
          : { title: 'Officer decides', state: 'next', when: '15 days after filing', text: byVideo },
    { title: 'If no decision: District Grievance Officer', state: later, when: stage >= 1 ? 'By Thu 5 Nov' : '15 days later', text: '' },
    { title: 'Day 75 check', state: later, when: 'Sat 19 Dec', text: 'We remind you and confirm the status.' },
    { title: 'Day 90: the hold must end', state: later, when: 'Sun 3 Jan 2027', text: 'A contested hold lapses unless police get a legal order to extend it.' },
  ];
}

// ───────────── Follow-up agent ─────────────

// Fixed facts about what happens after the merchant submits. The server builds the agent's
// prompts from these; the browser never sends any of them. Dates are ISO (YYYY-MM-DD).
export const AGENT_FACTS = {
  holdOn: '2026-10-05',
  grievanceRef: 'GRM/2026/LKO/58213',
  filedOn: '2026-10-06',
  officerRequest: "Please share proof of delivery and the customer's messages about the exchange.",
  callOn: '2026-10-14',
  callTime: '11:30 AM',
};

// The two demo stories. Step 0 is "just submitted". Each later step moves the date on and may
// add events; the rules in agent.js decide what the agent proposes at each step.
const FILED_PUSH = {
  title: 'Grievance filed',
  body: 'Your response on KK-2417 is on the national grievance portal. The officer has 15 days to decide.',
  open: 'tracker',
};
export const SCENARIOS = {
  responds: [
    { on: '2026-10-05' },
    { on: '2026-10-06', events: [{ type: 'filed' }], push: FILED_PUSH },
    { on: '2026-10-09', events: [{ type: 'officer_request' }] },
    { on: '2026-10-12', events: [{ type: 'call_booked', callOn: AGENT_FACTS.callOn, callTime: AGENT_FACTS.callTime }] },
    { on: '2026-10-16', events: [{ type: 'released' }] },
  ],
  quiet: [
    { on: '2026-10-05' },
    { on: '2026-10-06', events: [{ type: 'filed' }], push: FILED_PUSH },
    { on: '2026-10-22' },
    { on: '2026-11-06', push: { title: 'Still waiting on KK-2417', body: 'No direction yet. Your agent is watching Day 75 and Day 90.', open: 'tracker' } },
    { on: '2027-01-03' },
    { on: '2027-01-05', events: [{ type: 'released' }] },
  ],
};

// How each kind of agent work is named across the app.
export const AGENT_COPY = {
  officer_reply: {
    title: 'Reply to the officer',
    ready: 'Your reply to the officer is ready',
    badge: 'Reply ready',
    drafted: 'Drafted a reply to the officer',
    sentTo: 'the investigating officer',
    via: 'via the grievance portal',
    push: { title: 'Officer asked for delivery proof', body: 'Your reply is ready. Tap to review.' },
  },
  call_brief: {
    title: 'Your call brief',
    ready: 'Your call brief is ready',
    badge: 'Brief ready',
    drafted: 'Prepared your call brief',
    push: { title: 'Video call on Wed 14 Oct', body: 'Your 1-minute brief is ready.' },
  },
  escalation: {
    title: 'Request for review',
    ready: 'Your request for review is ready',
    badge: 'Review ready',
    drafted: 'Drafted a request for review by the District Grievance Officer',
    sentTo: 'the District Grievance Officer',
    via: 'via the grievance portal',
    push: { title: 'No decision in 15 days', body: 'Your request for review is ready.' },
  },
  release_request: {
    title: 'Release request',
    ready: 'Your release request is ready',
    badge: 'Release request ready',
    drafted: 'Drafted a request to lift the hold under the 90-day limit',
    sentTo: 'our grievance desk, copied to the officer',
    via: '',
    push: { title: 'Day 90 reached', body: 'Your release request is ready.' },
  },
};

// Letter headings for the agent's messages. The call brief is for the merchant only.
export const AGENT_LETTERS = {
  officer_reply: {
    en: { to: 'To the Investigating Officer, Cyber Crime Police Station, Lucknow', re: 'Re: complaint 3120926••••0471 · hold of ₹1,800 on order KK-2417' },
    hi: { to: 'सेवा में, जाँच अधिकारी, साइबर क्राइम थाना, लखनऊ', re: 'विषय: शिकायत 3120926••••0471 · ऑर्डर KK-2417 पर ₹1,800 की रोक' },
  },
  escalation: {
    en: { to: 'To the District Grievance Officer', re: 'Re: grievance GRM/2026/LKO/58213 · hold of ₹1,800 on order KK-2417' },
    hi: { to: 'सेवा में, ज़िला शिकायत निवारण अधिकारी', re: 'विषय: अनुरोध GRM/2026/LKO/58213 · ऑर्डर KK-2417 पर ₹1,800 की रोक' },
  },
  release_request: {
    en: { to: 'To: Grievance desk · Cc: Investigating Officer, Cyber Crime PS, Lucknow', re: 'Re: hold of ₹1,800 on order KK-2417 · 90-day limit' },
    hi: { to: 'सेवा में: शिकायत निवारण डेस्क · प्रतिलिपि: जाँच अधिकारी, साइबर क्राइम थाना, लखनऊ', re: 'विषय: ऑर्डर KK-2417 पर ₹1,800 की रोक · 90 दिन की सीमा' },
  },
};

// The call brief's fixed parts. The rules choose the questions; AI writes only the answers and the tip.
export const CALL_BRIEF = {
  en: {
    title: 'Video call with the investigating officer · Wed 14 Oct, 11:30 AM',
    keep: 'Keep ready: this case file open on your phone, and your ID.',
    questionsLabel: 'Likely questions',
    questions: ['What did the customer buy, and when?', 'Was it delivered?', "Why wasn't the money refunded?"],
  },
  hi: {
    title: 'जाँच अधिकारी के साथ वीडियो कॉल · बुधवार 14 अक्टूबर, सुबह 11:30',
    keep: 'तैयार रखें: फ़ोन पर यह केस फ़ाइल खुली रखें, और अपना पहचान पत्र।',
    questionsLabel: 'संभावित सवाल',
    questions: ['ग्राहक ने क्या ख़रीदा, और कब?', 'क्या डिलीवरी हुई?', 'पैसे वापस क्यों नहीं किए गए?'],
  },
};

// Scripted fallbacks for the agent, used when AI is off or fails. Conditions, as for the statement:
//   'all' · 'chat' (E5 is the sample chat) · 'nochat' · 'attach' (E5 is a tagged upload)
//   'messages' (E5 shows the exchange request) · 'nomessages'
// The Hindi versions are faithful translations of the English; IDs, ₹ amounts and tags are unchanged.
export const AGENT_SCRIPTED = {
  officer_reply: {
    en: [
      ['all', 'Thank you for your message.'],
      ['chat', "As requested, I am sharing the proof of delivery and the customer's messages about the exchange."],
      ['nochat', 'As requested, I am sharing the proof of delivery.'],
      ['all', 'The order was delivered on 18 Sep 2026 and the recipient confirmed delivery with an OTP [E3].'],
      ['chat', 'On 19 Sep the customer asked to exchange size M for L and refused the ₹120 return courier charge in our published policy [E4][E5].'],
      ['nochat', 'Our published policy offers a free size exchange within 7 days, with the customer paying the ₹120 return courier [E4].'],
      ['attach', { exchange: 'A screenshot of my conversation with the customer is attached [E5].', other: 'I have also attached a screenshot from my phone [E5].' }],
      ['nomessages', "I will share the customer's messages as soon as I can."],
      ['all', 'I am happy to join a video call at your convenience, and I request that the hold of ₹1,800 be released.'],
    ],
    hi: [
      ['all', 'आपके संदेश के लिए धन्यवाद।'],
      ['chat', 'आपके कहे अनुसार, मैं डिलीवरी का प्रमाण और एक्सचेंज के बारे में ग्राहक के संदेश साझा कर रहा हूँ।'],
      ['nochat', 'आपके कहे अनुसार, मैं डिलीवरी का प्रमाण साझा कर रहा हूँ।'],
      ['all', 'ऑर्डर 18 सितंबर 2026 को डिलीवर हुआ और प्राप्तकर्ता ने OTP से इसकी पुष्टि की [E3]।'],
      ['chat', '19 सितंबर को ग्राहक ने साइज़ M को L से बदलने को कहा और हमारी प्रकाशित नीति का ₹120 वापसी कूरियर शुल्क देने से मना किया [E4][E5]।'],
      ['nochat', 'हमारी प्रकाशित नीति में 7 दिन के भीतर साइज़ बदलना मुफ़्त है, केवल ₹120 वापसी कूरियर ग्राहक देता है [E4]।'],
      ['attach', { exchange: 'ग्राहक के साथ मेरी बातचीत का स्क्रीनशॉट संलग्न है [E5]।', other: 'मैंने अपने फ़ोन से एक स्क्रीनशॉट भी संलग्न किया है [E5]।' }],
      ['nomessages', 'मैं ग्राहक के संदेश जल्द से जल्द साझा करूँगा।'],
      ['all', 'मैं आपकी सुविधा से वीडियो कॉल पर जुड़ने को तैयार हूँ, और मेरा अनुरोध है कि ₹1,800 की रोक हटाई जाए।'],
    ],
  },
  escalation: {
    en: [
      ['all', 'I request a review of the hold of ₹1,800 on order KK-2417.'],
      ['all', 'My grievance was filed on the national grievance portal on 6 Oct 2026, and no decision has been shared within 15 days.'],
      ['all', 'The order was paid for, delivered with OTP confirmation and is covered by our published exchange policy [E1][E3][E4].'],
      ['chat', 'The complaint arose from a disagreement about a ₹120 return courier charge [E5].'],
      ['attach', { exchange: 'A screenshot of my conversation with the customer about the exchange is attached [E5].', other: 'I have also attached a screenshot from my phone [E5].' }],
      ['all', 'I request that the hold be reviewed and released.'],
    ],
    hi: [
      ['all', 'मैं ऑर्डर KK-2417 पर ₹1,800 की रोक की समीक्षा का अनुरोध करता हूँ।'],
      ['all', 'मेरा अनुरोध 6 अक्टूबर 2026 को राष्ट्रीय शिकायत निवारण पोर्टल पर दर्ज हुआ था, और 15 दिनों में कोई निर्णय नहीं बताया गया है।'],
      ['all', 'ऑर्डर का भुगतान हुआ, OTP पुष्टि के साथ डिलीवरी हुई, और यह हमारी प्रकाशित एक्सचेंज नीति के अंतर्गत आता है [E1][E3][E4]।'],
      ['chat', 'यह मामला ₹120 वापसी कूरियर शुल्क पर असहमति से शुरू हुआ [E5]।'],
      ['attach', { exchange: 'एक्सचेंज के बारे में ग्राहक के साथ मेरी बातचीत का स्क्रीनशॉट संलग्न है [E5]।', other: 'मैंने अपने फ़ोन से एक स्क्रीनशॉट भी संलग्न किया है [E5]।' }],
      ['all', 'मेरा अनुरोध है कि रोक की समीक्षा करके इसे हटाया जाए।'],
    ],
  },
  release_request: {
    en: [
      ['all', 'The hold of ₹1,800 on order KK-2417 was placed on 5 Oct 2026.'],
      ['all', 'Ninety days have now passed, and I have not been told of any direction to continue it.'],
      ['all', 'I request that the hold be lifted and the amount added to my next settlement.'],
      ['all', 'My grievance and evidence are on file under reference GRM/2026/LKO/58213 [E1][E3].'],
    ],
    hi: [
      ['all', 'ऑर्डर KK-2417 पर ₹1,800 की रोक 5 अक्टूबर 2026 को लगाई गई थी।'],
      ['all', 'अब नब्बे दिन बीत चुके हैं, और मुझे इसे जारी रखने के किसी निर्देश की जानकारी नहीं दी गई है।'],
      ['all', 'मेरा अनुरोध है कि रोक हटाई जाए और राशि मेरे अगले सेटलमेंट में जोड़ी जाए।'],
      ['all', 'मेरा अनुरोध और प्रमाण संदर्भ GRM/2026/LKO/58213 के तहत दर्ज हैं [E1][E3]।'],
    ],
  },
  // Call brief answers, in the "A1 / A2 / A3 / TIP" shape the AI also uses.
  call_brief: {
    en: {
      a1: 'A cotton kurta set, size M, paid ₹1,800 by UPI on 14 Sep [E1][E2].',
      a2: 'Yes, on 18 Sep, and the recipient confirmed it with an OTP [E3].',
      a3: { messages: 'We offered a free size exchange; our published policy asks the customer to pay the ₹120 return courier [E4][E5].', nomessages: 'We offer a free size exchange; our published policy asks the customer to pay the ₹120 return courier [E4].' },
      tip: "Say plainly that you're willing to exchange the product as per your policy.",
    },
    hi: {
      a1: 'एक कॉटन कुर्ता सेट, साइज़ M; 14 सितंबर को UPI से ₹1,800 का भुगतान [E1][E2]।',
      a2: 'हाँ, 18 सितंबर को, और प्राप्तकर्ता ने OTP से पुष्टि की [E3]।',
      a3: { messages: 'हमने साइज़ मुफ़्त में बदलने की पेशकश की; हमारी प्रकाशित नीति में ₹120 वापसी कूरियर ग्राहक देता है [E4][E5]।', nomessages: 'हम साइज़ मुफ़्त में बदलते हैं; हमारी प्रकाशित नीति में ₹120 वापसी कूरियर ग्राहक देता है [E4]।' },
      tip: 'साफ़ कहें कि आप अपनी नीति के अनुसार सामान बदलने को तैयार हैं।',
    },
  },
};

// The proof each agent message may cite, from its sentence plan. Any other tag the model writes is dropped.
export const AGENT_TAGS = {
  officer_reply: ['E3', 'E4', 'E5'],
  escalation: ['E1', 'E3', 'E4', 'E5'],
  release_request: ['E1', 'E3'],
  call_brief: ['E1', 'E2', 'E3', 'E4', 'E5'],
};
