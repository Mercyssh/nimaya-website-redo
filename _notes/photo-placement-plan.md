# Photo placement plan: Guwahati shoot (Oct 2026)

Source: `D:\Downloads\Photodump\_Shortlist\_Graded\` (97 graded photos, A_ = strongest).
File names below are the graded files without the tier prefix. All photos are from Assam / Guwahati.

Rule kept from `needed-from-nimaya.md`: each photo used once across the site.

## 1. Swaps (existing slots)

| # | Page / slot | Now | New photo | Why / crop |
|---|---|---|---|---|
| 1 | Home: hero map, Guwahati photo + `reach-data.js` guwahati `photo` (also feeds the Impact map) | naaris-computer.webp | `day 1/_LEN4487` Naaris filming on their phones | Real Guwahati Naaris, mid-moment. 4:3, crop to the two front faces |
| 2 | Home: Our Why (near-square) | blue-jacket-naari.webp (used on 3 pages) | `R.G Baruah GenAI/DSC_9409` Naari with mic, standing in the crowd | One Naari mid-speech, which is what the notes ask for. Crop square, subject on the right third. Alt: `day 2/_LEN4928` |
| 3 | Home: How We Work 1, Outreach (3:4) | work-1.png | `R.G Baruah GenAI/DSC_9557` NCC welcome on arrival at the college | Shows the college partnership. Portrait crop on Navya and the cadets |
| 4 | Home: How We Work 2, Engagement (3:4) | naari-presenting.webp | `day 1/DSC_3239` Navya and Samyak facing a full room | An orientation session in one frame. Portrait crop on the two of them |
| 5 | Home: How We Work 4, Program Delivery (3:4) | work-4.png (252px wide, too small) | `day 1/DSC_3228` Naari standing, speaking to the room | Classroom session. Portrait crop on her |
| 6 | About: hero (5:4) | naaris-working.webp (duplicate of the home program card) | `day 2/_LEN5010` Navya and Samyak among Naaris | Founders with Naaris (item 3 in the needed list) |
| 7 | Impact: hero (5:4) | blue-jacket-naari.webp | `R.G Baruah GenAI/DSC_9508` Hands up across the hall | Shows scale and energy |
| 8 | Careers: hero (5:4) | naaris-computer.webp | `R.G Baruah GenAI/DSC_9448` Samyak and Navya laughing on stage | Warm and human, which suits a "work with us" page |
| 9 | Contact: hero (5:4) | naari-phone.webp | `R.G Baruah GenAI/DSC_9519` Samyak among smiling Naaris | Approachable, which suits a "partner with us" page |
| 10 | GenAI Ready Naari: hero | naaris-laptop.webp (duplicate of the Mumbai map photo) | `day 2/_LEN4982` Two Naari panelists, program banner behind | The "GenAI Ready Naari Program" banner is in frame |
| 11 | Fellowship: pillar 02, Masterclasses (4:3) | blue-jacket-naari.webp | `R.G Baruah GenAI/DSC_9442` Samyak talking with Naari panelists | An expert talking with Naaris. Caveat: this is a GenAI program event, not the Fellowship |

After these swaps, blue-jacket-naari.webp, work-1.png and work-4.png are no longer used.
naaris-computer, naaris-working, naari-phone and naaris-laptop each drop to one use.

## 2. Keep as is (no good match in this shoot)

- **Home: Program 1 card.** The laptop classroom shows the program better than an event photo. Fallback: `_LEN5003` cohort group photo.
- **Home: How We Work 3 (Candidate Selection), 5 (Placement), 6 (Alumni).** Nothing like this was shot. Optional for 6: `day 2/_LEN5024` (Naari selfie with Navya), which shows community rather than alumni.
- **Fellowship: hero, pillars 01, 03, 04.** No Fellowship photos in this shoot.
- **Milestones, Voices, testimonials, team, stories.** These are icons, video or headshots.

## 3. Optional new spots

- **Impact > Regional reach:** a small "Guwahati, Oct 2026" strip of 3 under the map: `DSC_9517` (whole-hall group), `_LEN4920` (Naari panelist), `_LEN4402` (smiling Naari, hand raised).
- **GenAI Ready Naari > Voices across cities:** a still to sit beside the videos until Assamese videos arrive: `DSC_9414` (Naari speaking, standing).
- **About > Press/Media:** `_LEN4876` (Navya and Samyak by the program banner) as a launch photo.

## 4. Do not use (for now)

- **World Mental Health Day folder** (`DSC_96xx`–`98xx`). This was a college event, not a Nimaya one: mixed audience, and the speakers are not from Nimaya. The girls in it may not be Naaris. Confirm with Nimaya before using any of these, even the strong portraits (`DSC_9601`, `DSC_9865`, `DSC_9764`).
- **Low-res day 1 frames** (`_LEN4299`–`4459`, 1968×1312) are fine for cards but not for full-width or hero use. `DSC_9418` (Navya at podium) is only 1920×1080. Ask the photographer for the full-size files.

## 5. Still missing after this shoot

- Photos of the other cities for the hero map: Mumbai, Haryana, Lucknow, Ahmedabad, Jaipur, Varanasi.
- Naaris doing hands-on GenAI work (laptops or phones mid-task in a session).
- Candidate interviews, a first day at work, alumni meetups.
- Anything from the Fellowship.
- `naari-presenting.webp` is still used twice (Fellowship hero + Jaipur map), and `placement.webp` is used 4 times.

## 6. When implementing

- Export each photo as WebP at about 1400px on the long edge (q ~80) into `assets/img/photos/`, named by content, e.g. `guwahati-naaris-phones.webp`.
- Update `width`/`height` and alt text. Set `object-position` where the crop notes above say so.
- Clear the `TODO` on the Guwahati entry in `js/reach-data.js`.
- Confirm the day 1 venue name with Nimaya (pink uniforms, "iti" badge) for alt text and captions.
