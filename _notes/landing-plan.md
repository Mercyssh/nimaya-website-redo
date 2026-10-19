# Home landing: plan and image brief (19 Oct 2026)

Source: the website call of 14 Oct (Samyak). In short, the site feels "too sweet, too NGO-ish"
and should feel grand. That means real Naaris, but packaged more seriously, plus visible scale.
The fonts stay as they are.

## What's built now (not committed)

1. **New landing at the top of Home**, at full screen height:
   - The word "Nimaya", the line "Making every Naari Future Ready", and the two buttons.
   - Three tall photos behind: Naaris as an audience, a Naari speaking up, and a Naari on stage.
   - On phones the photos cross-fade one at a time, every 5 s.
   - **Two looks to compare.** Switch with the "Look" button in the bottom-right corner, or open `/?look=light`.
     - **Dark**: the photos run full-bleed under an ink shade, the type is white, and the top bar turns transparent over the photos.
     - **Light**: the photos sit as three tall cards on the cream background, with ink type.
2. **Map section, directly below the landing.** It's unchanged except for:
   - The title is now "Naaris across India".
   - The buttons moved up into the landing.
3. **Our Why**:
   - The quote now sits directly under the title.
   - The photo cross-fades between 4 Naaris speaking up, every 4 s, only while the section is on screen.

Once a look is chosen, remove the look button and the `?look=` code (marked TEMP in `index.html`, `main.js` and `style.css`).

## Still to decide or do

- **Third photo (industry).** Samyak asked for one at PepsiCo. Usable candidates are on the Drive ("MM OF NIMAYA 01"):
  - `July 01 MM/IMG_8607.jpeg`: Naaris at workstations in a corporate office. This is the best fit.
  - `Jan 07 MM/Naaris presenting her work.HEIC`: a Naari presenting in a boardroom.
  - `April 23 MM/IMG_7419.jpeg`: a full computer lab. This could also stand in for "learning".
  - All three are phone photos. Please download the originals (not screenshots) into `D:\Downloads\Photodump\Drive picks\` and I'll grade and crop them.
- **Different cities.** Every landing photo is from Guwahati. Samyak's idea was "Naaris in Assam, Gujarat…". Once photos from other cities exist, give each panel a small city caption.
- **The AI layer** ("how AI runs Nimaya" behind the Naaris). The call settled on keeping it as its own section below the map ("We don't want to merge both"), so the landing stays human. Its section can be made grander next.

## Image treatment: what would help, if you're editing

Grading and cropping are already done on my side. These need a hand edit (Photoshop Generative Fill or the Remove tool works):

| Photo | Edit | Why |
|---|---|---|
| `hero-voice` (from `_LEN4928`) | Remove the black video camera and the man's head in the bottom right | They pull the eye away from her face |
| `hero-stage` (from `_LEN4920`) | Remove the dark screen edge along the right side | It reads as a black bar next to her |
| `hero-audience` (from `DSC_9407`) | Remove the man's head and shoulder in the bottom-left corner | It's the only man in a Naari audience shot |
| Any industry photo (above) | Straighten the verticals, crop out ceiling lights, and remove name badges if they show surnames | Phone shots look snapshot-y without this |

Send the edited full-size JPGs back with the same file names and I'll re-export them.
For the dark look in particular, photos where faces sit in the **upper two-thirds** of the frame work best, because the text covers the lower third.
