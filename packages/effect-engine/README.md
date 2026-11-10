# Channel Foundry kanonik Efekt Motoru

Tek kaynak: src/model, src/registry, src/runtime, src/editor.
Fotoğraf v1 ve nesne sahnesi v2 ortak motoru kullanır. BirDeSenGör web, Vite alias'ıyla doğrudan runtime'a bağlanır. Studio scene.html, aynı paketin editörünü açar.

Yardımcı Asistan kendi site efekt ve yayın yönetimini koruyacak; geçiş sonrası bu paketten SHA-256 doğrulamalı sürümlü snapshot alacak. Eski bağımsız EfektAtolyesi checkout artık gerekli değildir; bütün çalışma kaynakları Channel Foundry içindedir.

Test: npm run verify:effect-engine; Studio: npm run verify:scene-workshop.
