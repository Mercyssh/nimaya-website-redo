/* Where Nimaya works: one entry per pin group on the reach map (Home + Impact).
 *
 * name / state  card heading (state also decides which state is shaded)
 * subtitle      optional line under the name instead of the state
 * points        [longitude, latitude] for each pin; the card anchors to the first
 * lines         one row per program in that place: a highlighted number (optional) + what it means
 * partners      logo files in assets/img/logos (or assets/img for partner-*.png)
 * photo         optional photo (under assets/) shown in the city card on the home page
 * label         side of the pin its name sits on in the home atlas: right (default) | left | top | bottom
 * status        "live" (filled pin) | "new" (just launched) | "soon" (hollow pin, coming soon)
 * open          card is open when the map first appears (keep to 2-3 that don't overlap)
 * side          preferred placement for the card: right | left | top | bottom, optionally with
 *               the way it hangs from the pin (right-down, left-up, bottom-right, top-left, ...)
 */
window.NIMAYA_REACH = [
  {
    id: "mumbai",
    label: "left",
    photo: "img/photos/naaris-laptop.webp", // TODO: swap for a photo taken in this city
    photoAlt: "Naaris working together on a laptop",
    name: "Mumbai",
    state: "Maharashtra",
    points: [[72.8777, 19.076]],
    lines: [
      { num: "400", text: "women trained in GenAI & startup skills" },
      { num: "100", text: "constables’ daughters & wives trained for future-ready careers" },
    ],
    partners: ["logos/datamatics.webp", "logos/mumbai-police.webp"],
    status: "live",
    open: true,
    side: "bottom",
  },
  {
    id: "haryana",
    label: "right",
    photo: "img/program-genai.jpg", // TODO: swap for a photo taken in this city
    photoAlt: "Naaris learning on computers",
    name: "Haryana",
    state: "Haryana",
    subtitle: "Faridabad · Kurukshetra · Bahadurgarh · Gurgaon",
    points: [[77.3178, 28.4089], [76.8783, 29.9695], [76.924, 28.6926], [77.0266, 28.4595]],
    lines: [{ num: "4,000", text: "farmers’ daughters skilled for new-age enterprises" }],
    partners: ["logos/ekl.webp"],
    status: "live",
    open: true,
    side: "top-left",
  },

  {
    id: "lucknow",
    label: "right",
    photo: "img/photos/naari-phone.webp", // TODO: swap for a photo taken in this city
    photoAlt: "A Naari working on her phone",
    name: "Lucknow",
    state: "Uttar Pradesh",
    points: [[80.9462, 26.8467]],
    lines: [
      { num: "1,200", text: "women trained for aspirational roles" },
      { num: "50", text: "women cricketers trained in cognitive performance" },
    ],
    partners: ["logos/ashoka.webp", "logos/capri-sports.webp"],
    status: "live",
    open: true,
    side: "right-down",
  },
  {
    id: "varanasi",
    label: "right",
    photo: "img/photos/naaris-working.webp", // TODO: swap for a photo taken in this city
    photoAlt: "Naaris in a computer class",
    name: "Varanasi",
    state: "Uttar Pradesh",
    points: [[82.9739, 25.3176]],
    lines: [{ num: "50", text: "green-skills workers’ daughters in Varanasi & Chandauli empowered as digital leaders" }],
    partners: ["logos/grs.webp"],
    status: "live",
    side: "bottom",
  },

  {
    id: "jaipur",
    label: "left",
    photo: "img/photos/naari-presenting.webp", // TODO: swap for a photo taken in this city
    photoAlt: "Naaris at a workshop",
    name: "Jaipur",
    state: "Rajasthan",
    points: [[75.7873, 26.9124]],
    lines: [{ num: "50", text: "naaris from rural Rajasthan made AI ready" }],
    partners: ["logos/dhara-shakti.webp"],
    status: "live",
    side: "left",
  },
  {
    id: "ahmedabad",
    label: "top",
    photo: "img/photos/placement.webp", // TODO: swap for a photo taken in this city
    photoAlt: "Naaris with their trainers",
    name: "Ahmedabad",
    state: "Gujarat",
    points: [[72.5714, 23.0225]],
    lines: [{ text: "GenAI Ready Naari, in partnership with SEWA" }],
    partners: ["partner-sewa.png"],
    status: "live",
    side: "right",
  },

  {
    id: "guwahati",
    label: "bottom",
    photo: "img/photos/naaris-computer.webp", // TODO: swap for a photo taken in this city
    photoAlt: "Naaris at a computer",
    name: "Guwahati",
    state: "Assam",
    points: [[91.7362, 26.1445]],
    lines: [{ text: "GenAI Ready Naari’s first city in the Northeast" }],
    status: "live",
    side: "bottom",
  },

  {
    id: "nagpur",
    label: "right",
    name: "Nagpur",
    state: "Maharashtra",
    points: [[79.0882, 21.1458]],
    lines: [{ num: "Soon", text: "Next stop for GenAI Ready Naari" }],
    status: "soon",
    side: "right",
  },
  {
    id: "kashmir",
    label: "right",
    name: "Srinagar",
    state: "Jammu & Kashmir",
    points: [[74.7973, 34.0837]],
    lines: [{ num: "Soon", text: "Next stop for GenAI Ready Naari" }],
    status: "soon",
    side: "right",
  },
];
