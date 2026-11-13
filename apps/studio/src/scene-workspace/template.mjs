// Declarative markup for the Studio-owned scene surface; mounted inside the React host.
export const sceneTemplate = String.raw`
<main class="scene-workspace">
    <aside id="library-panel" class="scene-panel scene-library" aria-label="Sahne ağacı">
    <div class="scene-panel-heading"><span class="scene-eyebrow">SAHNE AĞACI</span><span id="object-count" class="scene-count">0</span></div>
    <input id="object-search" class="scene-tree-search" type="search" placeholder="Nesne veya efekt ara" aria-label="Sahne ağacında ara" autocomplete="off">
    <label class="scene-tree-filter"><span>Göster</span><select id="object-filter"><option value="all">Tüm nesneler</option><option value="effects">Efektli nesneler</option></select></label>
    <button type="button" id="add-artwork" class="scene-add-artwork" title="Bağımsız PNG, JPEG veya WebP görsel nesnesi ekle">＋ Görsel nesne</button>
    <input type="file" id="new-artwork-file" hidden accept="image/webp,image/png,image/jpeg" aria-label="Yeni nesne görseli">
    <div id="object-list" class="scene-list scene-tree" role="tree" aria-label="Nesne ve efekt hiyerarşisi"></div>
    <details class="scene-tree-details"><summary>Sahne bilgileri</summary>
       <label class="scene-field">Proje adı<input id="scene-name" maxlength="160"></label>
       <p class="scene-help" id="source-note"></p>
    </details>
  </aside>

    <nav class="scene-mobile-tabs" aria-label="Düzenleme panelleri" role="tablist"><button type="button" role="tab" data-mobile-panel="library" aria-controls="library-panel" aria-selected="true">Nesneler</button><button type="button" role="tab" data-mobile-panel="inspector" tabindex="-1" aria-controls="inspector-panel" aria-selected="false">Efekt ayarları</button></nav>

    <section class="scene-stage-column" aria-label="Nesne sahnesi önizlemesi">
      <div class="scene-stage-heading">
        <div class="scene-stage-name"><button type="button" id="scene-toggle-tree" aria-label="Sahne ağacını göster veya gizle">☰</button><span class="scene-eyebrow">ÇALIŞMA TUVALİ</span></div>
        <div class="scene-toolbar">
          <button type="button" id="show-photo" aria-pressed="true" disabled>Fotoğraf</button>
          <button type="button" id="open-background" title="Sahne arka planı ve ekran kadrajı">Kadraj</button>
          <button type="button" id="show-room-objects" aria-pressed="true" aria-controls="scene-room-objects">Nesneler</button>
          <button type="button" id="show-object-areas" aria-pressed="false" aria-label="Nesne yerleşim alanları">Sınırlar</button>
          <button type="button" id="show-hit-areas" aria-pressed="true" aria-label="Tıklama alanları">Tıklama</button>
          <button type="button" id="show-effects" aria-pressed="true">Efektler</button>
          <button type="button" id="show-markers" aria-pressed="true" aria-controls="scene-markers">Hedefler</button>
          <button type="button" id="visual-edit-mode" aria-pressed="false">Taşı</button>
          <div class="scene-zoom-controls" role="group" aria-label="Sahne yakınlaştırma">
            <button type="button" id="zoom-out" aria-label="Uzaklaştır">−</button>
            <button type="button" id="zoom-fit" aria-label="Sahneye sığdır">100%</button>
            <button type="button" id="zoom-in" aria-label="Yakınlaştır">+</button>
          </div>
          <button type="button" id="undo" aria-label="Geri al" >↶</button>
          <button type="button" id="redo" aria-label="Yinele" >↷</button>
          <button type="button" id="play" aria-pressed="true">Ⅱ Duraklat</button><button type="button" id="scene-toggle-inspector" aria-label="Özellik panelini göster veya gizle">⚙</button>
        </div>
      </div>
      <div class="scene-stage-well">
       <div id="scene-screen-preview" class="scene-screen-preview" data-simulated="false">
       <div id="scene-viewport" class="scene-viewport hide-object-areas" aria-label="Normalleştirilmiş sahne görünümü">
        <img id="scene-photo" class="scene-photo" alt="BirDeSenGör güncel çalışma odası" draggable="false" hidden>
        <div id="scene-room-objects" class="scene-room-objects" aria-label="Fiziksel oda nesneleri önizlemesi"></div>
        <div id="scene-objects" class="scene-objects"></div>
        <div id="scene-markers" class="scene-markers"></div>
       </div>
       </div>
      </div>
      <p class="scene-help scene-stage-help" id="coordinate-help" hidden></p>
      <div id="status" class="scene-status" role="status" aria-live="polite">Sahne yükleniyor…</div>
      <div id="preview-status" class="scene-preview-status" role="status">Önizleme hazırlanıyor…</div>
    </section>

    <aside id="inspector-panel" class="scene-panel scene-inspector" aria-label="Seçilen nesnenin özellikleri">
    <div class="scene-panel-heading"><span class="scene-eyebrow">ÖZELLİKLER</span></div>
    <h2 id="selected-object-name">Bir nesne seçin</h2>
    <nav class="scene-inspector-tabs" aria-label="Özellik türü" role="tablist">
      <button type="button" data-inspector-tab="background" role="tab" aria-selected="false">Arka plan</button>
      <button type="button" data-inspector-tab="visual" role="tab" aria-selected="false">Nesne</button>
      <button type="button" data-inspector-tab="effect" role="tab" aria-selected="true">Efekt</button>
      <button type="button" data-inspector-tab="focus" role="tab" aria-selected="false">Görünüm</button>
    </nav>
    <div class="scene-inspector-page" data-inspector-page="background" hidden>
      <section id="scene-background-inspector"></section>
      <input type="file" id="scene-background-file" hidden accept="image/png,image/jpeg,image/webp" aria-label="Sahne arka planını değiştir">
    </div>
    <div class="scene-inspector-page" data-inspector-page="visual" hidden>
      <details id="visual-placement-settings" class="scene-advanced" open hidden><summary>Konum ve boyut</summary><section id="visual-inspector"></section></details>
      <details id="visual-source-settings" class="scene-advanced" open hidden><summary>Kaynak görsel</summary><section id="visual-source-inspector"></section><input type="file" id="visual-source-file" hidden accept="image/webp,image/png,image/jpeg" aria-label="Yeni nesne resmi seç"></details>
      <details id="visual-layers-settings" class="scene-advanced" hidden><summary>Görsel katmanları</summary><section id="visual-layers-inspector"></section><input type="file" id="visual-layer-file" hidden accept="image/webp,image/png,image/jpeg" aria-label="Hareketli görsel katmanı ekle"></details>
      <details id="visual-crop-settings" class="scene-advanced" open hidden><summary>Kırpma ve örtme</summary><section id="visual-crop-inspector"></section></details>
      <details id="robe-veil-settings" class="scene-advanced" open hidden><summary>Görünmezlik</summary><section id="robe-veil-inspector"></section></details>
      <details id="hit-area-settings" class="scene-advanced" hidden><summary>Tıklama alanı</summary><section id="hit-inspector"></section></details>
      <section id="object-inspector"></section>
    </div>
    <div class="scene-inspector-page" data-inspector-page="effect">
      <span id="effect-count" hidden>0</span><div id="effect-list" hidden></div>
      <div id="add-effect-controls" hidden>
        <label class="scene-field"><span>Yeni efekt türü</span><select id="add-effect-type"></select></label>
        <button type="button" id="add-effect" class="scene-full">＋ Efekt ekle</button>
      </div>
      <section id="effect-inspector"></section>
      <p id="site-effects-note" class="scene-help" hidden></p>
      <details id="advanced-settings" class="scene-advanced"><summary>Gelişmiş efekt ayarları</summary>
        <section id="effect-advanced"></section>
        <div class="scene-divider"></div><p class="scene-help" id="scene-id-line"></p>
        <label class="scene-field">Sahne tohumu<input id="scene-seed" maxlength="120" spellcheck="false"></label>
      </details>
    </div>
    <div class="scene-inspector-page" data-inspector-page="focus" hidden>
      <details id="focus-presentation-settings" class="scene-advanced" open hidden><summary>Yakın görünüm ve geçişler</summary><section id="focus-presentation-inspector"></section></details>
    </div>
  </aside>
  <div id="scene-context-menu" class="scene-context-menu" role="menu" hidden></div>
  </main>
`;
