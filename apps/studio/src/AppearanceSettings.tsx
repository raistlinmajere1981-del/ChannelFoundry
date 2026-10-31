import { useState } from "react";
import {
  readStudioAppearance, saveStudioAppearance,
  type StudioAppearance, type StudioTextSize, type StudioTheme,
} from "./studio-appearance";

const sizes: { value: StudioTextSize; title: string }[] = [
  { value: "standard", title: "Standart" },
  { value: "comfortable", title: "Rahat" },
  { value: "large", title: "Büyük" },
];
const themes: { value: StudioTheme; title: string }[] = [
  { value: "dark", title: "Koyu" },
  { value: "light", title: "Açık" },
];

export default function AppearanceSettings() {
  const [appearance, setAppearance] = useState<StudioAppearance>(() => readStudioAppearance());
  const update = (patch: Partial<StudioAppearance>) => {
    const next = saveStudioAppearance({ ...appearance, ...patch });
    setAppearance(next);
  };
  return <section className="studio-compact-settings" aria-label="Studio görünümü">
    <h3>Görünüm</h3>
    <fieldset>
      <legend>Tema</legend>
      <div className="studio-segment-row">
        {themes.map((option) => <button key={option.value} type="button" aria-pressed={appearance.theme === option.value} className={appearance.theme === option.value ? "active" : ""} onClick={() => update({ theme: option.value })}>{option.title}</button>)}
      </div>
    </fieldset>
    <fieldset>
      <legend>Metin boyutu</legend>
      <div className="studio-segment-row">
        {sizes.map((option) => <button key={option.value} type="button" aria-pressed={appearance.textSize === option.value} className={appearance.textSize === option.value ? "active" : ""} onClick={() => update({ textSize: option.value })}>{option.title}</button>)}
      </div>
    </fieldset>
  </section>;
}
