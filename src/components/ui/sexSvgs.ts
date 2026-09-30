// Gender marks in Bilibili's style: a small solid circle in the gender colour
// with a white symbol on top (male slanted, female upright). Drawn as SVG so
// they stay crisp and pick up the theme's contrast on top of a banner.

/** 女 — pink disc + white ♀. */
export const SEX_FEMALE_SVG = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
<circle cx="8" cy="8" r="8" fill="#FB7299"/>
<g fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round">
  <circle cx="8" cy="6.1" r="2.9"/>
  <path d="M8 9v4.1M5.95 11.1h4.1"/>
</g>
</svg>`;

/** 男 — blue disc + white ♂ (slanted). */
export const SEX_MALE_SVG = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
<circle cx="8" cy="8" r="8" fill="#4AC7FF"/>
<g fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="6.3" cy="9.7" r="2.9"/>
  <path d="M8.5 7.5 12.6 3.4"/>
  <path d="M9.5 3.4h3.1v3.1"/>
</g>
</svg>`;

export function sexSvg(sex: string): string | null {
  if (sex === "男") return SEX_MALE_SVG;
  if (sex === "女") return SEX_FEMALE_SVG;
  return null;
}
