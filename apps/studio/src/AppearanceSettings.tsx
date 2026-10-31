import { useState } from "react";
import {
  readStudioAppearance, saveStudioAppearance,
  type StudioAppearance,
} from "./studio-appearance";

type Choice<K extends keyof StudioAppearance> = { value: StudioAppearance[K]; title: string };

const fields: Array<{
  key: keyof StudioAppearance;
  label: string;
  options: Array<Choice<keyof StudioAppearance>>;
}> = [
  { key: "theme", label: "Tema", options: [
    { value: "light", title: "Açık" }, { value: "dark", title: "Koyu" }, { value: "soft-dark", title: "Yumuşak" },
  ] },
  { key: "accent", label: "Vurgu", options: [
    { value: "gold", title: "Altın" }, { value: "blue", title: "Mavi" },
    { value: "green", title: "Yeşil" }, { value: "neutral", title: "Nötr" },
  ] },
  { key: "textSize", label: "Metin", options: [
    { value: "standard", title: "Standart" }, { value: "comfortable", title: "Rahat" }, { value: "large", title: "Büyük" },
  ] },
  { key: "density", label: "Yoğunluk", options: [
    { value: "compact", title: "Kompakt" }, { value: "balanced", title: "Dengeli" }, { value: "spacious", title: "Ferah" },
  ] },
  { key: "readingWidth", label: "Okuma satırı", options: [
    { value: "narrow", title: "Dar" }, { value: "medium", title: "Orta" }, { value: "wide", title: "Geniş" },
  ] },
  { key: "contrast", label: "Kontrast", options: [
    { value: "normal", title: "Normal" }, { value: "high", title: "Yüksek" },
  ] },
  { key: "motion", label: "Hareket", options: [
    { value: "normal", title: "Normal" }, { value: "reduced", title: "Azalt" },
  ] },
];

export default function AppearanceSettings() {
  const [appearance, setAppearance] = useState<StudioAppearance>(() => readStudioAppearance());
  const update = <K extends keyof StudioAppearance>(key: K, value: StudioAppearance[K]) => {
    const next = saveStudioAppearance({ ...appearance, [key]: value });
    setAppearance(next);
  };
  return <section className="studio-compact-settings studio-appearance-controls" aria-label="Studio görünümü">
    <h3>Görünüm</h3>
    <div className="studio-appearance-control-grid">
      {fields.map((field) => <fieldset key={field.key}>
        <legend>{field.label}</legend>
        <div className="studio-segment-row" role="group" aria-label={field.label}>
          {field.options.map((option) =>
            <button key={option.value} type="button"
              aria-pressed={appearance[field.key] === option.value}
              className={appearance[field.key] === option.value ? "active" : ""}
              onClick={() => update(field.key, option.value)}>
              {option.title}
            </button>)}
        </div>
      </fieldset>)}
    </div>
  </section>;
}
