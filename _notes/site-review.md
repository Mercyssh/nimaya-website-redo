# Site review: 20 Oct 2026

Local build reviewed on desktop (1024px) and phone (375px), across all 7 pages.

**What passed:**
- No broken internal links or images.
- No console errors.
- No sideways scrolling on phones.
- Every page has one H1, alt text on its images, and a meta description.

## Fix before launch
1. **Temporary "Look" button** is still on the Home landing.
2. **No `og:image`** on any page, so shared links show no preview image.
3. **Unused animation on Home.** It loads `assets/lottie/hero.js`, about 1.3 MB and a quarter of the page weight, but never uses it.
4. **Empty footer logo link on Home** (`href=""`).
5. **Sample chart data on Impact.** The before/after chart still shows sample figures (labelled as such). Hide it until the real survey data arrives.
6. **Out-of-date schedule on GenAI.** It says "June – July 2026" (sample dates), which are now in the past.
7. **Claims that don't match:**
   - "PepsiCo and JCL" in Milestones, but a Jio logo on the program pages.
   - The Fellowship says "Guaranteed placement", "Placement support*" and "Placement linked" in different places.

## Design
8. **Inner pages still have the old "sweet" look.** Stickers, sparkles, blobs and cut-out portraits on plain backgrounds don't match the new, grander Home landing. This shows most in the inner page heroes.
9. **Clip-art and stock-style graphics:**
   - The 3D clip-art icons in GenAI ("What Naaris Gain") and Contact ("Ways to Partner").
   - The purple-framed graphics in the Milestones tiles.
10. **Photos used too often:**
    - The PepsiCo group photo appears 4 times: Milestones, How We Work, GenAI, and the Fellowship "Jumpstart" section.
    - The Fellowship uses a GenAI event photo.
    - Amisha's cut-out is on both Home and Impact.
    - The same two videos appear on Home and GenAI, and another two on About and Impact.
11. **How We Work, Home:** step 3 is a Zoom screenshot and step 6 is a cut-out on pink. Both clash with the real photos around them.
12. **AI section, Home:** at 1024px and below, the network diagram stacks under the steps and looks small in a large dark area.
13. **Program cards, Home:** the fact rows are cramped at 1024px. "16+ skills" and "Future CXOs" wrap, and the descriptions are squeezed to the right.
14. **"Naaris across India":** "India" sits alone on its own line.
15. **Top bar while scrolling, Home:** just past the landing, the light bar briefly overlaps the dark landing, and the links are hard to read there.

## Content
16. **Fellowship curriculum** repeats the GenAI curriculum word for word. Link to it instead.
17. **"Success Stories"** on the Fellowship page has only one story.
18. **GenAI "Voices":** the line "Next up: stories from Guwahati…" reads as a public placeholder.
19. **Press cards on About** are text only. Add outlet logos, dates or thumbnails.
20. **Careers headline** reads "Build a career that builds *Careers*". The word repeats.
21. **Contact page** has email links only: no form, phone number or address.
22. **Splash timing.** The splash now plays on every load, adding about 3 s before every visit. Consider once per session after launch.
